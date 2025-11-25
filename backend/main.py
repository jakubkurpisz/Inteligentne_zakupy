from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

        query = "SELECT date, gls, four_f, jeans, total FROM sales_plans"
        params = []

        if start_date or end_date:
            conditions = []
            if start_date:
                conditions.append("date >= ?")
                params.append(start_date)
            if end_date:
                conditions.append("date <= ?")
                params.append(end_date)
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY date DESC"

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
async def get_sales_data():
    """Pobiera wszystkie dane produktów z bazy danych"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM products")
        rows = cursor.fetchall()
        conn.close()

        # Konwertuj Row objects na słowniki
        data = [dict(row) for row in rows]
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
        weekly_sales = []
        for row in weekly_rows:
            day_name = day_names[row[0].weekday()]
            weekly_sales.append({
                "name": day_name,
                "data": row[0].strftime('%Y-%m-%d'),
                "sprzedaz": float(row[1] or 0)
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
    mag_ids: Optional[str] = None  # Unused for now - all warehouses included in cache
):
    """
    ZOPTYMALIZOWANY endpoint - czyta z pre-computed cache (tabela dead_stock_analysis).
    Cache jest aktualizowany co 5 minut przez scheduled task w product_data_manager_optimized.py.

    Parametry:
    - min_days: Minimum dni bez ruchu
    - min_value: Minimalna wartość zamrożonego kapitału
    - category: Filtrowanie po kategorii (Rodzaj produktu)
    - marka: Filtrowanie po marce
    - rotation_status: Filtrowanie po statusie rotacji
    - sort_by: Sortowanie (days_no_movement, frozen_value, dni_zapasu)
    """

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Buduj SQL query z filtrami
        sql_query = "SELECT * FROM dead_stock_analysis WHERE 1=1"
        params = []

        # Filtr: minimum dni bez ruchu
        if min_days > 0:
            sql_query += " AND DaysNoMovement >= ?"
            params.append(min_days)

        # Filtr: minimalna wartość zamrożonego kapitału
        if min_value > 0:
            sql_query += " AND FrozenValue >= ?"
            params.append(min_value)

        # Filtr: kategoria (Rodzaj produktu)
        if category:
            sql_query += " AND Rodzaj = ?"
            params.append(category)

        # Filtr: marka
        if marka:
            sql_query += " AND Marka = ?"
            params.append(marka)

        # Filtr: status rotacji
        if rotation_status:
            sql_query += " AND Category = ?"
            params.append(rotation_status.upper())

        # Sortowanie
        sort_column = {
            "days_no_movement": "DaysNoMovement DESC",
            "frozen_value": "FrozenValue DESC",
            "dni_zapasu": "DniZapasu DESC"
        }.get(sort_by, "DaysNoMovement DESC")

        sql_query += f" ORDER BY {sort_column}"

        # Wykonaj zapytanie
        cursor.execute(sql_query, params)
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description]

        # Konwertuj do listy słowników
        items = []
        for row in rows:
            item_dict = dict(zip(columns, row))
            items.append(item_dict)

        # Oblicz statystyki
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
            "NEW": 0,
            "NEW_NO_SALES": 0,
            "NEW_SELLING": 0,
            "NEW_SLOW": 0,
            "REPEATED_NO_SALES": 0,
            "VERY_FAST": 0,
            "FAST": 0,
            "NORMAL": 0,
            "SLOW": 0,
            "VERY_SLOW": 0,
            "DEAD": 0
        }

        total_frozen_value = 0
        for cat_row in category_stats_raw:
            cat_name = cat_row[0]
            cat_count = cat_row[1]
            cat_value = cat_row[2] or 0
            category_stats[cat_name] = cat_count
            total_frozen_value += cat_value

        # Oblicz średnią dni bez ruchu dla przefiltrowanych produktów
        if items:
            avg_days = sum(item.get('DaysNoMovement', 0) for item in items) / len(items)
        else:
            avg_days = 0

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
                "is_cached": True
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


if __name__ == "__main__":
    import uvicorn
    import sys

    PORT = 5555
    print(f"Backend API - Inteligentne Zakupy")
    print(f"Adres: http://localhost:{PORT}")
    print(f"Baza danych: {DATABASE_FILE}")
    print(f"Dokumentacja: http://localhost:{PORT}/docs")

    # Skonfiguruj cykliczną synchronizację co godzinę (bez początkowej synchronizacji)
    scheduler.add_job(
        run_data_sync,
        trigger=IntervalTrigger(hours=1),
        id='data_sync_job',
        name='Synchronizacja danych co godzinę',
        replace_existing=True
    )
    scheduler.start()
    print(f"\n[OK] Zaplanowano automatyczną synchronizację danych co 1 godzinę")

    print("\n" + "="*60)
    print(f"URUCHAMIANIE SERWERA API")
    print("="*60 + "\n")

    try:
        uvicorn.run(app, host="0.0.0.0", port=PORT)
    except (KeyboardInterrupt, SystemExit):
        print("\n\nZamykanie serwera...")
        scheduler.shutdown()
        print("[OK] Scheduler zatrzymany")
