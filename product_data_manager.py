import pyodbc
from datetime import datetime
from decimal import Decimal
import time
import requests
import pandas as pd
import io
import sys
import os
import sqlite3
from dotenv import load_dotenv

load_dotenv()

DATABASE_FILE = 'product_states.db'

# --- Funkcja pomocnicza do wyciągania ModelSP ---
def extract_model_sp(value):
    words = str(value).upper().split()
    if not words:
        return ""
    last = words[-1]
    # jeśli ostatni wyraz to liczba -> weź dwa ostatnie; w przeciwnym razie tylko ostatni
    if last.isdigit() and len(words) >= 2:
        return f"{words[-2]} {words[-1]}"
    return last

# --- Inicjalizacja bazy danych SQLite ---
def init_db():
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            Symbol TEXT PRIMARY KEY,
            Nazwa TEXT,
            Stan REAL,
            JM TEXT,
            DetalicznaNetto REAL,
            DetalicznaBrutto REAL,
            CenaPromocyjna REAL,
            Opis TEXT,
            Uwagi TEXT,
            Model TEXT,
            Rozmiar TEXT,
            Marka TEXT,
            ModelSP TEXT,
            Sezon TEXT,
            Plec TEXT,
            Kolor TEXT,
            Przeznaczenie TEXT,
            Rodzaj TEXT
        )
    ''')
    conn.commit()
    conn.close()
    print(f"Baza danych SQLite '{DATABASE_FILE}' zainicjowana.")

# --- Funkcja do pobrania danych z SQL Server i zapisania ich do SQLite ---
def upload_sql_data_to_sqlite():
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
        print(f"Błąd połączenia z SQL Server: {conn_err}")
        raise

    cursor = connection.cursor()
    query = """
    SELECT Tw_Symbol AS Symbol,
           Tw_Nazwa AS Nazwa,
           SUM(tw_Stan.st_Stan) AS Stan,
           st_MagId AS MagID,
           tw_Pole2 AS Marka,
           'szt.' AS JM,
           '' AS Model,
           tw_Opis AS Opis,
           tw_pole1 AS Rozmiar,
           tc_CenaNetto1 AS DetalicznaNetto,
           tc_CenaBrutto1 AS DetalicznaBrutto,
           tw_Uwagi AS Uwagi,
           tw_pole3 AS ModelSP,
           tw_pole4 AS Sezon,
           tw_pole5 AS Plec,
           tw_pole6 AS Kolor,
           tw_pole7 AS Przeznaczenie,
           tw_pole8 AS Rodzaj
    FROM tw_Stan
    LEFT JOIN tw__Towar ON st_TowId = tw_Id
    LEFT JOIN tw_Cena ON st_TowId = tc_IdTowar
    WHERE st_Stan > 0 AND st_MagId IN (1, 3, 7, 9)
    GROUP BY Tw_Symbol, Tw_Nazwa, st_MagId, tw_Pole2, tw_Opis, tw_pole1, tw_pole3,
             tw_pole6, tw_pole5, tw_pole4, tw_pole7, tw_pole8, tc_CenaNetto1, tc_CenaBrutto1, tw_Uwagi
    """
    cursor.execute(query)
    rows = cursor.fetchall()

    conn_sqlite = sqlite3.connect(DATABASE_FILE)
    cursor_sqlite = conn_sqlite.cursor()

    for row in rows:
        netto = float(row.DetalicznaNetto) if isinstance(row.DetalicznaNetto, Decimal) else row.DetalicznaNetto
        brutto = float(row.DetalicznaBrutto) if isinstance(row.DetalicznaBrutto, Decimal) else row.DetalicznaBrutto

        cursor_sqlite.execute('''
            INSERT OR REPLACE INTO products (
                Symbol, Nazwa, Stan, JM, DetalicznaNetto, DetalicznaBrutto,
                CenaPromocyjna, Opis, Uwagi, Model, Rozmiar, Marka, ModelSP,
                Sezon, Plec, Kolor, Przeznaczenie, Rodzaj
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            row.Symbol,
            row.Nazwa,
            float(row.Stan),
            row.JM,
            netto,
            brutto,
            None, # CenaPromocyjna - brak w SQL Server query
            row.Opis,
            row.Uwagi,
            row.Model,
            row.Rozmiar,
            row.Marka,
            row.ModelSP,
            row.Sezon,
            row.Plec,
            row.Kolor,
            row.Przeznaczenie,
            row.Rodzaj,
        ))
    conn_sqlite.commit()
    conn_sqlite.close()
    cursor.close()
    connection.close()
    print("Dane z SQL Server zostały zaktualizowane w bazie SQLite.")

# --- Funkcja do pobrania danych z pliku CSV i zapisania ich do SQLite ---
def add_csv_data_to_sqlite(csv_url):
    try:
        response = requests.get(csv_url)
        response.raise_for_status()
        csv_data = response.content
        csv_df = pd.read_csv(io.StringIO(csv_data.decode('ISO-8859-2')), sep=';')
        print("Plik CSV został wczytany poprawnie.")
    except Exception as e:
        print(f"Błąd przy pobieraniu lub wczytywaniu pliku CSV: {e}")
        return

    conn_sqlite = sqlite3.connect(DATABASE_FILE)
    cursor_sqlite = conn_sqlite.cursor()

    for _, row in csv_df.iterrows():
        symbol = str(row['KODEAN13']).upper()
        nazwa = (str(row['Model']) + ' ' + str(row['Kolor'])).upper()
        stan = row['Stan']
        jm = 'szt.'
        marka = 'ALPINE PRO'
        model_full = str(row['Model']).upper()
        model_sp = extract_model_sp(row['Model'])
        cena_promocyjna = row['PCena']
        detaliczna_brutto = row['Cena_Detal']
        rozmiar = row.get('Rozmiar', '')
        kolor = row.get('Kolor', '')

        cursor_sqlite.execute('''
            INSERT OR REPLACE INTO products (
                Symbol, Nazwa, Stan, JM, DetalicznaNetto, DetalicznaBrutto,
                CenaPromocyjna, Opis, Uwagi, Model, Rozmiar, Marka, ModelSP,
                Sezon, Plec, Kolor, Przeznaczenie, Rodzaj
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            symbol,
            nazwa,
            float(stan),
            jm,
            None, # DetalicznaNetto - brak w CSV
            float(detaliczna_brutto) if isinstance(detaliczna_brutto, (int, float, Decimal)) else None,
            float(cena_promocyjna) if isinstance(cena_promocyjna, (int, float, Decimal)) else None,
            model_sp, # Opis - używamy ModelSP jako Opis z CSV
            None, # Uwagi - brak w CSV
            model_full,
            rozmiar,
            marka,
            model_sp, # ModelSP
            None, # Sezon - brak w CSV
            None, # Plec - brak w CSV
            kolor,
            None, # Przeznaczenie - brak w CSV
            None, # Rodzaj - brak w CSV
        ))
    conn_sqlite.commit()
    conn_sqlite.close()
    print("Dane z CSV zostały zaktualizowane w bazie SQLite.")

# --- Funkcja do pobierania wszystkich danych z SQLite ---
def get_all_products_from_db():
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row # Umożliwia dostęp do kolumn po nazwie
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM products')
    products = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return products

# Główna funkcja wykonawcza
def execute_script():
    init_db()
    upload_sql_data_to_sqlite()
    csv_url = 'https://176.32.163.90/ealpinepro2/dane/sporting/stan.csv'
    add_csv_data_to_sqlite(csv_url)

    # --- Tymczasowe wyświetlanie danych z bazy SQLite ---
    print("\n--- Przykładowe dane z bazy SQLite (pierwsze 5 rekordów) ---")
    products_sample = get_all_products_from_db()[:5]
    for product in products_sample:
        print(product)
    print("-------------------------------------------------------")

# Retry i pętla główna
def execute_script_with_retry(retry_count=5):
    for attempt in range(retry_count):
        try:
            execute_script()
            print(f"Script executed successfully at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            return
        except Exception as e:
            if 'getaddrinfo failed' in str(e):
                print(f"Attempt {attempt+1} failed due to NameResolutionError: {e}")
                if attempt < retry_count-1:
                    time.sleep(30)
                    continue
                else:
                    print("Maximum retry attempts reached for NameResolutionError. Exiting script.")
                    sys.exit(1)
            else:
                print(f"An unexpected error occurred: {e}")
                sys.exit(1)

if __name__ == '__main__':
    # Inicjalizacja bazy danych przy starcie skryptu
    init_db()
    while True:
        execute_script_with_retry()
        time.sleep(300)
