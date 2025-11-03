from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
from datetime import datetime
from pathlib import Path
import subprocess
import threading
import time
from typing import Dict, List, Optional
import pyodbc
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Inteligentne Zakupy API")

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


def run_python_script():
    """Uruchamia skrypt Pythona do aktualizacji danych"""
    print(f"Uruchamiam skrypt Pythona: {PYTHON_SCRIPT}")
    try:
        result = subprocess.run(
            ["python", str(PYTHON_SCRIPT)],
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


# Uruchom skrypt przy starcie i w tle co 5 minut
@app.on_event("startup")
async def startup_event():
    # Uruchom raz przy starcie
    threading.Thread(target=run_python_script, daemon=True).start()
    # Uruchom harmonogram w tle
    threading.Thread(target=schedule_python_script, daemon=True).start()


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


@app.get("/")
async def root():
    """Endpoint główny"""
    return {
        "message": "Inteligentne Zakupy API",
        "version": "1.0.0",
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
    period: Optional[str] = "daily",  # daily, weekly, monthly, yearly
    mag_ids: Optional[str] = None  # Comma-separated mag_ids, np. "1,7,9"
):
    """Pobiera historię sprzedaży z SQL Server z możliwością filtrowania"""
    server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
    database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
    username = os.getenv('SQL_USERNAME', 'zestawienia2')
    password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

    try:
        connection = pyodbc.connect(
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

    cursor = connection.cursor()

    # Parsowanie mag_ids
    if mag_ids:
        # Konwertuj string "1,7,9" na listę [1, 7, 9]
        mag_id_list = [int(x.strip()) for x in mag_ids.split(',') if x.strip().isdigit()]
        mag_id_filter = ','.join(str(x) for x in mag_id_list)
    else:
        # Domyślnie wszystkie magazyny
        mag_id_filter = "1,7,9"

    # Zapytanie z Twojego skryptu SPRZEDAZ_DZIENNA.PY - używa widoku vwZstSprzWgKhnt
    query = f"""
    SELECT
        dok_DataWyst AS DataSprzedazy,
        SUM(CASE
                WHEN dok_Typ IN (14, 6) THEN -ob_IloscMag
                ELSE ob_IloscMag
            END) AS IloscSprzedana,
        SUM(CASE
                WHEN dok_Typ IN (14, 6) THEN -ob_WartNetto
                ELSE ob_WartNetto
            END) AS WartoscNetto,
        SUM(CASE
                WHEN dok_Typ IN (14, 6) THEN -ob_WartBrutto
                ELSE ob_WartBrutto
            END) AS WartoscBrutto,
        COUNT(DISTINCT dok_NrPelny) as LiczbaTransakcji,
        COUNT(DISTINCT ob_TowId) as LiczbaProduktow
    FROM
        vwZstSprzWgKhnt
    WHERE
        dok_MagId IN ({mag_id_filter})
        AND dok_Podtyp <> 1
        AND dok_Status <> 2
    """

    # Dodaj filtrowanie dat jeśli podane
    params = []
    if start_date:
        query += " AND CAST(dok_DataWyst AS DATE) >= ?"
        params.append(start_date)
    if end_date:
        query += " AND CAST(dok_DataWyst AS DATE) <= ?"
        params.append(end_date)

    query += " GROUP BY dok_DataWyst"
    query += " ORDER BY DataSprzedazy DESC"

    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()

        sales_history = []
        for row in rows:
            sales_history.append({
                "DataSprzedazy": row.DataSprzedazy.strftime('%Y-%m-%d') if row.DataSprzedazy else None,
                "IloscSprzedana": float(row.IloscSprzedana or 0),
                "WartoscNetto": float(row.WartoscNetto or 0),
                "WartoscBrutto": float(row.WartoscBrutto or 0),
                "LiczbaTransakcji": int(row.LiczbaTransakcji or 0),
                "LiczbaProduktow": int(row.LiczbaProduktow or 0)
            })

        cursor.close()
        connection.close()

        return {
            "period": period,
            "start_date": start_date,
            "end_date": end_date,
            "total_records": len(sales_history),
            "data": sales_history
        }

    except Exception as e:
        cursor.close()
        connection.close()
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


@app.get("/api/dead-stock")
async def get_dead_stock(
    min_days: Optional[int] = 0,  # Minimum dni bez ruchu
    min_value: Optional[float] = 0,  # Minimalna wartość zamrożonego kapitału
    category: Optional[str] = None,  # Filtrowanie po kategorii (Rodzaj)
    sort_by: Optional[str] = "days_no_movement",  # Sortowanie: days_no_movement, frozen_value, turnover_ratio
    mag_ids: Optional[str] = None  # Comma-separated mag_ids
):
    """
    Pobiera dane o martwych stanach magazynowych (Dead Stock)
    - Oblicza Days of No Movement (DNM) na podstawie LastStanChange
    - Oblicza wskaźnik rotacji zapasów (Inventory Turnover Ratio)
    - Oblicza zamrożony kapitał (Frozen Capital)
    - Kategoryzuje produkty (DEAD, VERY_SLOW, SLOW, NORMAL, FAST)
    """

    try:
        # Połączenie z SQLite
        conn = get_db_connection()
        cursor = conn.cursor()

        # Pobierz wszystkie produkty z bazy SQLite
        cursor.execute("SELECT * FROM products")
        products = cursor.fetchall()
        conn.close()

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

        # Parsowanie mag_ids
        if mag_ids:
            mag_id_list = [int(x.strip()) for x in mag_ids.split(',') if x.strip().isdigit()]
            mag_id_filter = ','.join(str(x) for x in mag_id_list)
        else:
            mag_id_filter = "1,7,9"

        # Przygotuj zapytanie SQL do pobierania sprzedaży z ostatnich 90 dni dla każdego produktu
        # Używamy vwZstSprzWgKhnt jak w SPRZEDAZ_DZIENNA.PY
        sales_query = f"""
        WITH FilteredTowar AS (
            SELECT
                tw_Id,
                tw_Symbol
            FROM
                tw__Towar
        )
        SELECT
            MAX(FilteredTowar.tw_Symbol) AS Symbol,
            SUM(CASE
                    WHEN dok_Typ IN (14, 6) THEN -ob_IloscMag
                    ELSE ob_IloscMag
                END) AS IloscSprzedana,
            SUM(CASE
                    WHEN dok_Typ IN (14, 6) THEN -ob_WartBrutto
                    ELSE ob_WartBrutto
                END) AS WartoscSprzedazy,
            MAX(dok_DataWyst) AS OstatniaSprzedaz
        FROM
            vwZstSprzWgKhnt
        LEFT JOIN
            FilteredTowar ON ob_TowId = FilteredTowar.tw_Id
        WHERE
            CAST(dok_DataWyst AS DATE) >= DATEADD(day, -90, CAST(GETDATE() AS DATE))
            AND dok_MagId IN ({mag_id_filter})
            AND dok_Podtyp <> 1
            AND dok_Status <> 2
        GROUP BY
            ob_TowId
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

        # Konwertuj dane sprzedaży na słownik dla szybkiego dostępu
        sales_data = {}
        for row in sales_rows:
            symbol = row.Symbol
            if symbol:
                sales_data[symbol] = {
                    "IloscSprzedana": float(row.IloscSprzedana or 0),
                    "WartoscSprzedazy": float(row.WartoscSprzedazy or 0),
                    "OstatniaSprzedaz": row.OstatniaSprzedaz.strftime('%Y-%m-%d') if row.OstatniaSprzedaz else None
                }

        sql_cursor.close()
        sql_connection.close()

        # Analiza dead stock
        dead_stock_items = []
        today = datetime.now()

        for product in products:
            product_dict = dict(product)
            symbol = product_dict.get('Symbol')

            # Bezpieczna konwersja stanu
            try:
                stan = float(product_dict.get('Stan') or 0)
            except (ValueError, TypeError):
                stan = 0

            # Pomiń produkty z zerowym stanem
            if stan <= 0:
                continue

            # Oblicz Days of No Movement (DNM) na podstawie LastStanChange
            last_stan_change = product_dict.get('LastStanChange')
            if last_stan_change:
                try:
                    last_change_date = datetime.strptime(last_stan_change, '%Y-%m-%d %H:%M:%S')
                    days_no_movement = (today - last_change_date).days
                except ValueError:
                    try:
                        last_change_date = datetime.strptime(last_stan_change, '%Y-%m-%d')
                        days_no_movement = (today - last_change_date).days
                    except ValueError:
                        days_no_movement = 0
            else:
                days_no_movement = 0

            # Pomiń produkty, które nie spełniają minimalnego kryterium dni
            if days_no_movement < min_days:
                continue

            # Oblicz zamrożony kapitał (używamy DetalicznaNetto jako kosztu)
            # W idealnym przypadku powinniśmy użyć ob_WartMag z SQL Server
            try:
                price_netto = float(product_dict.get('DetalicznaNetto') or 0)
            except (ValueError, TypeError):
                price_netto = 0

            frozen_value = stan * price_netto

            # Pomiń produkty o wartości poniżej minimalnej
            if frozen_value < min_value:
                continue

            # Pobierz dane sprzedaży z ostatnich 90 dni
            sales_info = sales_data.get(symbol, {
                "IloscSprzedana": 0,
                "WartoscSprzedazy": 0,
                "OstatniaSprzedaz": None
            })

            # Oblicz wskaźnik rotacji (Inventory Turnover Ratio)
            # Turnover Ratio = Sprzedaż (90 dni) / Średni stan magazynowy
            # Zakładamy, że średni stan ≈ aktualny stan (uproszczenie)
            if frozen_value > 0:
                turnover_ratio = sales_info["WartoscSprzedazy"] / frozen_value
            else:
                turnover_ratio = 0

            # Kategoryzacja produktu
            if days_no_movement >= 180:
                category_label = "DEAD"
            elif days_no_movement >= 90:
                category_label = "VERY_SLOW"
            elif days_no_movement >= 60:
                category_label = "SLOW"
            elif days_no_movement >= 30:
                category_label = "NORMAL"
            else:
                category_label = "FAST"

            # Rekomendacja akcji
            if category_label == "DEAD" and frozen_value > 1000:
                recommendation = "WYPRZEDAŻ - Pilna redukcja ceny o 50%+"
            elif category_label == "DEAD":
                recommendation = "WYPRZEDAŻ - Redukcja ceny o 30-50%"
            elif category_label == "VERY_SLOW" and frozen_value > 1000:
                recommendation = "PROMOCJA - Obniżka ceny o 20-30%"
            elif category_label == "VERY_SLOW":
                recommendation = "PROMOCJA - Obniżka ceny o 15-20%"
            elif category_label == "SLOW":
                recommendation = "MONITORUJ - Rozważ promocję"
            else:
                recommendation = "OK - Brak działań"

            # Filtrowanie po kategorii (Rodzaj)
            if category and product_dict.get('Rodzaj') != category:
                continue

            # Bezpieczna konwersja DetalicznaBrutto
            try:
                detaliczna_brutto = float(product_dict.get('DetalicznaBrutto') or 0)
            except (ValueError, TypeError):
                detaliczna_brutto = 0

            dead_stock_items.append({
                "Symbol": symbol,
                "Nazwa": product_dict.get('Nazwa', ''),
                "Marka": product_dict.get('Marka', ''),
                "Rodzaj": product_dict.get('Rodzaj', 'Nieznana'),
                "Stan": stan,
                "DetalicznaNetto": price_netto,
                "DetalicznaBrutto": detaliczna_brutto,
                "LastStanChange": last_stan_change,
                "DaysNoMovement": days_no_movement,
                "FrozenValue": frozen_value,
                "IloscSprzedana90dni": sales_info["IloscSprzedana"],
                "WartoscSprzedazy90dni": sales_info["WartoscSprzedazy"],
                "OstatniaSprzedaz": sales_info["OstatniaSprzedaz"],
                "TurnoverRatio": round(turnover_ratio, 2),
                "Category": category_label,
                "Recommendation": recommendation,
                "Rozmiar": product_dict.get('Rozmiar', ''),
                "Kolor": product_dict.get('Kolor', ''),
                "Sezon": product_dict.get('Sezon', '')
            })

        # Sortowanie
        sort_mapping = {
            "days_no_movement": lambda x: x["DaysNoMovement"],
            "frozen_value": lambda x: x["FrozenValue"],
            "turnover_ratio": lambda x: x["TurnoverRatio"]
        }

        if sort_by in sort_mapping:
            dead_stock_items.sort(key=sort_mapping[sort_by], reverse=True)

        # Oblicz statystyki
        total_dead_stock = len(dead_stock_items)
        total_frozen_value = sum(item["FrozenValue"] for item in dead_stock_items)
        avg_days_no_movement = sum(item["DaysNoMovement"] for item in dead_stock_items) / total_dead_stock if total_dead_stock > 0 else 0

        # Statystyki kategorii
        category_stats = {
            "DEAD": len([x for x in dead_stock_items if x["Category"] == "DEAD"]),
            "VERY_SLOW": len([x for x in dead_stock_items if x["Category"] == "VERY_SLOW"]),
            "SLOW": len([x for x in dead_stock_items if x["Category"] == "SLOW"]),
            "NORMAL": len([x for x in dead_stock_items if x["Category"] == "NORMAL"]),
            "FAST": len([x for x in dead_stock_items if x["Category"] == "FAST"])
        }

        return {
            "total_items": total_dead_stock,
            "total_frozen_value": round(total_frozen_value, 2),
            "avg_days_no_movement": round(avg_days_no_movement, 1),
            "category_stats": category_stats,
            "filters": {
                "min_days": min_days,
                "min_value": min_value,
                "category": category,
                "sort_by": sort_by,
                "mag_ids": mag_id_filter
            },
            "items": dead_stock_items
        }

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd bazy danych SQLite: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Nieoczekiwany błąd: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    PORT = 3002
    print(f"Backend API działa na http://localhost:{PORT}")
    print(f"Dane pobierane z bazy danych SQLite: {DATABASE_FILE}")
    print(f"Dokumentacja API: http://localhost:{PORT}/docs")
    uvicorn.run(app, host="0.0.0.0", port=PORT)  # Udostępnij w sieci lokalnej
