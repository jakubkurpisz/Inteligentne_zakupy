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
            Rodzaj TEXT,
            LastUpdated TEXT,
            LastStanChange TEXT,
            LastPriceChange TEXT,
            PreviousStan REAL DEFAULT 0,
            PreviousPrice REAL DEFAULT 0,
            IsNew INTEGER DEFAULT 0
        )
    ''')

    # Tabela do śledzenia historii zmian
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS change_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            Symbol TEXT,
            ChangeType TEXT,
            OldValue REAL,
            NewValue REAL,
            ChangeDate TEXT,
            FOREIGN KEY (Symbol) REFERENCES products(Symbol)
        )
    ''')

    conn.commit()
    conn.close()
    print(f"Baza danych SQLite '{DATABASE_FILE}' zainicjowana.")

# --- Funkcja do upsert produktu z śledzeniem zmian ---
def upsert_product(cursor, symbol, product_data, source='SQL'):
    """
    Wstawia lub aktualizuje produkt, śledząc zmiany stanu i ceny
    """
    now = datetime.now().isoformat()

    # Sprawdź czy produkt już istnieje
    cursor.execute('SELECT Symbol, Stan, DetalicznaBrutto FROM products WHERE Symbol = ?', (symbol,))
    existing = cursor.fetchone()

    new_stan = product_data['Stan']
    new_price = product_data['DetalicznaBrutto']

    if existing:
        # Produkt istnieje - sprawdź zmiany
        old_stan = existing[1] if existing[1] is not None else 0
        old_price = existing[2] if existing[2] is not None else 0

        stan_changed = abs(float(new_stan) - float(old_stan)) > 0.01
        price_changed = new_price and abs(float(new_price) - float(old_price)) > 0.01

        # Pobierz stare wartości dat i previous values PRZED update
        cursor.execute('''
            SELECT LastStanChange, LastPriceChange, PreviousStan, PreviousPrice
            FROM products WHERE Symbol = ?
        ''', (symbol,))
        old_values = cursor.fetchone()
        old_last_stan_change = old_values[0] if old_values else now
        old_last_price_change = old_values[1] if old_values else now
        old_previous_stan = old_values[2] if old_values else 0
        old_previous_price = old_values[3] if old_values else 0

        # Aktualizuj produkt
        cursor.execute('''
            UPDATE products SET
                Nazwa = ?,
                Stan = ?,
                JM = ?,
                DetalicznaNetto = ?,
                DetalicznaBrutto = ?,
                CenaPromocyjna = ?,
                Opis = ?,
                Uwagi = ?,
                Model = ?,
                Rozmiar = ?,
                Marka = ?,
                ModelSP = ?,
                Sezon = ?,
                Plec = ?,
                Kolor = ?,
                Przeznaczenie = ?,
                Rodzaj = ?,
                LastUpdated = ?,
                LastStanChange = ?,
                LastPriceChange = ?,
                PreviousStan = ?,
                PreviousPrice = ?,
                IsNew = 0
            WHERE Symbol = ?
        ''', (
            product_data['Nazwa'],
            new_stan,
            product_data['JM'],
            product_data['DetalicznaNetto'],
            new_price,
            product_data['CenaPromocyjna'],
            product_data['Opis'],
            product_data['Uwagi'],
            product_data['Model'],
            product_data['Rozmiar'],
            product_data['Marka'],
            product_data['ModelSP'],
            product_data['Sezon'],
            product_data['Plec'],
            product_data['Kolor'],
            product_data['Przeznaczenie'],
            product_data['Rodzaj'],
            now,
            now if stan_changed else old_last_stan_change,
            now if price_changed else old_last_price_change,
            old_stan if stan_changed else old_previous_stan,
            old_price if price_changed else old_previous_price,
            symbol
        ))

        # Loguj zmiany
        if stan_changed:
            cursor.execute('''
                INSERT INTO change_log (Symbol, ChangeType, OldValue, NewValue, ChangeDate)
                VALUES (?, 'STAN', ?, ?, ?)
            ''', (symbol, old_stan, new_stan, now))
            print(f"  [{source}] ZMIANA STANU: {symbol} ({old_stan} -> {new_stan})")

        if price_changed:
            cursor.execute('''
                INSERT INTO change_log (Symbol, ChangeType, OldValue, NewValue, ChangeDate)
                VALUES (?, 'PRICE', ?, ?, ?)
            ''', (symbol, old_price, new_price, now))
            print(f"  [{source}] ZMIANA CENY: {symbol} ({old_price} -> {new_price})")

    else:
        # Nowy produkt
        cursor.execute('''
            INSERT INTO products (
                Symbol, Nazwa, Stan, JM, DetalicznaNetto, DetalicznaBrutto,
                CenaPromocyjna, Opis, Uwagi, Model, Rozmiar, Marka, ModelSP,
                Sezon, Plec, Kolor, Przeznaczenie, Rodzaj,
                LastUpdated, LastStanChange, LastPriceChange,
                PreviousStan, PreviousPrice, IsNew
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            symbol,
            product_data['Nazwa'],
            new_stan,
            product_data['JM'],
            product_data['DetalicznaNetto'],
            new_price,
            product_data['CenaPromocyjna'],
            product_data['Opis'],
            product_data['Uwagi'],
            product_data['Model'],
            product_data['Rozmiar'],
            product_data['Marka'],
            product_data['ModelSP'],
            product_data['Sezon'],
            product_data['Plec'],
            product_data['Kolor'],
            product_data['Przeznaczenie'],
            product_data['Rodzaj'],
            now,
            now,
            now,
            0,
            0,
            1  # IsNew = 1 dla nowych produktów
        ))

        cursor.execute('''
            INSERT INTO change_log (Symbol, ChangeType, OldValue, NewValue, ChangeDate)
            VALUES (?, 'NEW', 0, ?, ?)
        ''', (symbol, new_stan, now))
        print(f"  [{source}] NOWY PRODUKT: {symbol}")

# --- Funkcja do pobrania danych z SQL Server i zapisania ich do SQLite ---
def upload_sql_data_to_sqlite():
    server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
    database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
    username = os.getenv('SQL_USERNAME', 'zestawienia2')
    password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

    print(f"\n[SQL Server] Laczenie z baza danych...")
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
        print(f"Blad polaczenia z SQL Server: {conn_err}")
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
    print(f"[SQL Server] Pobrano {len(rows)} produktow")

    conn_sqlite = sqlite3.connect(DATABASE_FILE)
    cursor_sqlite = conn_sqlite.cursor()

    changes_count = 0
    for row in rows:
        netto = float(row.DetalicznaNetto) if isinstance(row.DetalicznaNetto, Decimal) else row.DetalicznaNetto
        brutto = float(row.DetalicznaBrutto) if isinstance(row.DetalicznaBrutto, Decimal) else row.DetalicznaBrutto

        product_data = {
            'Nazwa': row.Nazwa,
            'Stan': float(row.Stan),
            'JM': row.JM,
            'DetalicznaNetto': netto,
            'DetalicznaBrutto': brutto,
            'CenaPromocyjna': None,
            'Opis': row.Opis,
            'Uwagi': row.Uwagi,
            'Model': row.Model,
            'Rozmiar': row.Rozmiar,
            'Marka': row.Marka,
            'ModelSP': row.ModelSP,
            'Sezon': row.Sezon,
            'Plec': row.Plec,
            'Kolor': row.Kolor,
            'Przeznaczenie': row.Przeznaczenie,
            'Rodzaj': row.Rodzaj,
        }

        upsert_product(cursor_sqlite, row.Symbol, product_data, 'SQL')
        changes_count += 1

    conn_sqlite.commit()
    conn_sqlite.close()
    cursor.close()
    connection.close()
    print(f"[SQL Server] Przetworzono {changes_count} produktow")

# --- Funkcja do pobrania danych z pliku CSV i zapisania ich do SQLite ---
def add_csv_data_to_sqlite(csv_url):
    print(f"\n[CSV] Pobieranie danych z {csv_url}...")
    try:
        response = requests.get(csv_url, timeout=30)
        response.raise_for_status()
        csv_data = response.content
        csv_df = pd.read_csv(io.StringIO(csv_data.decode('ISO-8859-2')), sep=';')
        print(f"[CSV] Pobrano {len(csv_df)} produktow")
    except Exception as e:
        print(f"Blad przy pobieraniu lub wczytywaniu pliku CSV: {e}")
        return

    conn_sqlite = sqlite3.connect(DATABASE_FILE)
    cursor_sqlite = conn_sqlite.cursor()

    changes_count = 0
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

        product_data = {
            'Nazwa': nazwa,
            'Stan': float(stan),
            'JM': jm,
            'DetalicznaNetto': None,
            'DetalicznaBrutto': float(detaliczna_brutto) if isinstance(detaliczna_brutto, (int, float, Decimal)) else None,
            'CenaPromocyjna': float(cena_promocyjna) if isinstance(cena_promocyjna, (int, float, Decimal)) else None,
            'Opis': model_sp,
            'Uwagi': None,
            'Model': model_full,
            'Rozmiar': rozmiar,
            'Marka': marka,
            'ModelSP': model_sp,
            'Sezon': None,
            'Plec': None,
            'Kolor': kolor,
            'Przeznaczenie': None,
            'Rodzaj': None,
        }

        upsert_product(cursor_sqlite, symbol, product_data, 'CSV')
        changes_count += 1

    conn_sqlite.commit()
    conn_sqlite.close()
    print(f"[CSV] Przetworzono {changes_count} produktow")

# --- Funkcja do pobierania statystyk ---
def get_stats():
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) FROM products')
    total = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM products WHERE IsNew = 1')
    new_products = cursor.fetchone()[0]

    # Produkty zmienione w ostatnim uruchomieniu (ostatnie 6 minut)
    cursor.execute('''
        SELECT COUNT(*) FROM products
        WHERE datetime(LastUpdated) > datetime('now', '-6 minutes')
        AND IsNew = 0
    ''')
    recently_updated = cursor.fetchone()[0]

    cursor.execute('''
        SELECT COUNT(*) FROM change_log
        WHERE datetime(ChangeDate) > datetime('now', '-6 minutes')
    ''')
    recent_changes = cursor.fetchone()[0]

    conn.close()

    return {
        'total': total,
        'new': new_products,
        'updated': recently_updated,
        'changes': recent_changes
    }

# Główna funkcja wykonawcza
def execute_script():
    print(f"\n{'='*60}")
    print(f"Rozpoczynam aktualizacje danych: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    init_db()
    upload_sql_data_to_sqlite()
    csv_url = 'https://176.32.163.90/ealpinepro2/dane/sporting/stan.csv'
    add_csv_data_to_sqlite(csv_url)

    # Statystyki
    stats = get_stats()
    print(f"\n{'='*60}")
    print(f"PODSUMOWANIE:")
    print(f"  Laczna liczba produktow: {stats['total']}")
    print(f"  Nowe produkty: {stats['new']}")
    print(f"  Zaktualizowane produkty: {stats['updated']}")
    print(f"  Laczna liczba zmian: {stats['changes']}")
    print(f"{'='*60}\n")

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
                import traceback
                traceback.print_exc()
                sys.exit(1)

if __name__ == '__main__':
    # Inicjalizacja bazy danych przy starcie skryptu
    init_db()

    # Uruchom raz
    execute_script_with_retry()

    # Pętla co 5 minut (tylko jeśli uruchomiony bezpośrednio)
    # while True:
    #     time.sleep(300)
    #     execute_script_with_retry()
