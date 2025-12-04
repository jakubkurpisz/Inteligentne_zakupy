from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
import subprocess
import threading
import time
from typing import Dict, List, Optional
import pyodbc
import os
from dotenv import load_dotenv
import csv
import requests
from io import StringIO
import socket
from bs4 import BeautifulSoup
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import math

load_dotenv()

app = FastAPI(title="Inteligentne Zakupy API")

# Scheduler dla cyklicznej synchronizacji
scheduler = BackgroundScheduler()
sync_lock = threading.Lock()  # Lock do synchronizacji aby nie uruchamiać wielu jednocześnie

# Cache dla purchase-proposals
purchase_proposals_cache = {
    "data": None,
    "timestamp": None,
    "cache_duration": 600  # 10 minut w sekundach
}

# Cache dla dashboard-stats
dashboard_stats_cache = {
    "data": None,
    "timestamp": None,
    "cache_duration": 60  # 1 minuta w sekundach (częstsze odświeżanie dla dashboardu)
}

# Cache dla seasonality-index (długi czas cache - dane zmieniają się wolno)
seasonality_cache = {
    "data": {},  # Słownik z kluczem = parametry zapytania
    "cache_duration": 1800  # 30 minut w sekundach
}

# ==================== GLOBALNY CACHE DANYCH ====================
# Dane ładowane przy starcie serwera i aktualizowane w tle
# Frontend otrzymuje natychmiastową odpowiedź z pamięci
global_data_cache = {
    "sales_data": {
        "data": None,
        "timestamp": None,
        "loading": False
    },
    "dead_stock": {
        "data": None,
        "timestamp": None,
        "loading": False
    },
    "sales_summary": {
        "data": None,
        "timestamp": None,
        "loading": False
    }
}
cache_refresh_lock = threading.Lock()

# Kompresja GZIP - drastycznie przyspiesza transfer dużych JSON (~7MB -> ~700KB)
app.add_middleware(GZipMiddleware, minimum_size=1000)  # Kompresuj odpowiedzi > 1KB

# Konfiguracja CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # W produkcji zmień na konkretną domenę frontendu
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ścieżki do plików
BASE_DIR = Path(__file__).parent.parent
DATABASE_FILE = BASE_DIR / "product_states.db"
PYTHON_SCRIPT = BASE_DIR / "product_data_manager_optimized.py"
SALES_PLANS_CSV = BASE_DIR / "backend" / "sales_plans.csv"

# URL Google Sheets
GOOGLE_SHEETS_URL = "https://docs.google.com/spreadsheets/d/1B05iP_oad2Be-F-wbT02kipF0UJkObenHkSRRm6PfJU/export?format=csv&gid=0"


def parse_polish_number(value):
    """Parsuje liczbę w polskim formacie (przecinek jako separator dziesiętny)"""
    if not value:
        return 0.0
    try:
        # Usuń cudzysłowy i zamień przecinek na kropkę
        clean = str(value).strip().replace('"', '').replace(',', '.')
        return float(clean) if clean else 0.0
    except (ValueError, TypeError):
        return 0.0

def sync_sales_plans_from_google():
    """Synchronizuje plany sprzedażowe z Google Sheets do SQLite"""
    try:
        print("[SYNC] Pobieranie danych z Google Sheets...")
        response = requests.get(GOOGLE_SHEETS_URL, timeout=30, allow_redirects=True)
        response.raise_for_status()

        csv_content = response.text
        csv_reader = csv.DictReader(StringIO(csv_content))

        conn = sqlite3.connect(str(DATABASE_FILE))
        cursor = conn.cursor()

        # Utwórz tabelę jeśli nie istnieje
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sales_plans (
                date TEXT PRIMARY KEY,
                gls REAL DEFAULT 0,
                four_f REAL DEFAULT 0,
                jeans REAL DEFAULT 0,
                total REAL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        rows_updated = 0
        for row in csv_reader:
            try:
                # Obsługa różnych wariantów nazwy kolumny DATA/Data/data
                date = row.get('DATA', row.get('Data', row.get('data', ''))).strip()
                if not date:
                    continue

                gls = parse_polish_number(row.get('GLS', row.get('gls', 0)))
                four_f = parse_polish_number(row.get('4F', row.get('four_f', 0)))
                jeans = parse_polish_number(row.get('JEANS', row.get('jeans', 0)))
                total = gls + four_f + jeans

                cursor.execute("""
                    INSERT INTO sales_plans (date, gls, four_f, jeans, total, updated_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(date) DO UPDATE SET
                        gls = excluded.gls,
                        four_f = excluded.four_f,
                        jeans = excluded.jeans,
                        total = excluded.total,
                        updated_at = CURRENT_TIMESTAMP
                """, (date, gls, four_f, jeans, total))
                rows_updated += 1
            except (ValueError, KeyError) as e:
                print(f"[SYNC] Pomijam wiersz: {e}")
                continue

        conn.commit()
        conn.close()
        print(f"[SYNC] Zsynchronizowano {rows_updated} wierszy")
        return True

    except Exception as e:
        print(f"[SYNC] Błąd synchronizacji: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_sales_plans_from_db(start_date=None, end_date=None):
    """Pobiera plany sprzedażowe z bazy SQLite"""
    try:
        conn = sqlite3.connect(str(DATABASE_FILE))
        cursor = conn.cursor()

        # Konwertuj daty z DD.MM.YYYY na YYYY-MM-DD dla poprawnego porównania
        def convert_date(date_str):
            if not date_str:
                return None
            parts = date_str.split('.')
            if len(parts) == 3:
                return f"{parts[2]}-{parts[1]}-{parts[0]}"  # YYYY-MM-DD
            return date_str

        # Użyj substr do konwersji daty w bazie na format YYYY-MM-DD
        # date w formacie DD.MM.YYYY -> substr(date,7,4)||'-'||substr(date,4,2)||'-'||substr(date,1,2)
        date_expr = "substr(date,7,4)||'-'||substr(date,4,2)||'-'||substr(date,1,2)"

        query = "SELECT date, gls, four_f, jeans, total FROM sales_plans"
        params = []

        if start_date or end_date:
            conditions = []
            if start_date:
                conditions.append(f"{date_expr} >= ?")
                params.append(convert_date(start_date))
            if end_date:
                conditions.append(f"{date_expr} <= ?")
                params.append(convert_date(end_date))
            query += " WHERE " + " AND ".join(conditions)

        query += f" ORDER BY {date_expr} DESC"

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        plans = []
        for row in rows:
            plans.append({
                "date": row[0],
                "gls": float(row[1] or 0),
                "four_f": float(row[2] or 0),
                "jeans": float(row[3] or 0),
                "total": float(row[4] or 0)
            })

        return plans

    except Exception as e:
        print(f"[DB] Błąd pobierania planów: {e}")
        return []


def get_local_ip():
    """Wykrywa lokalne IP maszyny"""
    try:
        # Tworzymy połączenie do zewnętrznego adresu (nie musi być dostępny)
        # aby system wybrał odpowiedni interfejs sieciowy
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        # Fallback na localhost jeśli wykrywanie nie powiedzie się
        return "127.0.0.1"


def run_python_script():
    """Uruchamia skrypt Pythona do aktualizacji danych"""
    print(f"Uruchamiam skrypt Pythona: {PYTHON_SCRIPT}")
    try:
        result = subprocess.run(
            ["python3", str(PYTHON_SCRIPT)],
            capture_output=True,
            text=True,
            timeout=300  # 5 minut timeout
        )
        print(f"Python stdout: {result.stdout}")
        if result.stderr:
            print(f"Python stderr: {result.stderr}")
        print(f"Skrypt Pythona zakończył działanie z kodem: {result.returncode}")
        if result.returncode != 0:
            print("Błąd podczas uruchamiania skryptu Pythona. Sprawdź logi.")
    except subprocess.TimeoutExpired:
        print("Skrypt Pythona przekroczył limit czasu (5 minut)")
    except Exception as e:
        print(f"Błąd podczas uruchamiania skryptu: {e}")


def schedule_python_script():
    """Uruchamia skrypt Pythona co 5 minut"""
    while True:
        run_python_script()
        time.sleep(5 * 60)  # 5 minut


def schedule_sales_plans_sync():
    """Synchronizuje plany sprzedażowe co 30 minut"""
    while True:
        time.sleep(30 * 60)  # 30 minut
        print("\n[AUTO-SYNC] Rozpoczynam automatyczną synchronizację planów sprzedażowych...")
        try:
            success = sync_sales_plans_from_google()
            if success:
                print("[AUTO-SYNC] Synchronizacja planów zakończona pomyślnie!")
            else:
                print("[AUTO-SYNC] Synchronizacja planów nie powiodła się!")
        except Exception as e:
            print(f"[AUTO-SYNC] Błąd synchronizacji planów: {e}")


# Startup event - nie uruchamiamy już niczego przy starcie
# Harmonogram działa w tle przez APScheduler (co godzinę)


@app.post("/api/update-database")
async def update_database_now():
    """Ręczne uruchomienie aktualizacji bazy danych"""
    try:
        print("\n[MANUAL UPDATE] Uruchamiam ręczną aktualizację bazy danych...")

        # Uruchom aktualizację w osobnym wątku, żeby nie blokować API
        def run_update():
            run_python_script()

        threading.Thread(target=run_update, daemon=True).start()

        return {
            "status": "success",
            "message": "Aktualizacja bazy danych została uruchomiona w tle. Odśwież stronę za ~30 sekund aby zobaczyć zaktualizowane dane.",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas uruchamiania aktualizacji: {str(e)}"
        )


@app.get("/api/database-status")
async def get_database_status():
    """Sprawdza status ostatniej aktualizacji bazy danych"""
    try:
        conn = sqlite3.connect(str(DATABASE_FILE))
        cursor = conn.cursor()

        # Pobierz ostatnią aktualizację
        cursor.execute("SELECT MAX(LastUpdated) FROM products")
        last_update = cursor.fetchone()[0]

        # Pobierz liczbę produktów
        cursor.execute("SELECT COUNT(*) FROM products")
        total_products = cursor.fetchone()[0]

        conn.close()

        return {
            "last_update": last_update,
            "total_products": total_products,
            "database_path": str(DATABASE_FILE)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas sprawdzania statusu bazy: {str(e)}"
        )


def get_db_connection():
    """Tworzy połączenie z bazą danych SQLite"""
    if not DATABASE_FILE.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Baza danych nie istnieje: {DATABASE_FILE}"
        )

    conn = sqlite3.connect(str(DATABASE_FILE))
    conn.row_factory = sqlite3.Row
    return conn


# ==================== FUNKCJE ŁADOWANIA CACHE ====================

def load_sales_data_to_cache():
    """Ładuje dane sprzedażowe do cache"""
    global global_data_cache
    try:
        print("[CACHE] Ładowanie sales_data do cache...")
        global_data_cache["sales_data"]["loading"] = True

        conn = sqlite3.connect(str(DATABASE_FILE))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM products")
        rows = cursor.fetchall()
        conn.close()

        data = [dict(row) for row in rows]

        with cache_refresh_lock:
            global_data_cache["sales_data"]["data"] = data
            global_data_cache["sales_data"]["timestamp"] = datetime.now()
            global_data_cache["sales_data"]["loading"] = False

        print(f"[CACHE] Załadowano {len(data)} rekordów do sales_data cache")
        return True
    except Exception as e:
        print(f"[CACHE ERROR] Błąd ładowania sales_data: {e}")
        global_data_cache["sales_data"]["loading"] = False
        return False


def load_dead_stock_to_cache():
    """Ładuje dane dead stock do cache"""
    global global_data_cache
    try:
        print("[CACHE] Ładowanie dead_stock do cache...")
        global_data_cache["dead_stock"]["loading"] = True

        conn = sqlite3.connect(str(DATABASE_FILE))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Pobierz wszystkie dane z tabeli dead_stock_analysis
        cursor.execute("SELECT * FROM dead_stock_analysis ORDER BY DaysNoMovement DESC")
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description]

        items = []
        for row in rows:
            item_dict = dict(zip(columns, row))
            items.append(item_dict)

        # Oblicz statystyki kategorii
        cursor.execute("""
            SELECT
                Category,
                COUNT(*) as count,
                SUM(FrozenValue) as total_value
            FROM dead_stock_analysis
            GROUP BY Category
        """)
        category_stats_raw = cursor.fetchall()

        category_stats = {
            "NEW": 0, "NEW_NO_SALES": 0, "NEW_SELLING": 0, "NEW_SLOW": 0,
            "REPEATED_NO_SALES": 0, "VERY_FAST": 0, "FAST": 0, "NORMAL": 0,
            "SLOW": 0, "VERY_SLOW": 0, "DEAD": 0
        }

        total_frozen_value = 0
        for cat_row in category_stats_raw:
            cat_name = cat_row[0]
            cat_count = cat_row[1]
            cat_value = cat_row[2] or 0
            if cat_name in category_stats:
                category_stats[cat_name] = cat_count
            total_frozen_value += cat_value

        conn.close()

        cache_data = {
            "items": items,
            "category_stats": category_stats,
            "total_frozen_value": round(total_frozen_value, 2),
            "total_items": len(items)
        }

        with cache_refresh_lock:
            global_data_cache["dead_stock"]["data"] = cache_data
            global_data_cache["dead_stock"]["timestamp"] = datetime.now()
            global_data_cache["dead_stock"]["loading"] = False

        print(f"[CACHE] Załadowano {len(items)} rekordów do dead_stock cache")
        return True
    except Exception as e:
        print(f"[CACHE ERROR] Błąd ładowania dead_stock: {e}")
        global_data_cache["dead_stock"]["loading"] = False
        return False


def load_sales_summary_to_cache():
    """Ładuje podsumowanie sprzedaży do cache"""
    global global_data_cache
    try:
        print("[CACHE] Ładowanie sales_summary do cache...")
        global_data_cache["sales_summary"]["loading"] = True

        conn = sqlite3.connect(str(DATABASE_FILE))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM products")
        rows = cursor.fetchall()
        conn.close()

        # Przygotuj dane sprzedażowe
        sales_data = []
        for row in rows:
            try:
                data_sprzedazy = None
                if row["DataSprzedazy"]:
                    for fmt in ["%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d.%m.%Y"]:
                        try:
                            data_sprzedazy = datetime.strptime(row["DataSprzedazy"], fmt)
                            break
                        except ValueError:
                            continue

                if data_sprzedazy:
                    sales_data.append({
                        "DataSprzedazy": data_sprzedazy,
                        "WartoscNetto": float(row["DetalicznaNetto"] or 0),
                        "WartoscBrutto": float(row["DetalicznaBrutto"] or 0),
                        "IloscSprzedana": float(row["Stan"] or 0),
                    })
            except (ValueError, TypeError):
                continue

        # Agregacja danych
        summary = {"daily": {}, "weekly": {}, "monthly": {}, "yearly": {}}

        for item in sales_data:
            date = item["DataSprzedazy"]
            year = date.year
            week = date.isocalendar()[1]

            # Dzienna
            daily_key = date.strftime("%Y-%m-%d")
            if daily_key not in summary["daily"]:
                summary["daily"][daily_key] = {"date": daily_key, "totalNetto": 0, "totalBrutto": 0, "totalQuantity": 0}
            summary["daily"][daily_key]["totalNetto"] += item["WartoscNetto"]
            summary["daily"][daily_key]["totalBrutto"] += item["WartoscBrutto"]
            summary["daily"][daily_key]["totalQuantity"] += item["IloscSprzedana"]

            # Tygodniowa
            weekly_key = f"{year}-W{week:02d}"
            if weekly_key not in summary["weekly"]:
                summary["weekly"][weekly_key] = {"week": weekly_key, "totalNetto": 0, "totalBrutto": 0, "totalQuantity": 0}
            summary["weekly"][weekly_key]["totalNetto"] += item["WartoscNetto"]
            summary["weekly"][weekly_key]["totalBrutto"] += item["WartoscBrutto"]
            summary["weekly"][weekly_key]["totalQuantity"] += item["IloscSprzedana"]

            # Miesięczna
            monthly_key = date.strftime("%Y-%m")
            if monthly_key not in summary["monthly"]:
                summary["monthly"][monthly_key] = {"month": monthly_key, "totalNetto": 0, "totalBrutto": 0, "totalQuantity": 0}
            summary["monthly"][monthly_key]["totalNetto"] += item["WartoscNetto"]
            summary["monthly"][monthly_key]["totalBrutto"] += item["WartoscBrutto"]
            summary["monthly"][monthly_key]["totalQuantity"] += item["IloscSprzedana"]

            # Roczna
            yearly_key = str(year)
            if yearly_key not in summary["yearly"]:
                summary["yearly"][yearly_key] = {"year": yearly_key, "totalNetto": 0, "totalBrutto": 0, "totalQuantity": 0}
            summary["yearly"][yearly_key]["totalNetto"] += item["WartoscNetto"]
            summary["yearly"][yearly_key]["totalBrutto"] += item["WartoscBrutto"]
            summary["yearly"][yearly_key]["totalQuantity"] += item["IloscSprzedana"]

        result = {
            "daily": sorted(summary["daily"].values(), key=lambda x: x["date"], reverse=True),
            "weekly": sorted(summary["weekly"].values(), key=lambda x: x["week"], reverse=True),
            "monthly": sorted(summary["monthly"].values(), key=lambda x: x["month"], reverse=True),
            "yearly": sorted(summary["yearly"].values(), key=lambda x: x["year"], reverse=True)
        }

        with cache_refresh_lock:
            global_data_cache["sales_summary"]["data"] = result
            global_data_cache["sales_summary"]["timestamp"] = datetime.now()
            global_data_cache["sales_summary"]["loading"] = False

        print(f"[CACHE] Załadowano sales_summary do cache")
        return True
    except Exception as e:
        print(f"[CACHE ERROR] Błąd ładowania sales_summary: {e}")
        global_data_cache["sales_summary"]["loading"] = False
        return False


def refresh_all_cache():
    """Odświeża wszystkie dane w cache (uruchamiane w tle)"""
    print("[CACHE] Rozpoczynam odswiezanie wszystkich danych...")
    load_sales_data_to_cache()
    load_dead_stock_to_cache()
    print("[CACHE] Zakonczono odswiezanie wszystkich danych")


def init_cache_on_startup():
    """Inicjalizuje cache przy starcie serwera"""
    print("\n" + "="*60)
    print("[CACHE] INICJALIZACJA CACHE PRZY STARCIE SERWERA")
    print("="*60)

    # Ładuj dane w osobnym wątku aby nie blokować startu
    def load_all():
        load_sales_data_to_cache()
        load_dead_stock_to_cache()
        print("[CACHE] Wszystkie dane zaladowane do cache")

    thread = threading.Thread(target=load_all)
    thread.start()
    print("[CACHE] Uruchomiono ladowanie danych w tle...")


@app.get("/api/server-info")
async def get_server_info():
    """Zwraca informacje o serwerze - IP i port"""
    local_ip = get_local_ip()
    return {
        "ip": local_ip,
        "port": 5555,
        "api_url": f"http://{local_ip}:5555",
        "message": "Backend API - Inteligentne Zakupy"
    }


@app.get("/api/cache-status")
async def get_cache_status():
    """
    Zwraca status wszystkich cache w pamięci.
    Pozwala monitorować czy dane są załadowane i jak stare.
    """
    now = datetime.now()
    status = {}

    for cache_name, cache_info in global_data_cache.items():
        if cache_info["timestamp"]:
            age_seconds = (now - cache_info["timestamp"]).total_seconds()
            status[cache_name] = {
                "loaded": cache_info["data"] is not None,
                "loading": cache_info["loading"],
                "timestamp": cache_info["timestamp"].isoformat(),
                "age_seconds": round(age_seconds),
                "age_human": f"{int(age_seconds // 60)}m {int(age_seconds % 60)}s",
                "records": len(cache_info["data"]) if isinstance(cache_info["data"], list) else (
                    len(cache_info["data"].get("items", [])) if isinstance(cache_info["data"], dict) and "items" in cache_info["data"] else "N/A"
                )
            }
        else:
            status[cache_name] = {
                "loaded": False,
                "loading": cache_info["loading"],
                "timestamp": None,
                "age_seconds": None,
                "records": 0
            }

    return {
        "cache_status": status,
        "server_time": now.isoformat(),
        "next_refresh": "co 5 minut automatycznie"
    }


@app.get("/")
async def root():
    """Endpoint główny"""
    local_ip = get_local_ip()
    return {
        "message": "Inteligentne Zakupy API",
        "version": "1.0.0",
        "server_ip": local_ip,
        "api_url": f"http://{local_ip}:5555",
        "endpoints": [
            "/api/sales-data",
            "/api/sales-summary",
            "/api/sales-history",
            "/api/dead-stock",
            "/api/stats"
        ]
    }


@app.get("/api/sales-data")
async def get_sales_data(force_refresh: bool = False):
    """
    Pobiera wszystkie dane produktów z cache (natychmiastowa odpowiedź).
    Dane są ładowane przy starcie serwera i aktualizowane w tle.
    """
    # Jeśli cache jest dostępny, zwróć natychmiast
    if global_data_cache["sales_data"]["data"] is not None and not force_refresh:
        cache_age = (datetime.now() - global_data_cache["sales_data"]["timestamp"]).total_seconds()
        print(f"[CACHE HIT] sales-data - wiek cache: {cache_age:.0f}s")
        return global_data_cache["sales_data"]["data"]

    # Jeśli cache nie jest dostępny lub wymuszono odświeżenie, załaduj synchronicznie
    try:
        print("[CACHE MISS] sales-data - ładowanie z bazy...")
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM products")
        rows = cursor.fetchall()
        conn.close()

        data = [dict(row) for row in rows]

        # Zapisz do cache
        with cache_refresh_lock:
            global_data_cache["sales_data"]["data"] = data
            global_data_cache["sales_data"]["timestamp"] = datetime.now()

        return data

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd bazy danych: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Nieoczekiwany błąd: {str(e)}"
        )


def get_week_number(date: datetime) -> int:
    """Oblicza numer tygodnia (ISO 8601)"""
    return date.isocalendar()[1]


@app.get("/api/sales-summary")
async def get_sales_summary():
    """Pobiera zagregowane dane sprzedażowe (dzienne, tygodniowe, miesięczne, roczne)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM products")
        rows = cursor.fetchall()
        conn.close()

        # Przygotuj dane sprzedażowe
        sales_data = []
        for row in rows:
            try:
                data_sprzedazy = None
                if row["DataSprzedazy"]:
                    # Spróbuj różnych formatów daty
                    for fmt in ["%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d.%m.%Y"]:
                        try:
                            data_sprzedazy = datetime.strptime(row["DataSprzedazy"], fmt)
                            break
                        except ValueError:
                            continue

                if data_sprzedazy:
                    sales_data.append({
                        "DataSprzedazy": data_sprzedazy,
                        "WartoscNetto": float(row["DetalicznaNetto"] or 0),
                        "WartoscBrutto": float(row["DetalicznaBrutto"] or 0),
                        "IloscSprzedana": float(row["Stan"] or 0),
                    })
            except (ValueError, TypeError) as e:
                print(f"Błąd parsowania wiersza: {e}, wiersz: {dict(row)}")
                continue

        # Inicjalizuj struktury dla agregacji
        summary = {
            "daily": {},
            "weekly": {},
            "monthly": {},
            "yearly": {}
        }

        # Agreguj dane
        for item in sales_data:
            date = item["DataSprzedazy"]
            year = date.year
            month = date.month
            day = date.day
            week = get_week_number(date)

            # Agregacja dzienna
            daily_key = date.strftime("%Y-%m-%d")
            if daily_key not in summary["daily"]:
                summary["daily"][daily_key] = {
                    "date": daily_key,
                    "totalNetto": 0,
                    "totalBrutto": 0,
                    "totalQuantity": 0
                }
            summary["daily"][daily_key]["totalNetto"] += item["WartoscNetto"]
            summary["daily"][daily_key]["totalBrutto"] += item["WartoscBrutto"]
            summary["daily"][daily_key]["totalQuantity"] += item["IloscSprzedana"]

            # Agregacja tygodniowa
            weekly_key = f"{year}-W{week:02d}"
            if weekly_key not in summary["weekly"]:
                summary["weekly"][weekly_key] = {
                    "week": weekly_key,
                    "totalNetto": 0,
                    "totalBrutto": 0,
                    "totalQuantity": 0
                }
            summary["weekly"][weekly_key]["totalNetto"] += item["WartoscNetto"]
            summary["weekly"][weekly_key]["totalBrutto"] += item["WartoscBrutto"]
            summary["weekly"][weekly_key]["totalQuantity"] += item["IloscSprzedana"]

            # Agregacja miesięczna
            monthly_key = f"{year}-{month:02d}"
            if monthly_key not in summary["monthly"]:
                summary["monthly"][monthly_key] = {
                    "month": monthly_key,
                    "totalNetto": 0,
                    "totalBrutto": 0,
                    "totalQuantity": 0
                }
            summary["monthly"][monthly_key]["totalNetto"] += item["WartoscNetto"]
            summary["monthly"][monthly_key]["totalBrutto"] += item["WartoscBrutto"]
            summary["monthly"][monthly_key]["totalQuantity"] += item["IloscSprzedana"]

            # Agregacja roczna
            yearly_key = str(year)
            if yearly_key not in summary["yearly"]:
                summary["yearly"][yearly_key] = {
                    "year": yearly_key,
                    "totalNetto": 0,
                    "totalBrutto": 0,
                    "totalQuantity": 0
                }
            summary["yearly"][yearly_key]["totalNetto"] += item["WartoscNetto"]
            summary["yearly"][yearly_key]["totalBrutto"] += item["WartoscBrutto"]
            summary["yearly"][yearly_key]["totalQuantity"] += item["IloscSprzedana"]

        # Sortuj i konwertuj na listy
        return {
            "daily": sorted(summary["daily"].values(), key=lambda x: x["date"]),
            "weekly": sorted(summary["weekly"].values(), key=lambda x: x["week"]),
            "monthly": sorted(summary["monthly"].values(), key=lambda x: x["month"]),
            "yearly": sorted(summary["yearly"].values(), key=lambda x: x["year"])
        }

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd bazy danych: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Nieoczekiwany błąd: {str(e)}"
        )


@app.get("/api/changes/recent")
async def get_recent_changes(limit: int = 100):
    """Pobiera ostatnie zmiany w produktach"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM change_log
            ORDER BY ChangeDate DESC
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        conn.close()

        changes = [dict(row) for row in rows]
        return changes

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd bazy danych: {str(e)}"
        )


@app.get("/api/products/new")
async def get_new_products():
    """Pobiera nowe produkty (dodane w ostatnim cyklu)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM products
            WHERE IsNew = 1
            ORDER BY LastUpdated DESC
        """)
        rows = cursor.fetchall()
        conn.close()

        products = [dict(row) for row in rows]
        return products

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd bazy danych: {str(e)}"
        )


@app.get("/api/products/updated")
async def get_updated_products(minutes: int = 10):
    """Pobiera produkty zaktualizowane w ostatnich X minutach"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(f"""
            SELECT * FROM products
            WHERE datetime(LastUpdated) > datetime('now', '-{minutes} minutes')
            ORDER BY LastUpdated DESC
        """)
        rows = cursor.fetchall()
        conn.close()

        products = [dict(row) for row in rows]
        return products

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd bazy danych: {str(e)}"
        )


@app.get("/api/sales-history")
async def get_sales_history(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    period: Optional[str] = "daily",
    mag_ids: Optional[str] = None
):
    """Pobiera historię sprzedaży z lokalnej bazy SQLite"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Parsowanie mag_ids
    if mag_ids:
        mag_id_list = [int(x.strip()) for x in mag_ids.split(',') if x.strip().isdigit()]
    else:
        mag_id_list = [1, 7, 9]

    # Buduj zapytanie SQL
    query = """
    SELECT
        DataSprzedazy,
        SUM(IloscSprzedana) AS IloscSprzedana,
        SUM(WartoscNetto) AS WartoscNetto,
        SUM(WartoscBrutto) AS WartoscBrutto,
        SUM(LiczbaTransakcji) AS LiczbaTransakcji,
        SUM(LiczbaProduktow) AS LiczbaProduktow
    FROM
        sales_history
    WHERE
        MagId IN ({})
    """.format(','.join('?' * len(mag_id_list)))

    params = mag_id_list.copy()

    # Dodaj filtrowanie dat
    if start_date:
        query += " AND DataSprzedazy >= ?"
        params.append(start_date)
    if end_date:
        query += " AND DataSprzedazy <= ?"
        params.append(end_date)

    query += " GROUP BY DataSprzedazy"
    query += " ORDER BY DataSprzedazy DESC"

    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()

        sales_history = []
        for row in rows:
            sales_history.append({
                "DataSprzedazy": row[0],
                "IloscSprzedana": float(row[1] or 0),
                "WartoscNetto": float(row[2] or 0),
                "WartoscBrutto": float(row[3] or 0),
                "LiczbaTransakcji": int(row[4] or 0),
                "LiczbaProduktow": int(row[5] or 0)
            })

        cursor.close()
        conn.close()

        return {
            "period": period,
            "start_date": start_date,
            "end_date": end_date,
            "total_records": len(sales_history),
            "data": sales_history,
            "source": "SQLite (synchronizowane z Subiekta)"
        }

    except Exception as e:
        cursor.close()
        conn.close()
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas pobierania historii sprzedaży: {str(e)}"
        )


@app.get("/api/sales-items")
async def get_sales_items(
    start_date: str,
    end_date: str,
    mag_ids: Optional[str] = None,
    rodzaj: Optional[str] = None,
    przeznaczenie: Optional[str] = None,
    marka: Optional[str] = None,
    limit: int = 500
):
    """
    Pobiera listę sprzedanych produktów z SQL Server z możliwością filtrowania.

    Parametry:
    - start_date: Data początkowa (YYYY-MM-DD)
    - end_date: Data końcowa (YYYY-MM-DD)
    - mag_ids: ID magazynów (np. "1,7,9")
    - rodzaj: Filtr po rodzaju produktu
    - przeznaczenie: Filtr po przeznaczeniu produktu
    - marka: Filtr po marce
    - limit: Maksymalna liczba rekordów (domyślnie 500)
    """
    try:
        # Połączenie z SQL Server
        server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
        database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
        username = os.getenv('SQL_USERNAME', 'zestawienia2')
        password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

        try:
            sql_connection = pyodbc.connect(
                'DRIVER={ODBC Driver 18 for SQL Server};'
                f'SERVER={server};'
                f'DATABASE={database};'
                f'UID={username};'
                f'PWD={password};'
                'TrustServerCertificate=yes;'
                'Connection Timeout=30;'
            )
        except pyodbc.Error as conn_err:
            raise HTTPException(
                status_code=503,
                detail=f"Błąd połączenia z SQL Server: {str(conn_err)}"
            )

        sql_cursor = sql_connection.cursor()

        # Parsowanie mag_ids
        if mag_ids:
            mag_id_list = [int(x.strip()) for x in mag_ids.split(',') if x.strip().isdigit()]
        else:
            mag_id_list = [1, 7, 9]

        mag_placeholders = ','.join(['?' for _ in mag_id_list])

        # Buduj zapytanie SQL dla sprzedaży z filtrami
        # Nazwy kolumn w SQL Server: tw_Pole2 = Marka, tw_pole1 = Rozmiar
        query = f"""
        SELECT
            tw.tw_Symbol AS Symbol,
            tw.tw_Nazwa AS Nazwa,
            tw.tw_Pole2 AS Marka,
            tw.tw_pole1 AS Rozmiar,
            tw.tw_pole7 AS Przeznaczenie,
            tw.tw_pole8 AS Rodzaj,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_IloscMag ELSE ob_IloscMag END) AS IloscSprzedana,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_WartNetto ELSE ob_WartNetto END) AS WartoscNetto,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_WartBrutto ELSE ob_WartBrutto END) AS WartoscBrutto,
            COUNT(DISTINCT dok_NrPelny) AS LiczbaTransakcji
        FROM vwZstSprzWgKhnt
        LEFT JOIN tw__Towar tw ON ob_TowId = tw.tw_Id
        WHERE CAST(dok_DataWyst AS DATE) >= ?
            AND CAST(dok_DataWyst AS DATE) <= ?
            AND dok_MagId IN ({mag_placeholders})
            AND dok_Podtyp <> 1
            AND dok_Status <> 2
        """

        params = [start_date, end_date] + mag_id_list

        # Dodaj filtr rodzaju
        if rodzaj:
            query += " AND tw.tw_pole8 = ?"
            params.append(rodzaj)

        # Dodaj filtr przeznaczenia
        if przeznaczenie:
            query += " AND tw.tw_pole7 = ?"
            params.append(przeznaczenie)

        # Dodaj filtr marki
        if marka:
            query += " AND tw.tw_Pole2 = ?"
            params.append(marka)

        query += """
        GROUP BY tw.tw_Symbol, tw.tw_Nazwa, tw.tw_Pole2, tw.tw_pole1, tw.tw_pole7, tw.tw_pole8
        HAVING SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_WartBrutto ELSE ob_WartBrutto END) > 0
        ORDER BY SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_WartBrutto ELSE ob_WartBrutto END) DESC
        """

        sql_cursor.execute(query, params)
        rows = sql_cursor.fetchmany(limit)

        items = []
        for row in rows:
            items.append({
                "Symbol": row[0] or "",
                "Nazwa": row[1] or "",
                "Marka": row[2] or "",
                "Rozmiar": row[3] or "",
                "Przeznaczenie": row[4] or "",
                "Rodzaj": row[5] or "",
                "IloscSprzedana": float(row[6] or 0),
                "WartoscNetto": round(float(row[7] or 0), 2),
                "WartoscBrutto": round(float(row[8] or 0), 2),
                "LiczbaTransakcji": int(row[9] or 0)
            })

        # Pobierz unikalne wartości dla filtrów z SQL Server
        filter_query = """
        SELECT DISTINCT tw.tw_pole8 AS Rodzaj
        FROM tw__Towar tw
        WHERE tw.tw_pole8 IS NOT NULL AND tw.tw_pole8 != ''
        ORDER BY tw.tw_pole8
        """
        sql_cursor.execute(filter_query)
        rodzaje = [row[0] for row in sql_cursor.fetchall()]

        filter_query = """
        SELECT DISTINCT tw.tw_pole7 AS Przeznaczenie
        FROM tw__Towar tw
        WHERE tw.tw_pole7 IS NOT NULL AND tw.tw_pole7 != ''
        ORDER BY tw.tw_pole7
        """
        sql_cursor.execute(filter_query)
        przeznaczenia = [row[0] for row in sql_cursor.fetchall()]

        filter_query = """
        SELECT DISTINCT tw.tw_Pole2 AS Marka
        FROM tw__Towar tw
        WHERE tw.tw_Pole2 IS NOT NULL AND tw.tw_Pole2 != ''
        ORDER BY tw.tw_Pole2
        """
        sql_cursor.execute(filter_query)
        marki = [row[0] for row in sql_cursor.fetchall()]

        sql_connection.close()

        return {
            "success": True,
            "total_items": len(items),
            "start_date": start_date,
            "end_date": end_date,
            "items": items,
            "filters": {
                "rodzaje": rodzaje,
                "przeznaczenia": przeznaczenia,
                "marki": marki
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas pobierania listy sprzedanych towarów: {str(e)}"
        )


@app.get("/api/sales-items-trend")
async def get_sales_items_trend(
    start_date: str,
    end_date: str,
    mag_ids: Optional[str] = None,
    rodzaj: Optional[str] = None,
    przeznaczenie: Optional[str] = None,
    symbol: Optional[str] = None,
    model: Optional[str] = None,
    group_by: str = "day"
):
    """
    Pobiera trend sprzedaży z SQL Server z możliwością filtrowania.

    Parametry:
    - start_date: Data początkowa (YYYY-MM-DD)
    - end_date: Data końcowa (YYYY-MM-DD)
    - mag_ids: ID magazynów
    - rodzaj: Filtr po rodzaju produktu
    - przeznaczenie: Filtr po przeznaczeniu produktu
    - symbol: Filtr po symbolu produktu (wyszukiwanie częściowe)
    - model: Filtr po modelu produktu (ModelSp - wyszukiwanie częściowe)
    - group_by: Grupowanie - day (dzień), week (tydzień), month (miesiąc)
    """
    try:
        # Połączenie z SQL Server
        server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
        database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
        username = os.getenv('SQL_USERNAME', 'zestawienia2')
        password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

        try:
            sql_connection = pyodbc.connect(
                'DRIVER={ODBC Driver 18 for SQL Server};'
                f'SERVER={server};'
                f'DATABASE={database};'
                f'UID={username};'
                f'PWD={password};'
                'TrustServerCertificate=yes;'
                'Connection Timeout=30;'
            )
        except pyodbc.Error as conn_err:
            raise HTTPException(
                status_code=503,
                detail=f"Błąd połączenia z SQL Server: {str(conn_err)}"
            )

        sql_cursor = sql_connection.cursor()

        # Parsowanie mag_ids
        if mag_ids:
            mag_id_list = [int(x.strip()) for x in mag_ids.split(',') if x.strip().isdigit()]
        else:
            mag_id_list = [1, 7, 9]

        mag_placeholders = ','.join(['?' for _ in mag_id_list])

        # Buduj zapytanie w zależności od grupowania
        if group_by == "week":
            date_select = "CONCAT(YEAR(dok_DataWyst), '-W', FORMAT(DATEPART(WEEK, dok_DataWyst), '00')) AS Data"
            group_clause = "CONCAT(YEAR(dok_DataWyst), '-W', FORMAT(DATEPART(WEEK, dok_DataWyst), '00'))"
        elif group_by == "month":
            date_select = "FORMAT(dok_DataWyst, 'yyyy-MM') AS Data"
            group_clause = "FORMAT(dok_DataWyst, 'yyyy-MM')"
        else:  # day
            date_select = "CAST(dok_DataWyst AS DATE) AS Data"
            group_clause = "CAST(dok_DataWyst AS DATE)"

        query = f"""
        SELECT
            {date_select},
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_IloscMag ELSE ob_IloscMag END) AS IloscSprzedana,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_WartNetto ELSE ob_WartNetto END) AS WartoscNetto,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_WartBrutto ELSE ob_WartBrutto END) AS WartoscBrutto,
            COUNT(DISTINCT ob_TowId) AS LiczbaProduktow,
            COUNT(DISTINCT dok_NrPelny) AS LiczbaTransakcji
        FROM vwZstSprzWgKhnt
        LEFT JOIN tw__Towar tw ON ob_TowId = tw.tw_Id
        WHERE CAST(dok_DataWyst AS DATE) >= ?
            AND CAST(dok_DataWyst AS DATE) <= ?
            AND dok_MagId IN ({mag_placeholders})
            AND dok_Podtyp <> 1
            AND dok_Status <> 2
        """

        params = [start_date, end_date] + mag_id_list

        # Dodaj filtr rodzaju
        if rodzaj:
            query += " AND tw.tw_pole8 = ?"
            params.append(rodzaj)

        # Dodaj filtr przeznaczenia
        if przeznaczenie:
            query += " AND tw.tw_pole7 = ?"
            params.append(przeznaczenie)

        # Dodaj filtr symbolu (wyszukiwanie częściowe)
        if symbol:
            query += " AND tw.tw_Symbol LIKE ?"
            params.append(f"%{symbol}%")

        # Dodaj filtr modelu (tw_pole3 - wyszukiwanie częściowe)
        if model:
            query += " AND tw.tw_pole3 LIKE ?"
            params.append(f"%{model}%")

        query += f"""
        GROUP BY {group_clause}
        ORDER BY {group_clause}
        """

        sql_cursor.execute(query, params)
        rows = sql_cursor.fetchall()

        trend_data = []
        for row in rows:
            data_value = row[0]
            if hasattr(data_value, 'strftime'):
                data_str = data_value.strftime('%Y-%m-%d')
            else:
                data_str = str(data_value) if data_value else ""

            trend_data.append({
                "Data": data_str,
                "IloscSprzedana": float(row[1] or 0),
                "WartoscNetto": float(row[2] or 0),
                "WartoscBrutto": float(row[3] or 0),
                "LiczbaProduktow": int(row[4] or 0),
                "LiczbaTransakcji": int(row[5] or 0)
            })

        sql_connection.close()

        return {
            "success": True,
            "group_by": group_by,
            "start_date": start_date,
            "end_date": end_date,
            "data": trend_data
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas pobierania trendu: {str(e)}"
        )


@app.get("/api/sales-items/filters")
async def get_sales_items_filters():
    """
    Pobiera dostępne wartości filtrów (Rodzaj, Przeznaczenie, Marka) z bazy produktów.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Pobierz unikalne rodzaje
        cursor.execute("SELECT DISTINCT Rodzaj FROM products WHERE Rodzaj IS NOT NULL AND Rodzaj != '' ORDER BY Rodzaj")
        rodzaje = [row[0] for row in cursor.fetchall()]

        # Pobierz unikalne przeznaczenia
        cursor.execute("SELECT DISTINCT Przeznaczenie FROM products WHERE Przeznaczenie IS NOT NULL AND Przeznaczenie != '' ORDER BY Przeznaczenie")
        przeznaczenia = [row[0] for row in cursor.fetchall()]

        # Pobierz unikalne marki
        cursor.execute("SELECT DISTINCT Marka FROM products WHERE Marka IS NOT NULL AND Marka != '' ORDER BY Marka")
        marki = [row[0] for row in cursor.fetchall()]

        cursor.close()
        conn.close()

        return {
            "rodzaje": rodzaje,
            "przeznaczenia": przeznaczenia,
            "marki": marki
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas pobierania filtrów: {str(e)}"
        )


@app.get("/api/stats")
async def get_statistics():
    """Pobiera statystyki bazy danych"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM products")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM products WHERE IsNew = 1")
        new_products = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COUNT(*) FROM products
            WHERE datetime(LastUpdated) > datetime('now', '-10 minutes')
            AND IsNew = 0
        """)
        recently_updated = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COUNT(*) FROM change_log
            WHERE datetime(ChangeDate) > datetime('now', '-10 minutes')
        """)
        recent_changes = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM change_log")
        total_changes = cursor.fetchone()[0]

        conn.close()

        return {
            "total_products": total,
            "new_products": new_products,
            "recently_updated": recently_updated,
            "recent_changes": recent_changes,
            "total_changes_logged": total_changes
        }

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd bazy danych: {str(e)}"
        )


@app.get("/api/dashboard-stats")
async def get_dashboard_stats(force_refresh: bool = False):
    """
    Pobiera statystyki dla dashboardu:
    - Sprzedaż dziś i wczoraj
    - Liczba transakcji
    - Poziom zapasów
    - Alerty (dead stock)
    - Sprzedaż tygodniowa (ostatnie 7 dni)
    - Top 5 produktów

    CACHE: Wyniki cachowane przez 1 minutę
    """
    try:
        # Sprawdź cache
        if not force_refresh:
            cache_age = None
            if dashboard_stats_cache["timestamp"]:
                cache_age = time.time() - dashboard_stats_cache["timestamp"]

            # Jeśli cache jest świeży (< 1 minuta), zwróć dane z cache
            if cache_age is not None and cache_age < dashboard_stats_cache["cache_duration"]:
                cached_data = dashboard_stats_cache["data"].copy()
                cached_data["cache_info"] = {
                    "cached": True,
                    "cache_age_seconds": int(cache_age),
                    "cache_expires_in": int(dashboard_stats_cache["cache_duration"] - cache_age)
                }
                return cached_data
        # Połączenie z SQLite dla stanów magazynowych
        conn = get_db_connection()
        cursor = conn.cursor()

        # Statystyki zapasów
        cursor.execute("SELECT COUNT(*) FROM products WHERE Stan > 0")
        total_products = cursor.fetchone()[0]

        cursor.execute("SELECT SUM(Stan * DetalicznaNetto) FROM products WHERE Stan > 0")
        total_inventory_value = cursor.fetchone()[0] or 0

        conn.close()

        # Połączenie z SQL Server dla danych sprzedaży
        server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
        database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
        username = os.getenv('SQL_USERNAME', 'zestawienia2')
        password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

        try:
            sql_connection = pyodbc.connect(
                'DRIVER={ODBC Driver 18 for SQL Server};'
                f'SERVER={server};'
                f'DATABASE={database};'
                f'UID={username};'
                f'PWD={password};'
                'TrustServerCertificate=yes;'
                'Connection Timeout=30;'
            )
        except pyodbc.Error as conn_err:
            raise HTTPException(
                status_code=500,
                detail=f"Błąd połączenia z SQL Server: {str(conn_err)}"
            )

        sql_cursor = sql_connection.cursor()
        today = datetime.now().date()

        # Sprzedaż dziś
        query_today = f"""
        SELECT
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_WartBrutto ELSE ob_WartBrutto END) AS WartoscBrutto,
            COUNT(DISTINCT dok_NrPelny) as LiczbaTransakcji,
            COUNT(DISTINCT ob_TowId) as LiczbaProduktow
        FROM vwZstSprzWgKhnt
        WHERE CAST(dok_DataWyst AS DATE) = ?
            AND dok_MagId IN (1,7,9)
            AND dok_Podtyp <> 1
            AND dok_Status <> 2
        """
        sql_cursor.execute(query_today, (today,))
        today_row = sql_cursor.fetchone()

        sales_today = float(today_row[0] or 0)
        transactions_today = int(today_row[1] or 0)

        # Sprzedaż wczoraj
        yesterday = today - timedelta(days=1)
        sql_cursor.execute(query_today, (yesterday,))
        yesterday_row = sql_cursor.fetchone()
        sales_yesterday = float(yesterday_row[0] or 0)
        transactions_yesterday = int(yesterday_row[1] or 0)

        # Oblicz zmiany procentowe
        sales_change = ((sales_today - sales_yesterday) / sales_yesterday * 100) if sales_yesterday > 0 else 0
        transactions_change = ((transactions_today - transactions_yesterday) / transactions_yesterday * 100) if transactions_yesterday > 0 else 0

        # Sprzedaż tygodniowa (ostatnie 7 dni)
        query_weekly = """
        SELECT
            CAST(dok_DataWyst AS DATE) AS Data,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_WartBrutto ELSE ob_WartBrutto END) AS WartoscBrutto
        FROM vwZstSprzWgKhnt
        WHERE CAST(dok_DataWyst AS DATE) >= DATEADD(day, -7, CAST(? AS DATE))
            AND CAST(dok_DataWyst AS DATE) <= ?
            AND dok_MagId IN (1,7,9)
            AND dok_Podtyp <> 1
            AND dok_Status <> 2
        GROUP BY CAST(dok_DataWyst AS DATE)
        ORDER BY Data
        """
        sql_cursor.execute(query_weekly, (today, today))
        weekly_rows = sql_cursor.fetchall()

        # Mapowanie dni tygodnia
        day_names = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']

        # Stwórz słownik z danymi sprzedaży
        sales_by_date = {}
        for row in weekly_rows:
            sales_by_date[row[0].strftime('%Y-%m-%d')] = float(row[1] or 0)

        # Wygeneruj wszystkie 7 dni (nawet z zerową sprzedażą)
        weekly_sales = []
        for i in range(7, -1, -1):  # 7 dni wstecz do dziś (8 dni łącznie)
            day_date = today - timedelta(days=i)
            date_str = day_date.strftime('%Y-%m-%d')
            day_name = day_names[day_date.weekday()]
            sprzedaz = sales_by_date.get(date_str, 0)
            weekly_sales.append({
                "name": f"{day_name} {day_date.strftime('%d.%m')}",
                "data": date_str,
                "sprzedaz": sprzedaz
            })

        # Top 5 produktów (ostatnie 30 dni)
        query_top_products = """
        SELECT TOP 5
            MAX(tw.tw_Symbol) AS Symbol,
            MAX(tw.tw_Nazwa) AS Nazwa,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_WartBrutto ELSE ob_WartBrutto END) AS WartoscSprzedazy,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_IloscMag ELSE ob_IloscMag END) AS IloscSprzedana
        FROM vwZstSprzWgKhnt
        LEFT JOIN tw__Towar tw ON ob_TowId = tw.tw_Id
        WHERE CAST(dok_DataWyst AS DATE) >= DATEADD(day, -30, CAST(? AS DATE))
            AND dok_MagId IN (1,7,9)
            AND dok_Podtyp <> 1
            AND dok_Status <> 2
        GROUP BY ob_TowId
        ORDER BY WartoscSprzedazy DESC
        """
        sql_cursor.execute(query_top_products, (today,))
        top_products_rows = sql_cursor.fetchall()

        top_products = []
        for row in top_products_rows:
            top_products.append({
                "symbol": row[0] or "N/A",
                "nazwa": (row[1] or "")[:30],  # Skróć nazwę do 30 znaków
                "sprzedaz": float(row[2] or 0),
                "ilosc": float(row[3] or 0)
            })

        sql_cursor.close()
        sql_connection.close()

        # Statystyki per magazyn (dziś)
        query_per_warehouse = """
        SELECT
            dok_MagId,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_WartBrutto ELSE ob_WartBrutto END) AS WartoscBrutto,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_IloscMag ELSE ob_IloscMag END) AS IloscSprzedana,
            COUNT(DISTINCT dok_NrPelny) as LiczbaTransakcji,
            COUNT(DISTINCT ob_TowId) as LiczbaProduktow
        FROM vwZstSprzWgKhnt
        WHERE CAST(dok_DataWyst AS DATE) = ?
            AND dok_MagId IN (1,2,7,9)
            AND dok_Podtyp <> 1
            AND dok_Status <> 2
        GROUP BY dok_MagId
        """

        sql_connection = pyodbc.connect(
            'DRIVER={ODBC Driver 18 for SQL Server};'
            f'SERVER={server};'
            f'DATABASE={database};'
            f'UID={username};'
            f'PWD={password};'
            'TrustServerCertificate=yes;'
            'Connection Timeout=30;'
        )
        sql_cursor = sql_connection.cursor()
        sql_cursor.execute(query_per_warehouse, (today,))
        warehouse_rows = sql_cursor.fetchall()

        warehouse_names = {1: 'GLS', 2: '4F', 7: 'JEANS'}

        # Utwórz słownik z danymi sprzedaży per magazyn
        sales_by_warehouse = {}
        for row in warehouse_rows:
            mag_id = row[0]
            wartość = float(row[1] or 0)
            ilosc = float(row[2] or 0)
            transakcje = int(row[3] or 0)
            produkty = int(row[4] or 0)

            sales_by_warehouse[mag_id] = {
                "wartość": wartość,
                "ilosc": ilosc,
                "transakcje": transakcje,
                "produkty": produkty
            }

        # Stwórz listę wszystkich magazynów (nawet bez sprzedaży)
        warehouse_stats = []
        for mag_id, nazwa in warehouse_names.items():
            sales = sales_by_warehouse.get(mag_id, {
                "wartość": 0,
                "ilosc": 0,
                "transakcje": 0,
                "produkty": 0
            })

            wartość = sales["wartość"]
            ilosc = sales["ilosc"]
            transakcje = sales["transakcje"]
            produkty = sales["produkty"]

            # Oblicz UPT (Units Per Transaction)
            upt = round(ilosc / transakcje, 2) if transakcje > 0 else 0

            # Oblicz średnią wartość transakcji
            avg_transaction = round(wartość / transakcje, 2) if transakcje > 0 else 0

            warehouse_stats.append({
                "mag_id": mag_id,
                "nazwa": nazwa,
                "sprzedaz": round(wartość, 2),
                "ilosc_sprzedana": round(ilosc, 0),
                "transakcje": transakcje,
                "produkty": produkty,
                "upt": upt,
                "avg_transaction": avg_transaction
            })

        sql_cursor.close()
        sql_connection.close()

        # Zlicz alerty (produkty dead stock)
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM products WHERE Stan > 0")
        products_with_stock = cursor.fetchone()[0]
        conn.close()

        # Zwróć wszystkie statystyki
        result = {
            "sales_today": round(sales_today, 2),
            "sales_yesterday": round(sales_yesterday, 2),
            "sales_change": round(sales_change, 1),
            "transactions_today": transactions_today,
            "transactions_yesterday": transactions_yesterday,
            "transactions_change": round(transactions_change, 1),
            "inventory_count": total_products,
            "inventory_value": round(total_inventory_value, 2),
            "alerts_count": 0,  # TODO: Oblicz z dead stock
            "alerts_critical": 0,  # TODO: Oblicz z dead stock
            "weekly_sales": weekly_sales,
            "top_products": top_products,
            "warehouse_stats": warehouse_stats,
            "cache_info": {
                "cached": False,
                "generated_at": datetime.now().isoformat()
            }
        }

        # Zapisz do cache
        dashboard_stats_cache["data"] = result.copy()
        dashboard_stats_cache["timestamp"] = time.time()

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas pobierania statystyk dashboardu: {str(e)}"
        )



@app.get("/api/dead-stock")
async def get_dead_stock(
    min_days: Optional[int] = 0,
    min_value: Optional[float] = 0,
    category: Optional[str] = None,  # Rodzaj produktu
    marka: Optional[str] = None,
    rotation_status: Optional[str] = None,  # NEW, VERY_FAST, FAST, NORMAL, SLOW, VERY_SLOW, DEAD
    sort_by: Optional[str] = "frozen_value",
    mag_ids: Optional[str] = None,
    force_refresh: bool = False
):
    """
    ZOPTYMALIZOWANY endpoint - czyta z pamięci cache (natychmiastowa odpowiedź).
    Dane są ładowane przy starcie serwera i aktualizowane w tle.

    Parametry:
    - min_days: Minimum dni bez ruchu
    - min_value: Minimalna wartość zamrożonego kapitału
    - category: Filtrowanie po kategorii (Rodzaj produktu)
    - marka: Filtrowanie po marce
    - rotation_status: Filtrowanie po statusie rotacji
    - sort_by: Sortowanie (days_no_movement, frozen_value, dni_zapasu)
    """

    # Sprawdź czy mamy dane w cache
    cache_data = global_data_cache["dead_stock"]["data"]

    if cache_data is not None and not force_refresh:
        cache_age = (datetime.now() - global_data_cache["dead_stock"]["timestamp"]).total_seconds()
        print(f"[CACHE HIT] dead-stock - wiek cache: {cache_age:.0f}s")

        # Filtruj dane z cache w pamięci
        items = cache_data["items"]

        # Zastosuj filtry
        if min_days > 0:
            items = [i for i in items if i.get('DaysNoMovement', 0) >= min_days]
        if min_value > 0:
            items = [i for i in items if i.get('FrozenValue', 0) >= min_value]
        if category:
            items = [i for i in items if i.get('Rodzaj') == category]
        if marka:
            items = [i for i in items if i.get('Marka') == marka]
        if rotation_status:
            items = [i for i in items if i.get('Category', '').upper() == rotation_status.upper()]

        # Sortowanie
        sort_key_map = {
            "days_no_movement": lambda x: x.get('DaysNoMovement', 0),
            "frozen_value": lambda x: x.get('FrozenValue', 0),
            "dni_zapasu": lambda x: x.get('DniZapasu', 0)
        }
        sort_func = sort_key_map.get(sort_by, sort_key_map["frozen_value"])
        items = sorted(items, key=sort_func, reverse=True)

        # Oblicz średnią
        avg_days = sum(item.get('DaysNoMovement', 0) for item in items) / len(items) if items else 0

        return {
            "total_items": len(items),
            "total_frozen_value": cache_data["total_frozen_value"],
            "avg_days_no_movement": round(avg_days, 1),
            "category_stats": cache_data["category_stats"],
            "filters": {
                "min_days": min_days,
                "min_value": min_value,
                "category": category,
                "sort_by": sort_by,
                "mag_ids": mag_ids or "1,2,7,9"
            },
            "items": items,
            "cache_info": {
                "last_update": global_data_cache["dead_stock"]["timestamp"].isoformat() if global_data_cache["dead_stock"]["timestamp"] else None,
                "is_cached": True,
                "cache_age_seconds": round(cache_age)
            }
        }

    # Fallback do bazy danych jeśli cache pusty
    try:
        print("[CACHE MISS] dead-stock - ładowanie z bazy...")
        conn = get_db_connection()
        cursor = conn.cursor()

        sql_query = "SELECT * FROM dead_stock_analysis WHERE 1=1"
        params = []

        if min_days > 0:
            sql_query += " AND DaysNoMovement >= ?"
            params.append(min_days)
        if min_value > 0:
            sql_query += " AND FrozenValue >= ?"
            params.append(min_value)
        if category:
            sql_query += " AND Rodzaj = ?"
            params.append(category)
        if marka:
            sql_query += " AND Marka = ?"
            params.append(marka)
        if rotation_status:
            sql_query += " AND Category = ?"
            params.append(rotation_status.upper())

        sort_column = {
            "days_no_movement": "DaysNoMovement DESC",
            "frozen_value": "FrozenValue DESC",
            "dni_zapasu": "DniZapasu DESC"
        }.get(sort_by, "DaysNoMovement DESC")

        sql_query += f" ORDER BY {sort_column}"

        cursor.execute(sql_query, params)
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description]

        items = [dict(zip(columns, row)) for row in rows]

        cursor.execute("""
            SELECT Category, COUNT(*) as count, SUM(FrozenValue) as total_value
            FROM dead_stock_analysis GROUP BY Category
        """)
        category_stats_raw = cursor.fetchall()

        category_stats = {
            "NEW": 0, "NEW_NO_SALES": 0, "NEW_SELLING": 0, "NEW_SLOW": 0,
            "REPEATED_NO_SALES": 0, "VERY_FAST": 0, "FAST": 0, "NORMAL": 0,
            "SLOW": 0, "VERY_SLOW": 0, "DEAD": 0
        }

        total_frozen_value = 0
        for cat_row in category_stats_raw:
            cat_name, cat_count, cat_value = cat_row[0], cat_row[1], cat_row[2] or 0
            if cat_name in category_stats:
                category_stats[cat_name] = cat_count
            total_frozen_value += cat_value

        avg_days = sum(item.get('DaysNoMovement', 0) for item in items) / len(items) if items else 0

        conn.close()

        return {
            "total_items": len(items),
            "total_frozen_value": round(total_frozen_value, 2),
            "avg_days_no_movement": round(avg_days, 1),
            "category_stats": category_stats,
            "filters": {
                "min_days": min_days,
                "min_value": min_value,
                "category": category,
                "sort_by": sort_by,
                "mag_ids": mag_ids or "1,2,7,9"
            },
            "items": items,
            "cache_info": {
                "last_update": items[0].get('LastAnalysisUpdate') if items else None,
                "is_cached": False
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas pobierania analizy dead stock: {str(e)}"
        )


@app.get("/api/warehouse-rotation-value")
async def get_warehouse_rotation_value():
    """
    Zwraca analizę rotacji magazynu pod kątem wartości.
    Pokazuje wartość zamrożonego kapitału w każdej kategorii rotacji.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Pobierz agregowane dane według kategorii
        cursor.execute("""
            SELECT
                Category,
                COUNT(*) as ProductCount,
                SUM(FrozenValue) as TotalValue,
                SUM(Stan) as TotalQuantity,
                AVG(DaysNoMovement) as AvgDaysNoMovement,
                AVG(DniZapasu) as AvgDaysOfStock
            FROM dead_stock_analysis
            GROUP BY Category
            ORDER BY TotalValue DESC
        """)

        category_rows = cursor.fetchall()

        categories = []
        total_warehouse_value = 0
        total_products = 0

        for row in category_rows:
            category_data = {
                "category": row[0],
                "product_count": row[1],
                "total_value": round(row[2] or 0, 2),
                "total_quantity": round(row[3] or 0, 2),
                "avg_days_no_movement": round(row[4] or 0, 1),
                "avg_days_of_stock": round(row[5] or 0, 1) if row[5] else None
            }
            categories.append(category_data)
            total_warehouse_value += category_data["total_value"]
            total_products += category_data["product_count"]

        # Dodaj procenty
        for cat in categories:
            cat["value_percentage"] = round((cat["total_value"] / total_warehouse_value * 100), 1) if total_warehouse_value > 0 else 0
            cat["product_percentage"] = round((cat["product_count"] / total_products * 100), 1) if total_products > 0 else 0

        # Pobierz top 10 produktów według wartości w każdej kategorii
        top_products_by_category = {}

        for cat in categories:
            cursor.execute("""
                SELECT Symbol, Nazwa, Marka, Stan, FrozenValue, DaysNoMovement, DateAdded
                FROM dead_stock_analysis
                WHERE Category = ?
                ORDER BY FrozenValue DESC
                LIMIT 10
            """, (cat["category"],))

            products = []
            for p in cursor.fetchall():
                products.append({
                    "symbol": p[0],
                    "nazwa": p[1],
                    "marka": p[2],
                    "stan": p[3],
                    "frozen_value": round(p[4], 2),
                    "days_no_movement": p[5],
                    "date_added": p[6]
                })

            top_products_by_category[cat["category"]] = products

        # Rekomendacje akcji
        recommendations = []

        for cat in categories:
            if cat["category"] == "DEAD":
                recommendations.append({
                    "category": "DEAD",
                    "priority": "KRYTYCZNY",
                    "action": f"Wyprzedaż - {cat['product_count']} produktów zamrożonych na {cat['total_value']:.0f} PLN",
                    "impact": f"Uwolnienie {cat['total_value']:.0f} PLN kapitału"
                })
            elif cat["category"] == "VERY_SLOW":
                recommendations.append({
                    "category": "VERY_SLOW",
                    "priority": "WYSOKI",
                    "action": f"Promocje - {cat['product_count']} produktów, wartość {cat['total_value']:.0f} PLN",
                    "impact": f"Przyspieszenie rotacji, uwolnienie {cat['total_value'] * 0.5:.0f} PLN"
                })
            elif cat["category"] == "SLOW":
                recommendations.append({
                    "category": "SLOW",
                    "priority": "ŚREDNI",
                    "action": f"Monitoring - {cat['product_count']} produktów, wartość {cat['total_value']:.0f} PLN",
                    "impact": "Zapobieganie przejściu do VERY_SLOW"
                })
            elif cat["category"] == "VERY_FAST" or cat["category"] == "FAST":
                recommendations.append({
                    "category": cat["category"],
                    "priority": "POZYTYWNY",
                    "action": f"Zwiększ zamówienia - {cat['product_count']} bestsellerów",
                    "impact": f"Optymalizacja {cat['total_value']:.0f} PLN kapitału obrotowego"
                })

        conn.close()

        return {
            "total_warehouse_value": round(total_warehouse_value, 2),
            "total_products": total_products,
            "categories": categories,
            "top_products_by_category": top_products_by_category,
            "recommendations": recommendations,
            "last_update": categories[0].get("last_update") if categories else None
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas analizy rotacji magazynu: {str(e)}"
        )


@app.get("/api/sales-plans")
async def get_sales_plans(
    sync: bool = False,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Zwraca plany sprzedażowe z bazy danych
    - sync: jeśli True, synchronizuje dane z Google Sheets przed zwróceniem
    - start_date: opcjonalna data początkowa (format: DD.MM.YYYY)
    - end_date: opcjonalna data końcowa (format: DD.MM.YYYY)
    """
    try:
        # Jeśli sync=True, zsynchronizuj z Google Sheets
        if sync:
            success = sync_sales_plans_from_google()
            if not success:
                raise HTTPException(
                    status_code=500,
                    detail="Nie udało się zsynchronizować danych z Google Sheets"
                )

        # Pobierz plany z bazy danych
        plans = get_sales_plans_from_db(start_date, end_date)

        if not plans:
            raise HTTPException(
                status_code=404,
                detail="Brak danych planów sprzedażowych w bazie"
            )

        # Oblicz statystyki
        total_gls = sum(p['gls'] for p in plans)
        total_4f = sum(p['four_f'] for p in plans)
        total_jeans = sum(p['jeans'] for p in plans)
        total_all = sum(p['total'] for p in plans)

        return {
            "success": True,
            "count": len(plans),
            "summary": {
                "total_gls": round(total_gls, 2),
                "total_4f": round(total_4f, 2),
                "total_jeans": round(total_jeans, 2),
                "total_all": round(total_all, 2),
                "avg_daily_gls": round(total_gls / len(plans), 2) if plans else 0,
                "avg_daily_4f": round(total_4f / len(plans), 2) if plans else 0,
                "avg_daily_jeans": round(total_jeans / len(plans), 2) if plans else 0,
                "avg_daily_all": round(total_all / len(plans), 2) if plans else 0
            },
            "plans": plans
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas pobierania planów: {str(e)}"
        )


@app.get("/api/store-metrics")
async def get_store_metrics():
    """
    Pobiera metryki TYLKO dla 4F z Google Sheets (zakładka PANEL_ZARZADZANIA):
    - Paragony (transakcje)
    - UPT (Units Per Transaction)
    - Konwersja
    - Wynik
    - Wejścia
    - Sztuki

    Dane 4F są w komórkach B123:C128 (6 wierszy):
    0: WYNIK
    1: WEJSCIA
    2: SZTUKI
    3: PARAGONY
    4: UPT
    5: KONWERSJA

    GLS i JEANS pobierają dane z bazy SQL (dashboard-stats).
    """
    try:
        SHEET_ID = "1j1hBF_QfN5wL1f2jUO4HKUlbPy_W914cDaHgUWZP2cI"
        SHEET_NAME = "PANEL_ZARZADZANIA"
        # Pobierz TYLKO zakres B123:C128 który zawiera dane 4F (6 wierszy)
        url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={SHEET_NAME}&range=B123:C128"

        response = requests.get(url, timeout=10)
        response.raise_for_status()

        # Parsuj CSV - użyj modułu csv żeby poprawnie obsłużyć przecinki w wartościach
        import csv as csv_module
        from io import StringIO as SIO
        lines = list(csv_module.reader(SIO(response.text)))

        # Funkcja parsowania wartości
        def parse_value(val):
            if not val or val.strip() == '' or val.strip() == '""':
                return 0
            # Usuń cudzysłowy i zamień przecinek dziesiętny na kropkę
            val = val.strip().strip('"').replace(',', '.').replace(' ', '')
            try:
                return float(val)
            except:
                return 0

        # Struktura danych 4F (6 wierszy) - kolejność z arkusza:
        # 0: WYNIK, 1: WEJSCIA, 2: SZTUKI, 3: PARAGONY, 4: UPT, 5: KONWERSJA
        metric_names = ['wynik', 'wejscia', 'sztuki', 'paragony', 'upt', 'konwersja']

        store_4f = {"jednostka": "4F"}

        for idx, metric_name in enumerate(metric_names):
            if idx < len(lines):
                row = lines[idx]
                if len(row) >= 2:
                    value = parse_value(row[1])

                    if metric_name == 'paragony':
                        store_4f['paragony'] = int(value)
                    elif metric_name == 'upt':
                        store_4f['upt'] = round(value, 2)
                    elif metric_name == 'konwersja':
                        # Konwersja jest jako ułamek (0.17), zamień na procent (17)
                        store_4f['konwersja'] = round(value * 100, 2) if value < 1 else round(value, 2)
                    elif metric_name == 'wynik':
                        store_4f['wynik'] = round(value, 2)
                    elif metric_name == 'wejscia':
                        store_4f['wejscia'] = int(value)
                    elif metric_name == 'sztuki':
                        store_4f['sztuki'] = int(value)

        return {
            "success": True,
            "metrics": {
                "4F": store_4f
            }
        }

    except Exception as e:
        print(f"[ERROR] Błąd pobierania metryk 4F: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "metrics": {}
        }


@app.get("/api/sales-plans/today")
async def get_today_sales_plan(sync: bool = False):
    """
    Zwraca plan sprzedażowy na dzisiaj z bazy danych
    - sync: jeśli True, synchronizuje dane z Google Sheets przed zwróceniem
    """
    try:
        # Jeśli sync=True, zsynchronizuj z Google Sheets
        if sync:
            sync_sales_plans_from_google()

        # Pobierz plan na dzisiaj z bazy danych
        today = datetime.now().strftime('%d.%m.%Y')

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT date, gls, four_f, jeans, total
            FROM sales_plans
            WHERE date = ?
        """, (today,))

        row = cursor.fetchone()
        conn.close()

        if row:
            today_plan = {
                "date": row[0],
                "gls": float(row[1]),
                "four_f": float(row[2]),
                "jeans": float(row[3]),
                "total": float(row[4])
            }
        else:
            # Jeśli nie ma planu na dzisiaj, zwróć zerowe wartości
            today_plan = {
                "date": today,
                "gls": 0,
                "four_f": 0,
                "jeans": 0,
                "total": 0,
                "note": "Brak planu na dzisiaj w bazie danych"
            }

        return {
            "success": True,
            "plan": today_plan
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas pobierania planu na dziś: {str(e)}"
        )


@app.post("/api/sales-plans/sync")
async def sync_sales_plans():
    """
    Wymusza synchronizację danych z Google Sheets do bazy danych
    - Dodaje nowe daty
    - Aktualizuje istniejące wartości jeśli się zmieniły
    - Pomija rekordy bez zmian
    """
    try:
        success = sync_sales_plans_from_google()

        if success:
            # Pobierz aktualne dane z bazy
            plans = get_sales_plans_from_db()
            return {
                "success": True,
                "message": "Dane zostały zsynchronizowane z Google Sheets",
                "count": len(plans)
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Nie udało się zsynchronizować danych z Google Sheets"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas synchronizacji danych: {str(e)}"
        )


@app.get("/api/purchase-proposals")
async def get_purchase_proposals(min_stock_days: int = 30, force_refresh: bool = False):
    """
    Zwraca propozycje zakupowe dla suplementów.
    Oblicza stan minimalny na podstawie średniego zużycia przez ostatnie 90 dni.

    Parametry:
    - min_stock_days: liczba dni zapasu do obliczenia stanu minimalnego (domyślnie 30)
    - force_refresh: wymusza odświeżenie cache (domyślnie False)

    Zwraca produkty z przeznaczenia "SUPLEMENTY" z informacjami:
    - Aktualny stan
    - Średnie dzienne zużycie (ostatnie 90 dni)
    - Stan minimalny (średnie zużycie * min_stock_days)
    - Różnica (stan - stan minimalny)
    - Status: PONIŻEJ / OK / NADMIAR

    CACHE: Wyniki są cachowane przez 10 minut dla lepszej wydajności
    """
    try:
        # Sprawdź cache (tylko dla min_stock_days=30 - domyślna wartość)
        if not force_refresh and min_stock_days == 30:
            cache_age = None
            if purchase_proposals_cache["timestamp"]:
                cache_age = time.time() - purchase_proposals_cache["timestamp"]

            # Jeśli cache jest świeży (< 10 minut), zwróć dane z cache
            if cache_age is not None and cache_age < purchase_proposals_cache["cache_duration"]:
                cached_data = purchase_proposals_cache["data"].copy()
                cached_data["cache_info"] = {
                    "cached": True,
                    "cache_age_seconds": int(cache_age),
                    "cache_expires_in": int(purchase_proposals_cache["cache_duration"] - cache_age)
                }
                return cached_data
        # Połączenie z SQLite dla stanów magazynowych
        conn = get_db_connection()
        cursor = conn.cursor()

        # Pobierz produkty z przeznaczenia "SUPLEMENTY" z niestandardowymi parametrami jeśli istnieją
        cursor.execute("""
            SELECT p.Symbol, p.Nazwa, p.Stan, p.DetalicznaNetto, p.DetalicznaBrutto,
                   p.Marka, p.Rozmiar, p.Przeznaczenie, p.JM,
                   c.delivery_time_days, c.order_frequency_days, c.optimal_order_quantity, c.notes,
                   p.CenaZakupuNetto, p.StawkaVAT
            FROM products p
            LEFT JOIN custom_stock_periods c ON p.Symbol = c.symbol
            WHERE UPPER(p.Przeznaczenie) = 'SUPLEMENTY'
            AND p.Stan >= 0
        """)
        products = cursor.fetchall()
        conn.close()

        if not products:
            return {
                "success": True,
                "total_items": 0,
                "items": [],
                "summary": {
                    "total_products": 0,
                    "products_below_minimum": 0,
                    "products_ok": 0,
                    "products_excess": 0,
                    "total_purchase_value": 0
                }
            }

        # Połączenie z SQL Server dla historii sprzedaży
        server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
        database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
        username = os.getenv('SQL_USERNAME', 'zestawienia2')
        password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

        try:
            sql_connection = pyodbc.connect(
                'DRIVER={ODBC Driver 18 for SQL Server};'
                f'SERVER={server};'
                f'DATABASE={database};'
                f'UID={username};'
                f'PWD={password};'
                'TrustServerCertificate=yes;'
                'Connection Timeout=30;'
            )
        except pyodbc.Error as conn_err:
            raise HTTPException(
                status_code=500,
                detail=f"Błąd połączenia z SQL Server: {str(conn_err)}"
            )

        sql_cursor = sql_connection.cursor()

        # Pobierz sprzedaż z ostatnich 90 dni dla suplementów
        sales_query = """
        WITH FilteredTowar AS (
            SELECT tw_Id, tw_Symbol
            FROM tw__Towar
            WHERE UPPER(tw_pole7) = 'SUPLEMENTY'
        )
        SELECT
            MAX(FilteredTowar.tw_Symbol) AS Symbol,
            SUM(CASE
                    WHEN dok_Typ IN (14, 6) THEN -ob_IloscMag
                    ELSE ob_IloscMag
                END) AS IloscSprzedana
        FROM vwZstSprzWgKhnt
        LEFT JOIN FilteredTowar ON ob_TowId = FilteredTowar.tw_Id
        WHERE
            CAST(dok_DataWyst AS DATE) >= DATEADD(day, -90, CAST(GETDATE() AS DATE))
            AND dok_MagId IN (1,2,7,9)
            AND dok_Podtyp <> 1
            AND dok_Status <> 2
        GROUP BY ob_TowId
        """

        try:
            sql_cursor.execute(sales_query)
            sales_rows = sql_cursor.fetchall()
        except Exception as e:
            sql_cursor.close()
            sql_connection.close()
            raise HTTPException(
                status_code=500,
                detail=f"Błąd zapytania SQL: {str(e)}"
            )

        # Konwertuj dane sprzedaży na słownik
        sales_data = {}
        for row in sales_rows:
            symbol = row[0]
            if symbol:
                sales_data[symbol] = float(row[1] or 0)

        sql_cursor.close()
        sql_connection.close()

        # Przygotuj propozycje zakupowe
        proposals = []
        products_below_minimum = 0
        products_ok = 0
        products_excess = 0
        total_purchase_value = 0

        for product in products:
            product_dict = dict(product)
            symbol = product_dict.get('Symbol')
            stan = float(product_dict.get('Stan') or 0)

            # Pobierz parametry: czas dostawy, częstotliwość zamawiania, optymalna wielkość partii
            delivery_time = product_dict.get('delivery_time_days')
            order_frequency = product_dict.get('order_frequency_days')
            optimal_quantity = product_dict.get('optimal_order_quantity')
            custom_notes = product_dict.get('notes')

            # Użyj domyślnych wartości jeśli nie ma niestandardowych
            delivery_time_days = delivery_time if delivery_time is not None else 7  # Domyślnie 7 dni dostawy
            order_frequency_days = order_frequency if order_frequency is not None else min_stock_days  # Domyślnie z parametru
            optimal_order_quantity = optimal_quantity if optimal_quantity is not None else 0

            # Pobierz sprzedaż z ostatnich 90 dni
            sales_90_days = sales_data.get(symbol, 0)

            # Oblicz średnie dzienne zużycie (sprzedaż / 90 dni)
            avg_daily_usage = sales_90_days / 90.0 if sales_90_days > 0 else 0

            # NOWA LOGIKA: Stan minimalny = (Czas dostawy + Częstotliwość zamawiania) × Średnie dzienne zużycie
            min_stock = avg_daily_usage * (delivery_time_days + order_frequency_days)

            # Oblicz różnicę
            difference = stan - min_stock

            # Określ status
            if difference < 0:
                status = "PONIŻEJ"
                status_color = "red"
                products_below_minimum += 1
            elif difference < min_stock * 0.2:  # Mniej niż 20% powyżej minimum
                status = "OK"
                status_color = "green"
                products_ok += 1
            else:
                status = "NADMIAR"
                status_color = "blue"
                products_excess += 1

            # Oblicz ile trzeba zamówić (jeśli poniżej minimum)
            # Zaokrąglij zawsze do góry jeśli są liczby po przecinku
            quantity_to_order = math.ceil(abs(difference)) if difference < 0 else 0

            # Pobierz ceny detaliczne
            price_detaliczna_netto = float(product_dict.get('DetalicznaNetto') or 0)
            price_detaliczna_brutto = float(product_dict.get('DetalicznaBrutto') or 0)

            # Pobierz cenę zakupu (tc_CenaMag z bazy) i VAT
            cena_zakupu_netto = float(product_dict.get('CenaZakupuNetto') or 0)
            stawka_vat = float(product_dict.get('StawkaVAT') or 0)

            # Jeśli brak stawki VAT, oblicz ją z cen detalicznych
            if stawka_vat == 0 and price_detaliczna_netto > 0 and price_detaliczna_brutto > 0:
                stawka_vat = ((price_detaliczna_brutto / price_detaliczna_netto) - 1) * 100

            # Oblicz cenę zakupu brutto (cena zakupu netto * (1 + VAT/100))
            if cena_zakupu_netto > 0:
                cena_zakupu_brutto = cena_zakupu_netto * (1 + stawka_vat / 100)
            else:
                # Fallback: cena magazynowa (tc_CenaMag) jest niedostępna w bazie
                # Użyj 60% ceny detalicznej jako oszacowanie ceny zakupu
                cena_zakupu_netto = price_detaliczna_netto * 0.6
                if stawka_vat == 0:
                    stawka_vat = 23.0  # Domyślna stawka VAT
                cena_zakupu_brutto = cena_zakupu_netto * (1 + stawka_vat / 100)

            # Oblicz wartość zamówienia: ilość do zamówienia × cena zakupu brutto
            order_value = quantity_to_order * cena_zakupu_brutto

            if quantity_to_order > 0:
                total_purchase_value += order_value

            proposals.append({
                "Symbol": symbol,
                "Nazwa": product_dict.get('Nazwa', ''),
                "Marka": product_dict.get('Marka', ''),
                "Rozmiar": product_dict.get('Rozmiar', ''),
                "JM": product_dict.get('JM', 'szt.'),
                "Stan": round(stan, 2),
                "Sprzedaz90Dni": round(sales_90_days, 2),
                "SrednieDzienneZuzycie": round(avg_daily_usage, 2),
                "StanMinimalny": round(min_stock, 2),
                "Roznica": round(difference, 2) if abs(difference) >= 0.01 else 0,
                "Status": status,
                "StatusColor": status_color,
                "IloscDoZamowienia": int(quantity_to_order),  # Liczba całkowita
                "CenaZakupuNetto": round(cena_zakupu_netto, 2),
                "CenaZakupuBrutto": round(cena_zakupu_brutto, 2),
                "StawkaVAT": round(stawka_vat, 2),
                "WartoscZamowienia": round(order_value, 2),
                "CenaDetalicznaNetto": round(price_detaliczna_netto, 2),
                "CenaDetalicznaBrutto": round(price_detaliczna_brutto, 2),
                # Nowe pola
                "CzasDostawy": delivery_time_days,
                "CzestotliwoscZamawiania": order_frequency_days,
                "OptymalnaWielkoscPartii": optimal_order_quantity,
                "CustomNotes": custom_notes
            })

        # Sortuj: najpierw poniżej minimum, potem po największej różnicy
        proposals.sort(key=lambda x: (
            0 if x["Status"] == "PONIŻEJ" else 1 if x["Status"] == "OK" else 2,
            x["Roznica"]
        ))

        result = {
            "success": True,
            "total_items": len(proposals),
            "min_stock_days": min_stock_days,
            "items": proposals,
            "summary": {
                "total_products": len(proposals),
                "products_below_minimum": products_below_minimum,
                "products_ok": products_ok,
                "products_excess": products_excess,
                "total_purchase_value": round(total_purchase_value, 2)
            },
            "cache_info": {
                "cached": False,
                "generated_at": datetime.now().isoformat()
            }
        }

        # Zapisz do cache (tylko dla min_stock_days=30)
        if min_stock_days == 30:
            purchase_proposals_cache["data"] = result.copy()
            purchase_proposals_cache["timestamp"] = time.time()

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas generowania propozycji zakupowych: {str(e)}"
        )


@app.post("/api/purchase-proposals/custom-period")
async def save_custom_stock_period(
    symbol: str,
    delivery_time_days: int = 7,
    order_frequency_days: int = 14,
    optimal_order_quantity: int = 0,
    notes: str = None
):
    """
    Zapisuje niestandardowe parametry zapasu dla produktu.

    Parametry:
    - symbol: symbol produktu
    - delivery_time_days: czas dostawy w dniach (1-365)
    - order_frequency_days: częstotliwość zamawiania w dniach (1-365)
    - optimal_order_quantity: optymalna wielkość partii zakupowej
    - notes: opcjonalna notatka
    """
    try:
        # Walidacja
        if not symbol or symbol.strip() == "":
            raise HTTPException(status_code=400, detail="Symbol produktu jest wymagany")

        if delivery_time_days < 1 or delivery_time_days > 365:
            raise HTTPException(status_code=400, detail="Czas dostawy musi być między 1 a 365 dni")

        if order_frequency_days < 1 or order_frequency_days > 365:
            raise HTTPException(status_code=400, detail="Częstotliwość zamawiania musi być między 1 a 365 dni")

        conn = get_db_connection()
        cursor = conn.cursor()

        # Sprawdź czy produkt istnieje
        cursor.execute("SELECT Symbol FROM products WHERE Symbol = ?", (symbol,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail=f"Produkt {symbol} nie istnieje")

        # Zapisz lub zaktualizuj niestandardowe parametry
        cursor.execute("""
            INSERT INTO custom_stock_periods (
                symbol, delivery_time_days, order_frequency_days, optimal_order_quantity, notes, updated_at
            )
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(symbol) DO UPDATE SET
                delivery_time_days = excluded.delivery_time_days,
                order_frequency_days = excluded.order_frequency_days,
                optimal_order_quantity = excluded.optimal_order_quantity,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP
        """, (symbol, delivery_time_days, order_frequency_days, optimal_order_quantity, notes))

        conn.commit()
        conn.close()

        # Inwaliduj cache po zapisaniu
        purchase_proposals_cache["timestamp"] = None
        purchase_proposals_cache["data"] = None

        return {
            "success": True,
            "message": f"Zapisano parametry dla produktu {symbol}",
            "data": {
                "symbol": symbol,
                "delivery_time_days": delivery_time_days,
                "order_frequency_days": order_frequency_days,
                "optimal_order_quantity": optimal_order_quantity,
                "notes": notes
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas zapisywania niestandardowego okresu: {str(e)}"
        )


@app.delete("/api/purchase-proposals/custom-period/{symbol}")
async def delete_custom_stock_period(symbol: str):
    """
    Usuwa niestandardowy okres zapasu dla produktu.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("DELETE FROM custom_stock_periods WHERE symbol = ?", (symbol,))
        rows_deleted = cursor.rowcount

        conn.commit()
        conn.close()

        # Inwaliduj cache po usunięciu
        purchase_proposals_cache["timestamp"] = None
        purchase_proposals_cache["data"] = None

        if rows_deleted == 0:
            return {
                "success": True,
                "message": f"Brak niestandardowego okresu dla produktu {symbol}"
            }

        return {
            "success": True,
            "message": f"Usunięto niestandardowy okres dla produktu {symbol}"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas usuwania niestandardowego okresu: {str(e)}"
        )


@app.get("/api/product-seasonality")
async def get_product_seasonality():
    """
    Oblicza sezonowość produktów na podstawie współczynnika zmienności (CV) sprzedaży miesięcznej.

    CV = Odchylenie standardowe / Średnia

    Klasyfikacja:
    - Stabilny (Całoroczny): CV < 0.2 (poniżej 20%)
    - Zmienny popyt: CV 0.2 - 0.5 (20% - 50%)
    - Sezonowy (nieregularny): CV > 0.5 (powyżej 50%)

    Dane: sprzedaż miesięczna z ostatnich 12 miesięcy
    """
    try:
        # Połączenie z SQL Server
        server = os.getenv('SQL_SERVER', '10.10.1.5\\SUBIEKT')
        database = os.getenv('SQL_DATABASE', 'Nexo_Wilczek')
        username = os.getenv('SQL_USERNAME', 'sa')
        password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

        sql_connection = pyodbc.connect(
            'DRIVER={ODBC Driver 18 for SQL Server};'
            f'SERVER={server};'
            f'DATABASE={database};'
            f'UID={username};'
            f'PWD={password};'
            'TrustServerCertificate=yes;'
            'Connection Timeout=30;'
        )
        sql_cursor = sql_connection.cursor()

        # Pobierz sprzedaż miesięczną dla każdego produktu z ostatnich 12 miesięcy
        query = """
        SELECT
            tw.tw_Symbol AS Symbol,
            YEAR(dok_DataWyst) AS Rok,
            MONTH(dok_DataWyst) AS Miesiac,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_IloscMag ELSE ob_IloscMag END) AS IloscSprzedana
        FROM vwZstSprzWgKhnt
        LEFT JOIN tw__Towar tw ON ob_TowId = tw.tw_Id
        WHERE dok_DataWyst >= DATEADD(month, -12, GETDATE())
            AND dok_MagId IN (1,7,9)
            AND dok_Podtyp <> 1
            AND dok_Status <> 2
        GROUP BY tw.tw_Symbol, YEAR(dok_DataWyst), MONTH(dok_DataWyst)
        ORDER BY tw.tw_Symbol, Rok, Miesiac
        """

        sql_cursor.execute(query)
        rows = sql_cursor.fetchall()
        sql_cursor.close()
        sql_connection.close()

        # Grupuj sprzedaż miesięczną po symbolu
        sales_by_product = {}
        for row in rows:
            symbol = row[0]
            ilosc = float(row[3] or 0)

            if symbol not in sales_by_product:
                sales_by_product[symbol] = []
            sales_by_product[symbol].append(ilosc)

        # Oblicz CV dla każdego produktu
        seasonality_data = {}
        for symbol, monthly_sales in sales_by_product.items():
            if len(monthly_sales) < 2:
                # Za mało danych - oznacz jako brak danych
                seasonality_data[symbol] = {
                    "cv": None,
                    "category": "BRAK_DANYCH",
                    "monthly_sales": monthly_sales,
                    "avg": 0,
                    "std": 0
                }
                continue

            # Oblicz średnią
            avg = sum(monthly_sales) / len(monthly_sales)

            if avg == 0:
                # Brak sprzedaży
                seasonality_data[symbol] = {
                    "cv": None,
                    "category": "BRAK_SPRZEDAZY",
                    "monthly_sales": monthly_sales,
                    "avg": 0,
                    "std": 0
                }
                continue

            # Oblicz odchylenie standardowe populacji
            variance = sum((x - avg) ** 2 for x in monthly_sales) / len(monthly_sales)
            std = math.sqrt(variance)

            # Oblicz CV (współczynnik zmienności)
            cv = std / avg

            # Klasyfikacja
            if cv < 0.2:
                category = "STABILNY"
            elif cv <= 0.5:
                category = "ZMIENNY"
            else:
                category = "SEZONOWY"

            seasonality_data[symbol] = {
                "cv": round(cv, 3),
                "category": category,
                "monthly_sales": monthly_sales,
                "avg": round(avg, 2),
                "std": round(std, 2)
            }

        return {
            "success": True,
            "total_products": len(seasonality_data),
            "data": seasonality_data,
            "classification": {
                "STABILNY": "CV < 0.2 - Produkt całoroczny, stabilna sprzedaż",
                "ZMIENNY": "CV 0.2-0.5 - Produkt o zmiennym popycie",
                "SEZONOWY": "CV > 0.5 - Produkt sezonowy lub nieregularny",
                "BRAK_DANYCH": "Za mało danych (< 2 miesiące)",
                "BRAK_SPRZEDAZY": "Brak sprzedaży w ostatnich 12 miesiącach"
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas obliczania sezonowości: {str(e)}"
        )


def run_data_sync():
    """Funkcja uruchamiająca synchronizację danych"""
    if not sync_lock.acquire(blocking=False):
        print("[!] Synchronizacja już trwa - pomijam")
        return

    try:
        print("\n" + "="*60)
        print(f"Synchronizacja danych: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*60)

        script_path = os.path.join(os.path.dirname(__file__), '..', 'product_data_manager_optimized.py')
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=300  # 5 minut timeout
        )

        if result.returncode == 0:
            print("[OK] Synchronizacja zakończona pomyślnie")
            # Wyświetl tylko ostatnie 10 linii outputu aby nie zaśmiecać konsoli
            lines = result.stdout.strip().split('\n')
            if len(lines) > 10:
                print("...")
                print('\n'.join(lines[-10:]))
            else:
                print(result.stdout)
        else:
            print("[!] Synchronizacja zakończyła się z błędem")
            print(result.stderr)

        print("="*60 + "\n")

    except subprocess.TimeoutExpired:
        print("[!] Synchronizacja przekroczyła limit czasu (5 minut)")
        print("="*60 + "\n")
    except Exception as e:
        print(f"[!] Błąd podczas synchronizacji: {e}")
        print("="*60 + "\n")
    finally:
        sync_lock.release()


@app.post("/api/sync-purchase-prices")
async def sync_purchase_prices():
    """
    Synchronizuje ceny zakupu z dokumentów PZ (z powiązanej FZ) i PW z SQL Server.
    Dla PZ - cena z powiązanej faktury zakupu FZ
    Dla PW - cena bezpośrednio z pozycji dokumentu PW
    """
    try:
        # Połączenie z SQL Server
        server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
        database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
        username = os.getenv('SQL_USERNAME', 'zestawienia2')
        password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

        try:
            sql_connection = pyodbc.connect(
                'DRIVER={ODBC Driver 18 for SQL Server};'
                f'SERVER={server};'
                f'DATABASE={database};'
                f'UID={username};'
                f'PWD={password};'
                'TrustServerCertificate=yes;'
                'Connection Timeout=30;'
            )
        except pyodbc.Error as conn_err:
            raise HTTPException(
                status_code=503,
                detail=f"Błąd połączenia z SQL Server: {str(conn_err)}"
            )

        sql_cursor = sql_connection.cursor()

        # Pobierz ostatnią cenę zakupu dla każdego produktu:
        # 1. Z dokumentów PZ - cenę bierzemy z powiązanej faktury FZ (przez ob_DokHanId)
        # 2. Z dokumentów PW - cenę bierzemy bezpośrednio z pozycji PW
        query = """
        WITH PurchasePrices AS (
            -- Ceny z PZ powiązanych z FZ (cena z faktury zakupu)
            SELECT
                tw.tw_Symbol AS Symbol,
                fz_poz.ob_CenaNetto AS CenaZakupuNetto,
                COALESCE(sl.sl_Nazwa, '') AS Grupa,
                pz.dok_DataWyst AS DataDok,
                ROW_NUMBER() OVER (PARTITION BY tw.tw_Symbol ORDER BY pz.dok_DataWyst DESC) AS rn
            FROM dok__Dokument pz
            INNER JOIN dok_Pozycja pz_poz ON pz.dok_Id = pz_poz.ob_DokMagId
            INNER JOIN dok__Dokument fz ON pz_poz.ob_DokHanId = fz.dok_Id
            INNER JOIN dok_Pozycja fz_poz ON fz.dok_Id = fz_poz.ob_DokHanId AND pz_poz.ob_TowId = fz_poz.ob_TowId
            INNER JOIN tw__Towar tw ON pz_poz.ob_TowId = tw.tw_Id
            LEFT JOIN sl__Slownik sl ON tw.tw_IdGrupa = sl.sl_Id
            WHERE pz.dok_NrPelny LIKE 'PZ%'
                AND fz.dok_NrPelny LIKE 'FZ%'
                AND pz.dok_Status <> 2
                AND fz_poz.ob_CenaNetto > 0

            UNION ALL

            -- Ceny z PW (bezpośrednio z pozycji dokumentu)
            SELECT
                tw.tw_Symbol AS Symbol,
                pw_poz.ob_CenaNetto AS CenaZakupuNetto,
                COALESCE(sl.sl_Nazwa, '') AS Grupa,
                pw.dok_DataWyst AS DataDok,
                ROW_NUMBER() OVER (PARTITION BY tw.tw_Symbol ORDER BY pw.dok_DataWyst DESC) AS rn
            FROM dok__Dokument pw
            INNER JOIN dok_Pozycja pw_poz ON pw.dok_Id = pw_poz.ob_DokMagId
            INNER JOIN tw__Towar tw ON pw_poz.ob_TowId = tw.tw_Id
            LEFT JOIN sl__Slownik sl ON tw.tw_IdGrupa = sl.sl_Id
            WHERE pw.dok_NrPelny LIKE 'PW%'
                AND pw.dok_Status <> 2
                AND pw_poz.ob_CenaNetto > 0
        ),
        LatestPrices AS (
            SELECT Symbol, CenaZakupuNetto, Grupa,
                   ROW_NUMBER() OVER (PARTITION BY Symbol ORDER BY DataDok DESC) AS final_rn
            FROM PurchasePrices
        )
        SELECT Symbol, CenaZakupuNetto, Grupa
        FROM LatestPrices
        WHERE final_rn = 1
        """

        sql_cursor.execute(query)
        rows = sql_cursor.fetchall()
        sql_connection.close()

        # Aktualizuj lokalną bazę SQLite
        conn = get_db_connection()
        cursor = conn.cursor()

        updated_count = 0
        for row in rows:
            symbol = row[0]
            cena_zakupu = float(row[1] or 0)
            grupa = row[2] or ''

            cursor.execute("""
                UPDATE products
                SET CenaZakupuNetto = ?,
                    Grupa = ?
                WHERE Symbol = ?
            """, (cena_zakupu, grupa, symbol))

            if cursor.rowcount > 0:
                updated_count += 1

        conn.commit()
        conn.close()

        return {
            "success": True,
            "message": f"Zaktualizowano ceny zakupu dla {updated_count} produktów",
            "updated_count": updated_count,
            "total_found": len(rows)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas synchronizacji cen zakupu: {str(e)}"
        )


@app.get("/api/products-with-prices")
async def get_products_with_prices(limit: int = 100, search: Optional[str] = None):
    """
    Pobiera produkty wraz z cenami zakupu i sprzedaży.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
        SELECT Symbol, Nazwa, Marka, Rodzaj, Grupa, Stan,
               CenaZakupuNetto, StawkaVAT, DetalicznaNetto, DetalicznaBrutto,
               Rozmiar, Kolor, Przeznaczenie
        FROM products
        WHERE Stan > 0
        """
        params = []

        if search:
            query += " AND (Symbol LIKE ? OR Nazwa LIKE ? OR Marka LIKE ?)"
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param])

        query += " ORDER BY Stan DESC LIMIT ?"
        params.append(limit)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        products = []
        for row in rows:
            cena_zakupu = float(row[6] or 0)
            stawka_vat = float(row[7] or 23)
            cena_detal_netto = float(row[8] or 0)
            cena_detal_brutto = float(row[9] or 0)
            stan = float(row[5] or 0)

            # Oblicz wartości
            cena_zakupu_brutto = cena_zakupu * (1 + stawka_vat / 100)
            wartosc_zakupu = cena_zakupu * stan
            wartosc_sprzedazy = cena_detal_netto * stan

            # Oblicz marżę
            marza_proc = 0
            if cena_zakupu > 0:
                marza_proc = ((cena_detal_netto - cena_zakupu) / cena_zakupu) * 100

            products.append({
                "Symbol": row[0] or "",
                "Nazwa": row[1] or "",
                "Marka": row[2] or "",
                "Rodzaj": row[3] or "",
                "Grupa": row[4] or "",
                "Stan": stan,
                "CenaZakupuNetto": round(cena_zakupu, 2),
                "CenaZakupuBrutto": round(cena_zakupu_brutto, 2),
                "StawkaVAT": stawka_vat,
                "DetalicznaNetto": round(cena_detal_netto, 2),
                "DetalicznaBrutto": round(cena_detal_brutto, 2),
                "WartoscZakupu": round(wartosc_zakupu, 2),
                "WartoscSprzedazy": round(wartosc_sprzedazy, 2),
                "MarzaProc": round(marza_proc, 1),
                "Rozmiar": row[10] or "",
                "Kolor": row[11] or "",
                "Przeznaczenie": row[12] or ""
            })

        conn.close()

        return {
            "success": True,
            "count": len(products),
            "products": products
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas pobierania produktów: {str(e)}"
        )


@app.get("/api/test-purchase-docs")
async def test_purchase_docs():
    """
    Endpoint testowy - sprawdza typy dokumentów i przykładowe dane zakupowe w SQL Server.
    Szuka dokumentów PW (Przyjęcie Wewnętrzne) z ruchu towarów.
    """
    try:
        server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
        database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
        username = os.getenv('SQL_USERNAME', 'zestawienia2')
        password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

        sql_connection = pyodbc.connect(
            'DRIVER={ODBC Driver 18 for SQL Server};'
            f'SERVER={server};'
            f'DATABASE={database};'
            f'UID={username};'
            f'PWD={password};'
            'TrustServerCertificate=yes;'
            'Connection Timeout=30;'
        )
        sql_cursor = sql_connection.cursor()

        # Sprawdź unikalne typy dokumentów
        sql_cursor.execute("SELECT DISTINCT dok_Typ FROM dok__Dokument ORDER BY dok_Typ")
        doc_types = [row[0] for row in sql_cursor.fetchall()]

        # Sprawdź przykładowe dokumenty PW i PZ (numer zaczynający się od PW lub PZ)
        sql_cursor.execute("""
            SELECT TOP 10 d.dok_Typ, d.dok_NrPelny, d.dok_DataWyst,
                   dp.ob_CenaNetto, tw.tw_Symbol, tw.tw_Nazwa
            FROM dok__Dokument d
            INNER JOIN dok_Pozycja dp ON d.dok_Id = dp.ob_DokMagId
            INNER JOIN tw__Towar tw ON dp.ob_TowId = tw.tw_Id
            WHERE (d.dok_NrPelny LIKE 'PW%' OR d.dok_NrPelny LIKE 'PZ%')
                AND dp.ob_CenaNetto > 0
            ORDER BY d.dok_DataWyst DESC
        """)
        pw_docs = []
        for row in sql_cursor.fetchall():
            pw_docs.append({
                "dok_Typ": row[0],
                "dok_NrPelny": row[1],
                "dok_DataWyst": str(row[2]) if row[2] else None,
                "ob_CenaNetto": float(row[3]) if row[3] else 0,
                "tw_Symbol": row[4],
                "tw_Nazwa": row[5]
            })

        # Policz dokumenty PW i PZ
        sql_cursor.execute("""
            SELECT COUNT(DISTINCT d.dok_Id) as LiczbaDok,
                   COUNT(DISTINCT tw.tw_Symbol) as LiczbaProduktow
            FROM dok__Dokument d
            INNER JOIN dok_Pozycja dp ON d.dok_Id = dp.ob_DokMagId
            INNER JOIN tw__Towar tw ON dp.ob_TowId = tw.tw_Id
            WHERE (d.dok_NrPelny LIKE 'PW%' OR d.dok_NrPelny LIKE 'PZ%')
                AND dp.ob_CenaNetto > 0
        """)
        pw_stats = sql_cursor.fetchone()

        # Sprawdź też jakie prefiksy dokumentów występują
        sql_cursor.execute("""
            SELECT TOP 20 LEFT(dok_NrPelny, 2) as Prefix, COUNT(*) as Liczba
            FROM dok__Dokument
            WHERE dok_NrPelny IS NOT NULL
            GROUP BY LEFT(dok_NrPelny, 2)
            ORDER BY COUNT(*) DESC
        """)
        doc_prefixes = []
        for row in sql_cursor.fetchall():
            doc_prefixes.append({"prefix": row[0], "count": row[1]})

        sql_connection.close()

        return {
            "success": True,
            "all_doc_types": doc_types,
            "doc_prefixes": doc_prefixes,
            "pw_documents_count": pw_stats[0] if pw_stats else 0,
            "pw_products_count": pw_stats[1] if pw_stats else 0,
            "sample_pw_docs": pw_docs
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd: {str(e)}"
        )


@app.get("/api/test-doc-links")
async def test_doc_links():
    """
    Endpoint testowy - sprawdza strukturę powiązań dokumentów w SQL Server.
    """
    try:
        server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
        database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
        username = os.getenv('SQL_USERNAME', 'zestawienia2')
        password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

        sql_connection = pyodbc.connect(
            'DRIVER={ODBC Driver 18 for SQL Server};'
            f'SERVER={server};'
            f'DATABASE={database};'
            f'UID={username};'
            f'PWD={password};'
            'TrustServerCertificate=yes;'
            'Connection Timeout=30;'
        )
        sql_cursor = sql_connection.cursor()

        # Sprawdź kolumny tabeli dok__Dokument
        sql_cursor.execute("""
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'dok__Dokument'
            ORDER BY ORDINAL_POSITION
        """)
        doc_columns = [{"name": row[0], "type": row[1]} for row in sql_cursor.fetchall()]

        # Sprawdź kolumny tabeli dok_Pozycja
        sql_cursor.execute("""
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'dok_Pozycja'
            ORDER BY ORDINAL_POSITION
        """)
        pos_columns = [{"name": row[0], "type": row[1]} for row in sql_cursor.fetchall()]

        # Sprawdź tabele z powiązaniami dokumentów
        sql_cursor.execute("""
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME LIKE '%dok%' OR TABLE_NAME LIKE '%pow%' OR TABLE_NAME LIKE '%link%'
            ORDER BY TABLE_NAME
        """)
        related_tables = [row[0] for row in sql_cursor.fetchall()]

        # Szukaj powiązań PZ z FZ poprzez ob_DokHanId
        sql_cursor.execute("""
            SELECT TOP 10
                pz.dok_NrPelny AS PZ_Nr,
                fz.dok_NrPelny AS FZ_Nr,
                fz_poz.ob_CenaNetto AS CenaZFZ,
                tw.tw_Symbol,
                tw.tw_Nazwa
            FROM dok__Dokument pz
            INNER JOIN dok_Pozycja pz_poz ON pz.dok_Id = pz_poz.ob_DokMagId
            INNER JOIN dok__Dokument fz ON pz_poz.ob_DokHanId = fz.dok_Id
            INNER JOIN dok_Pozycja fz_poz ON fz.dok_Id = fz_poz.ob_DokHanId AND pz_poz.ob_TowId = fz_poz.ob_TowId
            INNER JOIN tw__Towar tw ON pz_poz.ob_TowId = tw.tw_Id
            WHERE pz.dok_NrPelny LIKE 'PZ%'
                AND fz.dok_NrPelny LIKE 'FZ%'
                AND fz_poz.ob_CenaNetto > 0
            ORDER BY pz.dok_DataWyst DESC
        """)
        pz_fz_links = []
        for row in sql_cursor.fetchall():
            pz_fz_links.append({
                "PZ_Nr": row[0],
                "FZ_Nr": row[1],
                "CenaZFZ": float(row[2]) if row[2] else 0,
                "Symbol": row[3],
                "Nazwa": row[4]
            })

        # Sprawdź PW z powiązanymi dokumentami (przez dok_DoDokId)
        sql_cursor.execute("""
            SELECT TOP 10
                pw.dok_NrPelny AS PW_Nr,
                pw.dok_DoDokNrPelny AS Powiazany_Nr,
                poz.ob_CenaNetto AS CenaNaPW,
                tw.tw_Symbol,
                tw.tw_Nazwa
            FROM dok__Dokument pw
            INNER JOIN dok_Pozycja poz ON pw.dok_Id = poz.ob_DokMagId
            INNER JOIN tw__Towar tw ON poz.ob_TowId = tw.tw_Id
            WHERE pw.dok_NrPelny LIKE 'PW%'
                AND poz.ob_CenaNetto > 0
            ORDER BY pw.dok_DataWyst DESC
        """)
        pw_links = []
        for row in sql_cursor.fetchall():
            pw_links.append({
                "PW_Nr": row[0],
                "Powiazany_Nr": row[1],
                "CenaNaPW": float(row[2]) if row[2] else 0,
                "Symbol": row[3],
                "Nazwa": row[4]
            })

        # Policz ile PZ ma powiązane FZ (przez ob_DokHanId)
        sql_cursor.execute("""
            SELECT COUNT(DISTINCT pz.dok_Id)
            FROM dok__Dokument pz
            INNER JOIN dok_Pozycja pz_poz ON pz.dok_Id = pz_poz.ob_DokMagId
            WHERE pz.dok_NrPelny LIKE 'PZ%'
                AND pz_poz.ob_DokHanId IS NOT NULL AND pz_poz.ob_DokHanId > 0
        """)
        pz_with_fz = sql_cursor.fetchone()[0]

        # Policz ile PW ma dokumenty powiązane
        sql_cursor.execute("""
            SELECT COUNT(*) FROM dok__Dokument
            WHERE dok_NrPelny LIKE 'PW%'
                AND dok_DoDokId IS NOT NULL AND dok_DoDokId > 0
        """)
        pw_with_link = sql_cursor.fetchone()[0]

        sql_connection.close()

        return {
            "success": True,
            "pz_fz_links_sample": pz_fz_links,
            "pw_links_sample": pw_links,
            "pz_with_fz_count": pz_with_fz,
            "pw_with_link_count": pw_with_link
        }

    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@app.get("/api/warehouse-stocks")
async def get_warehouse_stocks(mag_ids: Optional[str] = "1,7,9"):
    """
    Pobiera stany magazynowe z podziałem na magazyny bezpośrednio z SQL Server.

    Parametry:
    - mag_ids: ID magazynów rozdzielone przecinkami (domyślnie: 1,7,9)

    Zwraca produkty z informacją o stanie w każdym magazynie.
    """
    try:
        # Parsuj ID magazynów
        mag_id_list = [int(x.strip()) for x in mag_ids.split(',') if x.strip()]
        if not mag_id_list:
            mag_id_list = [1, 7, 9]

        mag_placeholders = ','.join(str(m) for m in mag_id_list)

        server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
        database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
        username = os.getenv('SQL_USERNAME', 'zestawienia2')
        password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

        sql_connection = pyodbc.connect(
            'DRIVER={ODBC Driver 18 for SQL Server};'
            f'SERVER={server};'
            f'DATABASE={database};'
            f'UID={username};'
            f'PWD={password};'
            'TrustServerCertificate=yes;'
            'Connection Timeout=30;'
        )
        sql_cursor = sql_connection.cursor()

        # Pobierz stany per magazyn z SQL Server
        # Pobieramy ceny zakupu z lokalnej bazy SQLite, bo SQL Server może nie mieć tc_CenaMag
        query = f"""
        SELECT
            tw.tw_Symbol AS Symbol,
            tw.tw_Nazwa AS Nazwa,
            tw.tw_Pole2 AS Marka,
            tw.tw_pole1 AS Rozmiar,
            tw.tw_pole8 AS Rodzaj,
            st.st_MagId AS MagId,
            st.st_Stan AS Stan,
            tc.tc_CenaNetto1 AS DetalicznaNetto,
            tc.tc_CenaBrutto1 AS DetalicznaBrutto
        FROM tw_Stan st
        INNER JOIN tw__Towar tw ON st.st_TowId = tw.tw_Id
        LEFT JOIN tw_Cena tc ON st.st_TowId = tc.tc_IdTowar
        WHERE st.st_Stan > 0
            AND st.st_MagId IN ({mag_placeholders})
        ORDER BY tw.tw_Symbol, st.st_MagId
        """

        sql_cursor.execute(query)
        rows = sql_cursor.fetchall()
        sql_connection.close()

        # Pobierz ceny zakupu z lokalnej bazy SQLite
        conn_sqlite = get_db_connection()
        cursor_sqlite = conn_sqlite.cursor()
        cursor_sqlite.execute("SELECT Symbol, CenaZakupuNetto FROM products WHERE CenaZakupuNetto > 0")
        purchase_prices = {row[0]: row[1] for row in cursor_sqlite.fetchall()}
        conn_sqlite.close()

        # Grupuj dane per produkt, zachowując stany per magazyn
        products_dict = {}
        for row in rows:
            symbol = row[0]
            mag_id = row[5]
            stan = float(row[6] or 0)

            if symbol not in products_dict:
                products_dict[symbol] = {
                    'Symbol': symbol,
                    'Nazwa': row[1],
                    'Marka': row[2],
                    'Rozmiar': row[3],
                    'Rodzaj': row[4],
                    'DetalicznaNetto': float(row[7]) if row[7] else 0,
                    'DetalicznaBrutto': float(row[8]) if row[8] else 0,
                    'CenaZakupuNetto': purchase_prices.get(symbol, 0),
                    'StanMag1': 0,  # GLS
                    'StanMag2': 0,  # GLS DEPOZYT
                    'StanMag7': 0,  # JEANS
                    'StanMag9': 0,  # INNE
                    'StanTotal': 0
                }

            # Zapisz stan dla danego magazynu
            products_dict[symbol][f'StanMag{mag_id}'] = stan
            products_dict[symbol]['StanTotal'] += stan

        # Konwertuj do listy
        products = list(products_dict.values())

        # Oblicz sumy per magazyn
        totals = {
            'count': len(products),
            'mag1_count': sum(1 for p in products if p['StanMag1'] > 0),
            'mag2_count': sum(1 for p in products if p['StanMag2'] > 0),
            'mag7_count': sum(1 for p in products if p['StanMag7'] > 0),
            'mag9_count': sum(1 for p in products if p['StanMag9'] > 0),
            'mag1_stock': sum(p['StanMag1'] for p in products),
            'mag2_stock': sum(p['StanMag2'] for p in products),
            'mag7_stock': sum(p['StanMag7'] for p in products),
            'mag9_stock': sum(p['StanMag9'] for p in products),
            'mag1_value': sum(p['StanMag1'] * p['CenaZakupuNetto'] for p in products),
            'mag2_value': sum(p['StanMag2'] * p['CenaZakupuNetto'] for p in products),
            'mag7_value': sum(p['StanMag7'] * p['CenaZakupuNetto'] for p in products),
            'mag9_value': sum(p['StanMag9'] * p['CenaZakupuNetto'] for p in products),
            'total_stock': sum(p['StanTotal'] for p in products),
            'total_value': sum(p['StanTotal'] * p['CenaZakupuNetto'] for p in products),
            'total_value_sales': sum(p['StanTotal'] * p['DetalicznaBrutto'] for p in products)
        }

        return {
            "success": True,
            "products": products,
            "totals": totals,
            "mag_ids": mag_id_list
        }

    except Exception as e:
        import traceback
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas pobierania stanów magazynowych: {str(e)}"
        )


@app.get("/api/seasonality-index")
async def get_seasonality_index(
    mag_ids: Optional[str] = "1,7,9",
    rodzaj: Optional[str] = None,
    marka: Optional[str] = None,
    symbol: Optional[str] = None
):
    """
    Oblicza indeks sezonowości dla produktów na podstawie danych z ostatniego roku.

    Indeks sezonowości = Sprzedaż w danym tygodniu / Średnia tygodniowa sprzedaż z całego roku

    Parametry:
    - mag_ids: ID magazynów (domyślnie 1,7,9)
    - rodzaj: Filtr po rodzaju produktu
    - marka: Filtr po marce
    - symbol: Filtr po symbolu (częściowe wyszukiwanie)
    """
    from datetime import datetime, timedelta

    # Sprawdź cache
    cache_key = f"{mag_ids}_{rodzaj}_{marka}_{symbol}"
    if cache_key in seasonality_cache["data"]:
        cached = seasonality_cache["data"][cache_key]
        cache_age = (datetime.now() - cached["timestamp"]).total_seconds()
        if cache_age < seasonality_cache["cache_duration"]:
            print(f"[CACHE HIT] Sezonowość - zwracam dane z cache (wiek: {cache_age:.0f}s)")
            return cached["result"]

    try:
        # Połączenie z SQL Server
        server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
        database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
        username = os.getenv('SQL_USERNAME', 'zestawienia2')
        password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

        try:
            sql_connection = pyodbc.connect(
                'DRIVER={ODBC Driver 18 for SQL Server};'
                f'SERVER={server};'
                f'DATABASE={database};'
                f'UID={username};'
                f'PWD={password};'
                'TrustServerCertificate=yes;'
                'Connection Timeout=30;'
            )
        except pyodbc.Error as conn_err:
            raise HTTPException(
                status_code=503,
                detail=f"Błąd połączenia z SQL Server: {str(conn_err)}"
            )

        sql_cursor = sql_connection.cursor()

        # Parsowanie mag_ids
        if mag_ids:
            mag_id_list = [int(x.strip()) for x in mag_ids.split(',') if x.strip().isdigit()]
        else:
            mag_id_list = [1, 7, 9]

        mag_placeholders = ','.join(['?' for _ in mag_id_list])

        # Oblicz daty - 52 tygodnie wstecz od dziś
        end_date = datetime.now()
        start_date = end_date - timedelta(weeks=52)

        # Oblicz aktualny tydzień i rok
        current_week = end_date.isocalendar()[1]
        current_year = end_date.year
        start_week = start_date.isocalendar()[1]
        start_year = start_date.year

        # Zapytanie pobierające sprzedaż per produkt per tydzień
        # Używamy DATEPART(ISO_WEEK) dla spójności z isocalendar()
        query = f"""
        SELECT
            tw.tw_Symbol AS Symbol,
            tw.tw_Nazwa AS Nazwa,
            tw.tw_Pole2 AS Marka,
            tw.tw_pole8 AS Rodzaj,
            tw.tw_pole3 AS Model,
            DATEPART(ISO_WEEK, dok_DataWyst) AS NumerTygodnia,
            YEAR(DATEADD(day, 26 - DATEPART(iso_week, dok_DataWyst), dok_DataWyst)) AS RokISO,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_IloscMag ELSE ob_IloscMag END) AS IloscSprzedana
        FROM vwZstSprzWgKhnt
        INNER JOIN tw__Towar tw ON ob_TowId = tw.tw_Id
        WHERE CAST(dok_DataWyst AS DATE) >= ?
            AND CAST(dok_DataWyst AS DATE) <= ?
            AND dok_MagId IN ({mag_placeholders})
            AND dok_Podtyp <> 1
            AND dok_Status <> 2
        """

        params = [start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')] + mag_id_list

        # Dodaj filtry
        if rodzaj:
            query += " AND tw.tw_pole8 = ?"
            params.append(rodzaj)

        if marka:
            query += " AND tw.tw_Pole2 = ?"
            params.append(marka)

        if symbol:
            query += " AND tw.tw_Symbol LIKE ?"
            params.append(f"%{symbol}%")

        query += """
        GROUP BY
            tw.tw_Symbol, tw.tw_Nazwa, tw.tw_Pole2, tw.tw_pole8, tw.tw_pole3,
            DATEPART(ISO_WEEK, dok_DataWyst), YEAR(DATEADD(day, 26 - DATEPART(iso_week, dok_DataWyst), dok_DataWyst))
        ORDER BY tw.tw_Symbol, RokISO, NumerTygodnia
        """

        sql_cursor.execute(query, params)
        rows = sql_cursor.fetchall()

        # Drugie zapytanie - trend z ostatnich 4 lat (sprzedaż roczna) - pobieramy 4 lata aby mieć pełne dane z 3 lat wstecz
        trend_start_date = end_date - timedelta(days=4*365)
        trend_query = f"""
        SELECT
            tw.tw_Symbol AS Symbol,
            YEAR(dok_DataWyst) AS Rok,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_IloscMag ELSE ob_IloscMag END) AS IloscSprzedana
        FROM vwZstSprzWgKhnt
        INNER JOIN tw__Towar tw ON ob_TowId = tw.tw_Id
        WHERE CAST(dok_DataWyst AS DATE) >= ?
            AND CAST(dok_DataWyst AS DATE) <= ?
            AND dok_MagId IN ({mag_placeholders})
            AND dok_Podtyp <> 1
            AND dok_Status <> 2
        """
        trend_params = [trend_start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')] + mag_id_list

        if rodzaj:
            trend_query += " AND tw.tw_pole8 = ?"
            trend_params.append(rodzaj)
        if marka:
            trend_query += " AND tw.tw_Pole2 = ?"
            trend_params.append(marka)
        if symbol:
            trend_query += " AND tw.tw_Symbol LIKE ?"
            trend_params.append(f"%{symbol}%")

        trend_query += """
        GROUP BY tw.tw_Symbol, YEAR(dok_DataWyst)
        ORDER BY tw.tw_Symbol, Rok
        """

        sql_cursor.execute(trend_query, trend_params)
        trend_rows = sql_cursor.fetchall()

        # Przetwórz dane trendu - sprzedaż per rok
        trend_data = {}
        for row in trend_rows:
            sym = row[0]
            year = int(row[1])
            qty = float(row[2] or 0)
            if sym not in trend_data:
                trend_data[sym] = {}
            trend_data[sym][year] = qty

        # Trzecie zapytanie - dane tygodniowe z poprzednich 3 lat (dla trendu tygodniowego)
        prev_year_start = end_date - timedelta(weeks=156)  # 3 lata wstecz
        prev_year_end = end_date - timedelta(weeks=52)  # 1 rok wstecz (bieżący rok jest w głównym zapytaniu)

        weekly_trend_query = f"""
        SELECT
            tw.tw_Symbol AS Symbol,
            DATEPART(ISO_WEEK, dok_DataWyst) AS NumerTygodnia,
            YEAR(DATEADD(day, 26 - DATEPART(iso_week, dok_DataWyst), dok_DataWyst)) AS RokISO,
            SUM(CASE WHEN dok_Typ IN (14, 6) THEN -ob_IloscMag ELSE ob_IloscMag END) AS IloscSprzedana
        FROM vwZstSprzWgKhnt
        INNER JOIN tw__Towar tw ON ob_TowId = tw.tw_Id
        WHERE CAST(dok_DataWyst AS DATE) >= ?
            AND CAST(dok_DataWyst AS DATE) <= ?
            AND dok_MagId IN ({mag_placeholders})
            AND dok_Podtyp <> 1
            AND dok_Status <> 2
        """
        weekly_trend_params = [prev_year_start.strftime('%Y-%m-%d'), prev_year_end.strftime('%Y-%m-%d')] + mag_id_list

        if rodzaj:
            weekly_trend_query += " AND tw.tw_pole8 = ?"
            weekly_trend_params.append(rodzaj)
        if marka:
            weekly_trend_query += " AND tw.tw_Pole2 = ?"
            weekly_trend_params.append(marka)
        if symbol:
            weekly_trend_query += " AND tw.tw_Symbol LIKE ?"
            weekly_trend_params.append(f"%{symbol}%")

        weekly_trend_query += """
        GROUP BY tw.tw_Symbol, DATEPART(ISO_WEEK, dok_DataWyst),
                 YEAR(DATEADD(day, 26 - DATEPART(iso_week, dok_DataWyst), dok_DataWyst))
        """

        sql_cursor.execute(weekly_trend_query, weekly_trend_params)
        weekly_trend_rows = sql_cursor.fetchall()

        # Czwarte zapytanie - aktualne stany magazynowe
        stock_query = f"""
        SELECT
            tw.tw_Symbol AS Symbol,
            SUM(ISNULL(st.st_Stan, 0)) AS StanAktualny
        FROM tw__Towar tw
        LEFT JOIN tw_Stan st ON tw.tw_Id = st.st_TowId AND st.st_MagId IN ({mag_placeholders})
        WHERE 1=1
        """
        stock_params = list(mag_id_list)

        if rodzaj:
            stock_query += " AND tw.tw_pole8 = ?"
            stock_params.append(rodzaj)
        if marka:
            stock_query += " AND tw.tw_Pole2 = ?"
            stock_params.append(marka)
        if symbol:
            stock_query += " AND tw.tw_Symbol LIKE ?"
            stock_params.append(f"%{symbol}%")

        stock_query += " GROUP BY tw.tw_Symbol"

        sql_cursor.execute(stock_query, stock_params)
        stock_rows = sql_cursor.fetchall()

        # Przetwórz dane stanów magazynowych
        stock_data = {}
        for row in stock_rows:
            sym = row[0]
            stan = float(row[1] or 0)
            stock_data[sym] = stan

        sql_connection.close()

        # Przetwórz dane trendu tygodniowego - sprzedaż per tydzień z poprzedniego roku
        prev_year_weekly_data = {}
        for row in weekly_trend_rows:
            sym = row[0]
            week_num = int(row[1])
            year = int(row[2])
            qty = float(row[3] or 0)
            if sym not in prev_year_weekly_data:
                prev_year_weekly_data[sym] = {}
            week_key = f"{year}-{week_num:02d}"
            prev_year_weekly_data[sym][week_key] = qty

        # Generuj listę 52 tygodni wstecz od dziś (z zachowaniem numerów tygodni)
        weeks_list = []
        for i in range(51, -1, -1):  # Od 51 do 0 (52 tygodnie wstecz)
            week_date = end_date - timedelta(weeks=i)
            iso_cal = week_date.isocalendar()
            weeks_list.append({
                'week': iso_cal[1],  # numer tygodnia ISO
                'year': iso_cal[0],  # rok ISO
                'key': f"{iso_cal[0]}-{iso_cal[1]:02d}"  # klucz rok-tydzień
            })

        # Przetwarzanie danych - grupowanie per produkt
        products_data = {}

        for row in rows:
            symbol = row[0]
            nazwa = row[1]
            marka_val = row[2] or ''
            rodzaj_val = row[3] or ''
            model = row[4] or ''
            week_num = int(row[5])
            year = int(row[6])
            qty_sold = float(row[7] or 0)

            if symbol not in products_data:
                products_data[symbol] = {
                    'Symbol': symbol,
                    'Nazwa': nazwa,
                    'Marka': marka_val,
                    'Rodzaj': rodzaj_val,
                    'Model': model,
                    'weeks': {},
                    'total_sold': 0
                }

            # Klucz tygodnia rok-numer
            week_key = f"{year}-{week_num:02d}"
            if week_key not in products_data[symbol]['weeks']:
                products_data[symbol]['weeks'][week_key] = 0

            products_data[symbol]['weeks'][week_key] += qty_sold
            products_data[symbol]['total_sold'] += qty_sold

        # Obliczanie indeksu sezonowości dla każdego produktu
        results = []

        for symbol, data in products_data.items():
            # Średnia tygodniowa sprzedaż (suma / 52 tygodnie)
            avg_weekly_sales = data['total_sold'] / 52 if data['total_sold'] > 0 else 0

            # Przygotuj dane tygodniowe z indeksami - w kolejności chronologicznej
            weekly_data = {}
            product_prev_year = prev_year_weekly_data.get(symbol, {})

            for week_info in weeks_list:
                week_key = week_info['key']
                week_sales = data['weeks'].get(week_key, 0)
                if avg_weekly_sales > 0:
                    seasonality_index = round(week_sales / avg_weekly_sales, 2)
                else:
                    seasonality_index = 0

                # Znajdź odpowiadający tydzień z poprzednich lat
                prev_year_key = f"{week_info['year'] - 1}-{week_info['week']:02d}"
                prev_year_sales = product_prev_year.get(prev_year_key, 0)

                prev_year_2_key = f"{week_info['year'] - 2}-{week_info['week']:02d}"
                prev_year_2_sales = product_prev_year.get(prev_year_2_key, 0)

                # Oblicz trend tygodniowy (porównanie z tym samym tygodniem rok wcześniej)
                if prev_year_sales > 0:
                    week_trend_pct = round(((week_sales - prev_year_sales) / prev_year_sales) * 100, 0)
                else:
                    week_trend_pct = 0 if week_sales == 0 else 100

                weekly_data[week_key] = {
                    'tydzien': week_info['week'],
                    'rok': week_info['year'],
                    'sprzedaz': round(week_sales, 0),
                    'indeks': seasonality_index,
                    'poprzedni_rok': round(prev_year_sales, 0),
                    'poprzedni_rok_2': round(prev_year_2_sales, 0),
                    'trend_procent': week_trend_pct
                }

            # Znajdź tydzień szczytu i minimum (z niepustych)
            non_zero_weeks = {k: v for k, v in data['weeks'].items() if v > 0}
            peak_week_key = max(non_zero_weeks.keys(), key=lambda k: non_zero_weeks[k]) if non_zero_weeks else None
            min_week_key = min(non_zero_weeks.keys(), key=lambda k: non_zero_weeks[k]) if non_zero_weeks else None

            # Oblicz trend z ostatnich 3 lat
            product_trend = trend_data.get(symbol, {})
            current_year = end_date.year
            years_data = {}
            for y in range(current_year - 2, current_year + 1):
                years_data[y] = product_trend.get(y, 0)

            # Oblicz procentową zmianę trendu (rok bieżący vs rok poprzedni)
            prev_year_sales = years_data.get(current_year - 1, 0)
            curr_year_sales = years_data.get(current_year, 0)
            if prev_year_sales > 0:
                trend_percent = round(((curr_year_sales - prev_year_sales) / prev_year_sales) * 100, 1)
            else:
                trend_percent = 0 if curr_year_sales == 0 else 100

            # Określ kierunek trendu
            if trend_percent > 10:
                trend_direction = 'up'
            elif trend_percent < -10:
                trend_direction = 'down'
            else:
                trend_direction = 'stable'

            # Pobierz aktualny stan magazynowy
            stan_aktualny = stock_data.get(symbol, 0)

            results.append({
                'Symbol': data['Symbol'],
                'Nazwa': data['Nazwa'],
                'Marka': data['Marka'],
                'Rodzaj': data['Rodzaj'],
                'Model': data['Model'],
                'SumaRoczna': round(data['total_sold'], 0),
                'SredniaTygodniowa': round(avg_weekly_sales, 2),
                'TydzienSzczytu': peak_week_key,
                'TydzienMinimum': min_week_key,
                'DaneTygodniowe': weekly_data,
                'StanAktualny': round(stan_aktualny, 0),
                'Trend': {
                    'lata': years_data,
                    'zmiana_procent': trend_percent,
                    'kierunek': trend_direction
                }
            })

        # Sortuj po sumie rocznej malejąco
        results.sort(key=lambda x: x['SumaRoczna'], reverse=True)

        # Pobierz dostępne filtry
        filters = {
            'rodzaje': list(set(p['Rodzaj'] for p in results if p['Rodzaj'])),
            'marki': list(set(p['Marka'] for p in results if p['Marka']))
        }
        filters['rodzaje'].sort()
        filters['marki'].sort()

        result = {
            "success": True,
            "data": results[:500],  # Limit do 500 produktów
            "total_products": len(results),
            "period": {
                "start": start_date.strftime('%Y-%m-%d'),
                "end": end_date.strftime('%Y-%m-%d')
            },
            "weeks": weeks_list,  # Lista 52 tygodni w kolejności chronologicznej
            "filters": filters
        }

        # Zapisz do cache
        seasonality_cache["data"][cache_key] = {
            "result": result,
            "timestamp": datetime.now()
        }
        print(f"[CACHE SAVE] Sezonowość - zapisano do cache dla klucza: {cache_key}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        raise HTTPException(
            status_code=500,
            detail=f"Błąd podczas obliczania indeksu sezonowości: {str(e)}"
        )


# =============================================================================
# IGNOROWANE PRODUKTY - Przechowywane w bazie danych
# =============================================================================

def init_ignored_products_table():
    """Inicjalizuje tabelę ignorowanych produktów"""
    try:
        conn = sqlite3.connect(str(DATABASE_FILE))
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ignored_products (
                symbol TEXT PRIMARY KEY,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                added_by TEXT DEFAULT 'system'
            )
        """)
        conn.commit()
        conn.close()
        print("[DB] Tabela ignored_products gotowa")
    except Exception as e:
        print(f"[DB] Błąd tworzenia tabeli ignored_products: {e}")


# Inicjalizuj tabelę przy starcie
init_ignored_products_table()


@app.get("/api/ignored-products")
async def get_ignored_products():
    """Pobiera listę ignorowanych produktów"""
    try:
        conn = sqlite3.connect(str(DATABASE_FILE))
        cursor = conn.cursor()
        cursor.execute("SELECT symbol, added_at FROM ignored_products ORDER BY added_at DESC")
        rows = cursor.fetchall()
        conn.close()

        return {
            "success": True,
            "data": [row[0] for row in rows],  # Lista symboli
            "details": [{"symbol": row[0], "added_at": row[1]} for row in rows]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd pobierania ignorowanych produktów: {str(e)}")


@app.post("/api/ignored-products/{symbol}")
async def add_ignored_product(symbol: str):
    """Dodaje produkt do listy ignorowanych"""
    try:
        conn = sqlite3.connect(str(DATABASE_FILE))
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO ignored_products (symbol, added_at)
            VALUES (?, CURRENT_TIMESTAMP)
        """, (symbol,))
        conn.commit()
        conn.close()

        return {"success": True, "message": f"Produkt {symbol} dodany do ignorowanych"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd dodawania do ignorowanych: {str(e)}")


@app.delete("/api/ignored-products/{symbol}")
async def remove_ignored_product(symbol: str):
    """Usuwa produkt z listy ignorowanych"""
    try:
        conn = sqlite3.connect(str(DATABASE_FILE))
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ignored_products WHERE symbol = ?", (symbol,))
        affected = cursor.rowcount
        conn.commit()
        conn.close()

        if affected == 0:
            return {"success": False, "message": f"Produkt {symbol} nie był na liście ignorowanych"}

        return {"success": True, "message": f"Produkt {symbol} usunięty z ignorowanych"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd usuwania z ignorowanych: {str(e)}")


# ============================================
# FOOTFALL - Pobieranie wejść z systemu AGIS
# ============================================

# Cache dla wejść (aktualizowane w tle przez scheduler)
footfall_cache = {
    "gls": None,
    "jns": None,
    "timestamp": None,
    "jns_timestamp": None,
    "cache_duration": 600,  # 10 minut w sekundach
    "loading": False  # Czy trwa odświeżanie w tle
}


def fetch_footfall_from_agis():
    """
    Pobiera liczbę wejść z systemu AGIS (http://10.101.101.34/)
    Loguje się i parsuje tabelę statystyk
    """
    try:
        session = requests.Session()

        # Logowanie
        login_url = 'http://10.101.101.34/login.php?action=login'
        login_data = {
            'login': 'Krzysztof',
            'password': 'QcBnID'
        }

        response = session.post(login_url, data=login_data, allow_redirects=True, timeout=15)

        if response.status_code != 200:
            print(f"[FOOTFALL] Błąd logowania: status {response.status_code}")
            return None

        # Pobierz stronę główną po logowaniu
        main_page = session.get('http://10.101.101.34/', timeout=15)

        if main_page.status_code != 200:
            print(f"[FOOTFALL] Błąd pobierania strony: status {main_page.status_code}")
            return None

        # Parsuj HTML
        soup = BeautifulSoup(main_page.text, 'html.parser')
        tabela = soup.find(id='tabela_stat')

        if not tabela:
            print("[FOOTFALL] Nie znaleziono tabeli tabela_stat")
            return None

        rows = tabela.find_all('tr')

        if len(rows) < 2:
            print("[FOOTFALL] Tabela nie ma wystarczającej liczby wierszy")
            return None

        # Pobierz wartość z wiersza 1, kolumna 1 (wejścia dzienne)
        wiersz = rows[1]
        kolumny = wiersz.find_all('td')

        if len(kolumny) < 2:
            print("[FOOTFALL] Wiersz nie ma wystarczającej liczby kolumn")
            return None

        wartosc = kolumny[1].text.strip()

        try:
            wejscia = int(wartosc)
            print(f"[FOOTFALL] Pobrano wejścia GLS: {wejscia}")
            return wejscia
        except ValueError:
            print(f"[FOOTFALL] Nie można sparsować wartości: {wartosc}")
            return None

    except requests.exceptions.Timeout:
        print("[FOOTFALL] Timeout podczas łączenia z AGIS")
        return None
    except Exception as e:
        print(f"[FOOTFALL] Błąd: {e}")
        return None


def fetch_footfall_jns_from_topreports():
    """
    Pobiera liczbę wejść dla JNS (JEANS) z systemu TopReports
    https://lee.topkey.pl:13443/TopReports/
    """
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait, Select
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.service import Service
    from webdriver_manager.chrome import ChromeDriverManager
    import pandas as pd
    import glob
    import tempfile

    DOWNLOAD_FOLDER = tempfile.gettempdir()

    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--ignore-certificate-errors")
    options.add_argument("--window-size=1920,1080")
    prefs = {"download.default_directory": DOWNLOAD_FOLDER}
    options.add_experimental_option("prefs", prefs)

    driver = None
    ostatni_plik = None

    try:
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

        # Logowanie
        print("[FOOTFALL JNS] Logowanie na TopReports...")
        driver.get("https://lee.topkey.pl:13443/TopReports/")

        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "Email")))

        driver.find_element(By.ID, "Email").send_keys("galeriajeans@sporting.com.pl")
        driver.find_element(By.ID, "Password").send_keys("Wrangler1234.")

        submit_button = driver.find_element(By.CSS_SELECTOR, "input.btn.btn-mainLogin, button[type='submit']")
        driver.execute_script("arguments[0].click();", submit_button)

        WebDriverWait(driver, 15).until(EC.url_contains("TopReports"))
        print("[FOOTFALL JNS] Zalogowano pomyślnie.")
        time.sleep(3)

        # Przejdź do formularza raportu
        driver.get("https://lee.topkey.pl:13443/TopReports/RepWizStandard4/Index")
        time.sleep(3)

        # Wybór daty "Dziś"
        try:
            wybierz_date = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.ID, "startDate"))
            )
            driver.execute_script("arguments[0].click();", wybierz_date)
        except:
            pass
        time.sleep(1)

        driver.execute_script("""
            document.querySelectorAll('li.range').forEach(function(range) {
                if (range.textContent.trim() === 'Dziś') range.click();
            });
        """)
        time.sleep(0.5)

        driver.execute_script("""
            var elements = document.querySelectorAll('li, a, button, span, div');
            for (var el of elements) {
                if (el.textContent && el.textContent.trim() === 'Dziś') {
                    el.click();
                    break;
                }
            }
        """)
        time.sleep(0.5)

        # Zaznacz checkbox obszaru
        driver.execute_script("""
            var spans = document.querySelectorAll('span.fancytree-title');
            for (var span of spans) {
                if (span.textContent.includes('PL000') || span.textContent.includes('Galeria Leszno')) {
                    var checkbox = span.parentElement.querySelector('.fancytree-checkbox, .fancytree-radio');
                    if (checkbox) {
                        checkbox.click();
                        return;
                    }
                }
            }
            var first = document.querySelector('span.fancytree-checkbox');
            if (first) first.click();
        """)
        time.sleep(1)

        # Wybór formatu XLS
        try:
            select_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "exportFileTypeList"))
            )
            driver.execute_script("arguments[0].scrollIntoView(true);", select_element)
            select = Select(select_element)
            select.select_by_visible_text("XLS (data only)")
        except:
            pass

        # Eksport raportu
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1)

        try:
            export_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.ID, "exportRepButton"))
            )
            driver.execute_script("arguments[0].click();", export_button)
        except:
            driver.execute_script("document.getElementById('exportRepButton').click();")

        print("[FOOTFALL JNS] Czekam na pobranie pliku...")
        time.sleep(15)

        # Znajdź pobrany plik
        pattern = os.path.join(DOWNLOAD_FOLDER, "*.xls*")
        list_of_files = glob.glob(pattern)
        if list_of_files:
            ostatni_plik = max(list_of_files, key=os.path.getctime)
            print(f"[FOOTFALL JNS] Pobrano plik: {ostatni_plik}")

            # Odczytaj wartość
            df = pd.read_excel(ostatni_plik, sheet_name=0)

            # Szukaj wartości w B10
            try:
                wartosc_b10 = df.iloc[8, 1]
                if pd.notna(wartosc_b10):
                    wejscia = int(float(wartosc_b10))
                    print(f"[FOOTFALL JNS] Wejścia: {wejscia}")
                    return wejscia
            except:
                pass

            # Fallback - szukaj "Suma"
            for idx, row in df.iterrows():
                for col_idx, cell in enumerate(row):
                    if str(cell).strip().lower() == 'suma':
                        if col_idx + 1 < len(row):
                            val = row.iloc[col_idx + 1]
                            if pd.notna(val):
                                return int(float(val))

        return None

    except Exception as e:
        print(f"[FOOTFALL JNS] Błąd: {e}")
        import traceback
        traceback.print_exc()
        return None

    finally:
        if driver:
            driver.quit()
        if ostatni_plik and os.path.exists(ostatni_plik):
            try:
                os.remove(ostatni_plik)
            except:
                pass


def save_footfall_to_db(wejscia: int, store: str = "GLS"):
    """Zapisuje wejścia do bazy SQLite"""
    try:
        conn = sqlite3.connect(str(DATABASE_FILE))
        cursor = conn.cursor()

        # Utwórz tabelę jeśli nie istnieje
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS footfall (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store TEXT NOT NULL,
                date TEXT NOT NULL,
                hour INTEGER NOT NULL,
                wejscia INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(store, date, hour)
            )
        """)

        now = datetime.now()
        date_str = now.strftime('%Y-%m-%d')
        hour = now.hour

        # Wstaw lub zaktualizuj
        cursor.execute("""
            INSERT OR REPLACE INTO footfall (store, date, hour, wejscia)
            VALUES (?, ?, ?, ?)
        """, (store, date_str, hour, wejscia))

        conn.commit()
        conn.close()
        print(f"[FOOTFALL] Zapisano do bazy: {store} {date_str} {hour}:00 = {wejscia}")
        return True
    except Exception as e:
        print(f"[FOOTFALL] Błąd zapisu do bazy: {e}")
        return False


def get_today_footfall(store: str = "GLS"):
    """Pobiera sumę dzisiejszych wejść z bazy"""
    try:
        conn = sqlite3.connect(str(DATABASE_FILE))
        cursor = conn.cursor()

        today = datetime.now().strftime('%Y-%m-%d')

        # Pobierz ostatni (najnowszy) wpis z dzisiaj - to jest suma narastająca
        cursor.execute("""
            SELECT wejscia, hour FROM footfall
            WHERE store = ? AND date = ?
            ORDER BY hour DESC
            LIMIT 1
        """, (store, today))

        row = cursor.fetchone()
        conn.close()

        if row:
            return {"wejscia": row[0], "last_hour": row[1]}
        return {"wejscia": 0, "last_hour": None}
    except Exception as e:
        print(f"[FOOTFALL] Błąd odczytu z bazy: {e}")
        return {"wejscia": 0, "last_hour": None}


@app.get("/api/footfall")
async def get_footfall(refresh: bool = False):
    """
    Pobiera liczbę wejść dla GLS z systemu AGIS oraz JNS z TopReports.

    WAŻNE: Ten endpoint NIGDY nie blokuje - zawsze zwraca dane natychmiast z cache lub bazy.
    Dane są odświeżane w tle przez scheduler co 5 minut.

    - refresh: parametr ignorowany (dane zawsze z cache/bazy, odświeżane w tle)
    """
    try:
        now = time.time()
        result_data = {}
        sources = {}
        cache_ages = {}

        # === GLS ===
        if footfall_cache["gls"] is not None and footfall_cache["timestamp"]:
            # Mamy dane w cache - zwracamy natychmiast
            result_data["GLS"] = footfall_cache["gls"]
            sources["GLS"] = "cache"
            cache_ages["GLS"] = int(now - footfall_cache["timestamp"])
        else:
            # Brak cache - pobierz z bazy danych (szybkie)
            db_data = get_today_footfall("GLS")
            result_data["GLS"] = db_data["wejscia"]
            sources["GLS"] = "database"
            cache_ages["GLS"] = None

        # === JNS ===
        if footfall_cache["jns"] is not None and footfall_cache["jns_timestamp"]:
            # Mamy dane w cache - zwracamy natychmiast
            result_data["JNS"] = footfall_cache["jns"]
            sources["JNS"] = "cache"
            cache_ages["JNS"] = int(now - footfall_cache["jns_timestamp"])
        else:
            # Brak cache - pobierz z bazy danych (szybkie)
            db_data = get_today_footfall("JNS")
            result_data["JNS"] = db_data["wejscia"]
            sources["JNS"] = "database"
            cache_ages["JNS"] = None

        return {
            "success": True,
            "data": result_data,
            "sources": sources,
            "cache_ages_seconds": cache_ages,
            "background_refresh_active": footfall_cache["loading"],
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        print(f"[FOOTFALL API] Błąd: {e}")
        return {
            "success": False,
            "error": str(e),
            "data": {"GLS": 0, "JNS": 0}
        }


def refresh_footfall_background():
    """
    Odświeża dane footfall w tle (wywoływane przez scheduler).
    Ta funkcja NIE blokuje API - dane są aktualizowane asynchronicznie.
    """
    global footfall_cache

    if footfall_cache["loading"]:
        print("[FOOTFALL BG] Pomijam - poprzednie odświeżanie jeszcze trwa")
        return

    footfall_cache["loading"] = True
    print("[FOOTFALL BG] Rozpoczynam odświeżanie w tle...")

    try:
        # === GLS z AGIS (szybkie ~1-2s) ===
        try:
            wejscia_gls = fetch_footfall_from_agis()
            if wejscia_gls is not None:
                footfall_cache["gls"] = wejscia_gls
                footfall_cache["timestamp"] = time.time()
                save_footfall_to_db(wejscia_gls, "GLS")
                print(f"[FOOTFALL BG] GLS zaktualizowane: {wejscia_gls}")
        except Exception as e:
            print(f"[FOOTFALL BG] Błąd GLS: {e}")

        # === JNS z TopReports (wolne ~10-20s przez Selenium) ===
        try:
            wejscia_jns = fetch_footfall_jns_from_topreports()
            if wejscia_jns is not None:
                footfall_cache["jns"] = wejscia_jns
                footfall_cache["jns_timestamp"] = time.time()
                save_footfall_to_db(wejscia_jns, "JNS")
                print(f"[FOOTFALL BG] JNS zaktualizowane: {wejscia_jns}")
        except Exception as e:
            print(f"[FOOTFALL BG] Błąd JNS: {e}")

        print("[FOOTFALL BG] Odświeżanie zakończone")

    finally:
        footfall_cache["loading"] = False


@app.post("/api/footfall/sync")
async def sync_footfall():
    """Wymusza synchronizację wejść z systemu AGIS (GLS) i TopReports (JNS)"""
    results = {}

    # Sync GLS z AGIS
    wejscia_gls = fetch_footfall_from_agis()
    if wejscia_gls is not None:
        save_footfall_to_db(wejscia_gls, "GLS")
        footfall_cache["gls"] = wejscia_gls
        footfall_cache["timestamp"] = time.time()
        results["GLS"] = wejscia_gls
    else:
        results["GLS"] = None

    # Sync JNS z TopReports
    wejscia_jns = fetch_footfall_jns_from_topreports()
    if wejscia_jns is not None:
        save_footfall_to_db(wejscia_jns, "JNS")
        footfall_cache["jns"] = wejscia_jns
        footfall_cache["jns_timestamp"] = time.time()
        results["JNS"] = wejscia_jns
    else:
        results["JNS"] = None

    if results["GLS"] is not None or results["JNS"] is not None:
        return {
            "success": True,
            "message": f"Zsynchronizowano wejścia - GLS: {results['GLS']}, JNS: {results['JNS']}",
            "data": results
        }
    else:
        raise HTTPException(
            status_code=500,
            detail="Nie udało się pobrać danych z żadnego systemu"
        )


if __name__ == "__main__":
    import uvicorn
    import sys

    PORT = 5555
    print(f"Backend API - Inteligentne Zakupy")
    print(f"Adres: http://localhost:{PORT}")
    print(f"Baza danych: {DATABASE_FILE}")
    print(f"Dokumentacja: http://localhost:{PORT}/docs")

    # ==================== INICJALIZACJA CACHE ====================
    # Ładuj dane do pamięci przy starcie serwera (w tle, nie blokuje startu)
    init_cache_on_startup()

    # Skonfiguruj cykliczną synchronizację co godzinę (bez początkowej synchronizacji)
    scheduler.add_job(
        run_data_sync,
        trigger=IntervalTrigger(hours=1),
        id='data_sync_job',
        name='Synchronizacja danych co godzinę',
        replace_existing=True
    )

    # Synchronizacja planów sprzedaży z Google Sheets co 30 minut
    scheduler.add_job(
        sync_sales_plans_from_google,
        trigger=IntervalTrigger(minutes=30),
        id='sales_plans_sync_job',
        name='Synchronizacja planów sprzedaży co 30 minut',
        replace_existing=True
    )

    # Odświeżanie cache danych co 5 minut (dane w pamięci są zawsze świeże)
    scheduler.add_job(
        refresh_all_cache,
        trigger=IntervalTrigger(minutes=5),
        id='cache_refresh_job',
        name='Odświeżanie cache danych co 5 minut',
        replace_existing=True
    )

    # Odświeżanie footfall w tle co 5 minut (NIE BLOKUJE API!)
    scheduler.add_job(
        refresh_footfall_background,
        trigger=IntervalTrigger(minutes=5),
        id='footfall_refresh_job',
        name='Odświeżanie footfall w tle co 5 minut',
        replace_existing=True
    )

    # Początkowa synchronizacja planów sprzedaży przy starcie
    print("\n[SYNC] Synchronizacja planów sprzedaży przy starcie...")
    sync_sales_plans_from_google()

    # Początkowe pobranie footfall w tle (nie blokuje startu serwera)
    print("[SYNC] Rozpoczynam pobieranie footfall w tle...")
    import threading
    threading.Thread(target=refresh_footfall_background, daemon=True).start()

    scheduler.start()
    print(f"\n[OK] Zaplanowano automatyczną synchronizację danych co 1 godzinę")
    print(f"[OK] Zaplanowano automatyczną synchronizację planów sprzedaży co 30 minut")
    print(f"[OK] Zaplanowano odświeżanie cache co 5 minut")
    print(f"[OK] Zaplanowano odświeżanie footfall w tle co 5 minut")

    print("\n" + "="*60)
    print(f"URUCHAMIANIE SERWERA API")
    print("="*60 + "\n")

    try:
        uvicorn.run(app, host="0.0.0.0", port=PORT)
    except (KeyboardInterrupt, SystemExit):
        print("\n\nZamykanie serwera...")
        scheduler.shutdown()
        print("[OK] Scheduler zatrzymany")
