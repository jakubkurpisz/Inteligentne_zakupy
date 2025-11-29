import pymssql
from datetime import datetime, date
from decimal import Decimal
import time
import requests
import pandas as pd
import io
import sys
import os
import sqlite3
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

# Use absolute path to match main.py
SCRIPT_DIR = Path(__file__).parent
DATABASE_FILE = SCRIPT_DIR / 'product_states.db'

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
            CenaZakupuNetto REAL,
            StawkaVAT REAL,
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
            IsNew INTEGER DEFAULT 0,
            DateAdded TEXT
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

    # Tabela do przechowywania historii sprzedaży
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sales_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            DataSprzedazy DATE NOT NULL,
            MagId INTEGER NOT NULL,
            IloscSprzedana REAL DEFAULT 0,
            WartoscNetto REAL DEFAULT 0,
            WartoscBrutto REAL DEFAULT 0,
            LiczbaTransakcji INTEGER DEFAULT 0,
            LiczbaProduktow INTEGER DEFAULT 0,
            LastUpdated TEXT,
            UNIQUE(DataSprzedazy, MagId)
        )
    ''')

    # Tabela do indeksów dla szybszego wyszukiwania
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_sales_history_date
        ON sales_history(DataSprzedazy)
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_sales_history_mag
        ON sales_history(MagId)
    ''')

    # Tabela cache dla analizy dead stock (pre-computed)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS dead_stock_analysis (
            Symbol TEXT PRIMARY KEY,
            Nazwa TEXT,
            Marka TEXT,
            Rodzaj TEXT,
            Stan REAL,
            DetalicznaNetto REAL,
            DetalicznaBrutto REAL,
            LastStanChange TEXT,
            DaysNoMovement INTEGER,
            FrozenValue REAL,
            SprzedazRoczna REAL,
            SredniaDziennaSprzedaz REAL,
            DniZapasu REAL,
            OstatniaSprzedaz TEXT,
            Category TEXT,
            Recommendation TEXT,
            Rozmiar TEXT,
            Kolor TEXT,
            Sezon TEXT,
            ProductAge INTEGER,
            LastAnalysisUpdate TEXT,
            DateAdded TEXT,
            FOREIGN KEY (Symbol) REFERENCES products(Symbol)
        )
    ''')

    # Indeksy dla dead_stock_analysis
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_dead_stock_category
        ON dead_stock_analysis(Category)
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_dead_stock_marka
        ON dead_stock_analysis(Marka)
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_dead_stock_rodzaj
        ON dead_stock_analysis(Rodzaj)
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_dead_stock_days
        ON dead_stock_analysis(DaysNoMovement)
    ''')

    # Tabela do przechowywania planów sprzedażowych z Google Sheets
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sales_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            gls REAL DEFAULT 0,
            four_f REAL DEFAULT 0,
            jeans REAL DEFAULT 0,
            total REAL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Indeks dla sales_plans
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_sales_plans_date
        ON sales_plans(date)
    ''')

    # Tabela do przechowywania niestandardowych okresów zapasu dla produktów
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS custom_stock_periods (
            symbol TEXT PRIMARY KEY,
            custom_period_days INTEGER NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (symbol) REFERENCES products(Symbol)
        )
    ''')

    # Indeks dla custom_stock_periods
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_custom_stock_periods_symbol
        ON custom_stock_periods(symbol)
    ''')

    # Migracja: Dodaj brakujące kolumny jeśli nie istnieją
    try:
        # Sprawdź czy kolumny istnieją w products
        cursor.execute("PRAGMA table_info(products)")
        columns = [column[1] for column in cursor.fetchall()]

        # Dodaj kolumny które nie istnieją
        if 'Grupa' not in columns:
            cursor.execute('ALTER TABLE products ADD COLUMN Grupa TEXT')
            print("Dodano kolumnę Grupa")

        if 'LastUpdated' not in columns:
            cursor.execute('ALTER TABLE products ADD COLUMN LastUpdated TEXT')
            print("Dodano kolumnę LastUpdated")

        if 'LastStanChange' not in columns:
            cursor.execute('ALTER TABLE products ADD COLUMN LastStanChange TEXT')
            print("Dodano kolumnę LastStanChange")

        if 'LastPriceChange' not in columns:
            cursor.execute('ALTER TABLE products ADD COLUMN LastPriceChange TEXT')
            print("Dodano kolumnę LastPriceChange")

        if 'PreviousStan' not in columns:
            cursor.execute('ALTER TABLE products ADD COLUMN PreviousStan REAL DEFAULT 0')
            print("Dodano kolumnę PreviousStan")

        if 'PreviousPrice' not in columns:
            cursor.execute('ALTER TABLE products ADD COLUMN PreviousPrice REAL DEFAULT 0')
            print("Dodano kolumnę PreviousPrice")

        if 'IsNew' not in columns:
            cursor.execute('ALTER TABLE products ADD COLUMN IsNew INTEGER DEFAULT 0')
            print("Dodano kolumnę IsNew")

        if 'DateAdded' not in columns:
            cursor.execute('ALTER TABLE products ADD COLUMN DateAdded TEXT')
            # Dla istniejących produktów ustaw DateAdded na LastUpdated (najlepsza dostępna aproksymacja)
            cursor.execute('UPDATE products SET DateAdded = LastUpdated WHERE DateAdded IS NULL')
            print("Dodano kolumnę DateAdded")

        if 'CenaZakupuNetto' not in columns:
            cursor.execute('ALTER TABLE products ADD COLUMN CenaZakupuNetto REAL')
            print("Dodano kolumnę CenaZakupuNetto")

        if 'StawkaVAT' not in columns:
            cursor.execute('ALTER TABLE products ADD COLUMN StawkaVAT REAL')
            print("Dodano kolumnę StawkaVAT")

        # Sprawdź kolumny w dead_stock_analysis
        cursor.execute("PRAGMA table_info(dead_stock_analysis)")
        dead_stock_columns = [column[1] for column in cursor.fetchall()]

        if 'HadZeroStock' not in dead_stock_columns:
            cursor.execute('ALTER TABLE dead_stock_analysis ADD COLUMN HadZeroStock INTEGER DEFAULT 0')
            print("Dodano kolumnę HadZeroStock do dead_stock_analysis")

        if 'LastZeroDate' not in dead_stock_columns:
            cursor.execute('ALTER TABLE dead_stock_analysis ADD COLUMN LastZeroDate TEXT')
            print("Dodano kolumnę LastZeroDate do dead_stock_analysis")

        if 'DaysSinceLastZero' not in dead_stock_columns:
            cursor.execute('ALTER TABLE dead_stock_analysis ADD COLUMN DaysSinceLastZero INTEGER')
            print("Dodano kolumnę DaysSinceLastZero do dead_stock_analysis")

        if 'TotalDeliveries' not in dead_stock_columns:
            cursor.execute('ALTER TABLE dead_stock_analysis ADD COLUMN TotalDeliveries INTEGER')
            print("Dodano kolumnę TotalDeliveries do dead_stock_analysis")

        if 'SalesAfterLastDelivery' not in dead_stock_columns:
            cursor.execute('ALTER TABLE dead_stock_analysis ADD COLUMN SalesAfterLastDelivery REAL')
            print("Dodano kolumnę SalesAfterLastDelivery do dead_stock_analysis")

    except Exception as e:
        print(f"Ostrzeżenie podczas migracji: {e}")

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
                CenaZakupuNetto = ?,
                StawkaVAT = ?,
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
                Grupa = ?,
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
            product_data.get('CenaZakupuNetto'),
            product_data.get('StawkaVAT'),
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
            product_data.get('Grupa', ''),
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
                CenaZakupuNetto, StawkaVAT,
                CenaPromocyjna, Opis, Uwagi, Model, Rozmiar, Marka, ModelSP,
                Sezon, Plec, Kolor, Przeznaczenie, Rodzaj, Grupa,
                LastUpdated, LastStanChange, LastPriceChange,
                PreviousStan, PreviousPrice, IsNew, DateAdded
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            symbol,
            product_data['Nazwa'],
            new_stan,
            product_data['JM'],
            product_data['DetalicznaNetto'],
            new_price,
            product_data.get('CenaZakupuNetto'),
            product_data.get('StawkaVAT'),
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
            product_data.get('Grupa', ''),
            now,
            now,
            now,
            0,
            0,
            1,  # IsNew = 1 dla nowych produktów
            now  # DateAdded - data dodania do bazy
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
        server_ip = server.split('\\')[0]
        connection = pymssql.connect(
            server=server_ip,
            port=1433,
            user=username,
            password=password,
            database=database,
            login_timeout=30
        )
    except pymssql.Error as conn_err:
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
           tc_CenaMag AS CenaZakupuNetto,
           tw_StawkaVat AS StawkaVAT,
           tw_Uwagi AS Uwagi,
           tw_pole3 AS ModelSP,
           tw_pole4 AS Sezon,
           tw_pole5 AS Plec,
           tw_pole6 AS Kolor,
           tw_pole7 AS Przeznaczenie,
           tw_pole8 AS Rodzaj,
           COALESCE(sl_Nazwa, '') AS Grupa
    FROM tw_Stan
    LEFT JOIN tw__Towar ON st_TowId = tw_Id
    LEFT JOIN tw_Cena ON st_TowId = tc_IdTowar
    LEFT JOIN sl__Slownik ON tw_IdGrupa = sl_Id
    WHERE st_Stan > 0 AND st_MagId IN (1, 3, 7, 9)
    GROUP BY Tw_Symbol, Tw_Nazwa, st_MagId, tw_Pole2, tw_Opis, tw_pole1, tw_pole3,
             tw_pole6, tw_pole5, tw_pole4, tw_pole7, tw_pole8, sl_Nazwa, tc_CenaNetto1, tc_CenaBrutto1,
             tc_CenaMag, tw_StawkaVat, tw_Uwagi
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    print(f"[SQL Server] Pobrano {len(rows)} produktow")

    conn_sqlite = sqlite3.connect(DATABASE_FILE)
    cursor_sqlite = conn_sqlite.cursor()

    # Kolumny: Symbol(0), Nazwa(1), Stan(2), MagID(3), Marka(4), JM(5), Model(6), Opis(7),
    # Rozmiar(8), DetalicznaNetto(9), DetalicznaBrutto(10), CenaZakupuNetto(11), StawkaVAT(12),
    # Uwagi(13), ModelSP(14), Sezon(15), Plec(16), Kolor(17), Przeznaczenie(18), Rodzaj(19), Grupa(20)
    changes_count = 0
    for row in rows:
        netto = float(row[9]) if isinstance(row[9], Decimal) else row[9]
        brutto = float(row[10]) if isinstance(row[10], Decimal) else row[10]
        cena_zakupu = float(row[11]) if isinstance(row[11], (int, float, Decimal)) and row[11] is not None else None
        stawka_vat = float(row[12]) if isinstance(row[12], (int, float, Decimal)) and row[12] is not None else None

        product_data = {
            'Nazwa': row[1],
            'Stan': float(row[2]),
            'JM': row[5],
            'DetalicznaNetto': netto,
            'DetalicznaBrutto': brutto,
            'CenaZakupuNetto': cena_zakupu,
            'StawkaVAT': stawka_vat,
            'CenaPromocyjna': None,
            'Opis': row[7],
            'Uwagi': row[13],
            'Model': row[6],
            'Rozmiar': row[8],
            'Marka': row[4],
            'ModelSP': row[14],
            'Sezon': row[15],
            'Plec': row[16],
            'Kolor': row[17],
            'Przeznaczenie': row[18],
            'Rodzaj': row[19],
            'Grupa': row[20],
        }

        upsert_product(cursor_sqlite, row[0], product_data, 'SQL')
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

# --- Funkcja do synchronizacji historii sprzedaży ---
def sync_sales_history():
    """Pobiera historię sprzedaży z SQL Server i zapisuje do SQLite"""
    server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
    database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
    username = os.getenv('SQL_USERNAME', 'zestawienia2')
    password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

    print("\n[Historia Sprzedaży] Łączenie z bazą danych SQL Server...")

    try:
        server_ip = server.split('\\')[0]
        connection = pymssql.connect(
            server=server_ip,
            port=1433,
            user=username,
            password=password,
            database=database,
            login_timeout=30
        )
    except pymssql.Error as conn_err:
        print(f"[Historia Sprzedaży] Błąd połączenia: {str(conn_err)}")
        return

    cursor_sql = connection.cursor()

    # Sprawdź czy mamy już jakieś dane w bazie
    conn_sqlite = sqlite3.connect(DATABASE_FILE)
    cursor_sqlite_check = conn_sqlite.cursor()
    cursor_sqlite_check.execute("SELECT MAX(DataSprzedazy) FROM sales_history")
    last_sync_date = cursor_sqlite_check.fetchone()[0]
    cursor_sqlite_check.close()
    conn_sqlite.close()

    # Jeśli to pierwsza synchronizacja, pobierz całą historię
    # Jeśli nie, pobierz tylko od ostatniej daty synchronizacji
    if last_sync_date:
        print(f"[Historia Sprzedaży] Ostatnia synchronizacja: {last_sync_date}")
        print(f"[Historia Sprzedaży] Pobieranie aktualizacji od {last_sync_date}...")
        date_filter = f"AND dok_DataWyst >= CAST('{last_sync_date}' AS DATE)"
    else:
        print("[Historia Sprzedaży] Pierwsza synchronizacja - pobieranie całej historii...")
        date_filter = ""

    # Pobierz historię sprzedaży dla magazynów 1, 7, 9
    query = f"""
    SELECT
        CAST(dok_DataWyst AS DATE) AS DataSprzedazy,
        dok_MagId AS MagId,
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
        dok_MagId IN (1, 7, 9)
        AND dok_Podtyp <> 1
        AND dok_Status <> 2
        {date_filter}
    GROUP BY
        CAST(dok_DataWyst AS DATE),
        dok_MagId
    ORDER BY
        DataSprzedazy DESC,
        MagId
    """

    try:
        cursor_sql.execute(query)
        rows = cursor_sql.fetchall()

        # Połącz z SQLite
        conn_sqlite = sqlite3.connect(DATABASE_FILE)
        cursor_sqlite = conn_sqlite.cursor()

        now = datetime.now().isoformat()
        records_count = 0

        # Kolumny: DataSprzedazy(0), MagId(1), IloscSprzedana(2), WartoscNetto(3), WartoscBrutto(4), LiczbaTransakcji(5), LiczbaProduktow(6)
        for row in rows:
            # Upsert do tabeli sales_history
            cursor_sqlite.execute('''
                INSERT OR REPLACE INTO sales_history
                (DataSprzedazy, MagId, IloscSprzedana, WartoscNetto, WartoscBrutto,
                 LiczbaTransakcji, LiczbaProduktow, LastUpdated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                row[0].strftime('%Y-%m-%d') if row[0] else None,
                row[1],
                float(row[2] or 0),
                float(row[3] or 0),
                float(row[4] or 0),
                int(row[5] or 0),
                int(row[6] or 0),
                now
            ))
            records_count += 1

        conn_sqlite.commit()
        conn_sqlite.close()

        cursor_sql.close()
        connection.close()

        print(f"[Historia Sprzedaży] Zsynchronizowano {records_count} rekordów")

    except Exception as e:
        print(f"[Historia Sprzedaży] Błąd podczas synchronizacji: {str(e)}")
        cursor_sql.close()
        connection.close()

# --- Funkcja do pobierania szczegółowej historii dostaw i rotacji ---
def get_detailed_product_rotation():
    """
    Pobiera szczegółową historię dostaw (PZ) i sprzedaży dla każdego produktu.
    Analizuje rotację MIĘDZY dostawami i wykrywa produkty które nie sprzedają się
    pomimo że poprzednie partie zeszły.

    Zwraca słownik z następującymi informacjami dla każdego produktu:
    - deliveries: lista dostaw
    - rotation_analysis: analiza rotacji między dostawami
    - has_zero_stock_history: czy był moment zerowego stanu
    - last_zero_date: data ostatniego zerowego stanu
    - sales_after_last_delivery: sprzedaż po ostatniej dostawie
    """
    try:
        print("\n[Rotacja Dostaw] Łączenie z bazą danych SQL Server...")
        server = os.getenv("SQL_SERVER", "10.101.101.5\\INSERTGT")
        server_ip = server.split('\\')[0]
        connection = pymssql.connect(
            server=server_ip,
            port=1433,
            user=os.getenv("SQL_USERNAME"),
            password=os.getenv("SQL_PASSWORD"),
            database=os.getenv("SQL_DATABASE"),
            login_timeout=30
        )
        cursor_sql = connection.cursor()

        # Pobierz pierwszą datę sprzedaży dla każdego produktu (jako proxy dla daty wprowadzenia)
        deliveries_query = """
        SELECT
            tw.tw_Symbol AS Symbol,
            MIN(d.dok_DataWyst) AS DataDostawy,
            1 AS Ilosc,
            0 AS DokumentId
        FROM
            dok__Dokument d
        INNER JOIN
            dok_Pozycja dp ON d.dok_Id = dp.ob_DokMagId
        INNER JOIN
            tw__Towar tw ON dp.ob_TowId = tw.tw_Id
        WHERE
            d.dok_Typ IN (10, 11)  -- Paragon i Faktura sprzedaży
            AND d.dok_MagId IN (1, 7, 9)
            AND d.dok_Status <> 2
        GROUP BY
            tw.tw_Symbol
        """

        cursor_sql.execute(deliveries_query)
        deliveries = cursor_sql.fetchall()

        print(f"[Rotacja Dostaw] Pobrano {len(deliveries)} produktów z historią sprzedaży")

        # Grupuj dostawy po produktach
        # Kolumny: Symbol(0), DataDostawy(1), Ilosc(2), DokumentId(3)
        product_deliveries = {}
        for row in deliveries:
            symbol = row[0]
            if symbol not in product_deliveries:
                product_deliveries[symbol] = {
                    'deliveries': [],
                    'has_zero_stock_history': False,
                    'last_zero_date': None,
                    'rotation_analysis': None
                }

            product_deliveries[symbol]['deliveries'].append({
                'date': row[1],
                'quantity': float(row[2] or 0),
                'doc_id': row[3]
            })

        # Pobierz WSZYSTKIE sprzedaże jednym zapytaniem (optymalizacja!)
        print(f"[Rotacja Dostaw] Pobieram historię sprzedaży...")
        all_sales_query = """
        SELECT
            tw.tw_Symbol AS Symbol,
            CAST(d.dok_DataWyst AS DATE) AS DataSprzedazy,
            SUM(CASE
                WHEN d.dok_Typ IN (14, 6) THEN -dp.ob_IloscMag
                ELSE dp.ob_IloscMag
            END) AS IloscSprzedana
        FROM
            dok__Dokument d
        INNER JOIN
            dok_Pozycja dp ON d.dok_Id = dp.ob_DokMagId
        INNER JOIN
            tw__Towar tw ON dp.ob_TowId = tw.tw_Id
        WHERE
            d.dok_DataWyst >= DATEADD(day, -365, GETDATE())
            AND d.dok_MagId IN (1, 7, 9)
            AND d.dok_Status <> 2
            AND d.dok_Podtyp <> 1
        GROUP BY
            tw.tw_Symbol, CAST(d.dok_DataWyst AS DATE)
        ORDER BY
            tw.tw_Symbol, DataSprzedazy
        """

        cursor_sql.execute(all_sales_query)
        all_sales_data = cursor_sql.fetchall()

        # Grupuj sprzedaże po produktach
        # Kolumny: Symbol(0), DataSprzedazy(1), IloscSprzedana(2)
        sales_by_product = {}
        for row in all_sales_data:
            symbol = row[0]
            if symbol not in sales_by_product:
                sales_by_product[symbol] = []
            sales_by_product[symbol].append({
                'date': row[1],
                'quantity': float(row[2] or 0)
            })

        # Dla każdego produktu analizuj rotację
        print(f"[Rotacja Dostaw] Analizuję rotację dla {len(product_deliveries)} produktów...")

        for symbol, data in product_deliveries.items():
            deliveries_sorted = sorted(data['deliveries'], key=lambda x: x['date'])
            sales_data = sales_by_product.get(symbol, [])

            # Symuluj stan magazynowy na podstawie dostaw i sprzedaży
            # aby wykryć momenty zerowego stanu
            stock_simulation = []
            current_stock = 0
            had_zero = False
            last_zero_date = None

            # Połącz dostawy i sprzedaż w jedną chronologiczną listę
            events = []
            for delivery in deliveries_sorted:
                events.append({
                    'date': delivery['date'].date() if hasattr(delivery['date'], 'date') else delivery['date'],
                    'type': 'delivery',
                    'quantity': delivery['quantity']
                })

            for sale in sales_data:
                events.append({
                    'date': sale['date'],
                    'type': 'sale',
                    'quantity': sale['quantity']
                })

            # Sortuj wszystkie wydarzenia chronologicznie
            events.sort(key=lambda x: x['date'])

            # Symuluj stan magazynowy
            for event in events:
                if event['type'] == 'delivery':
                    current_stock += event['quantity']
                else:  # sale
                    current_stock -= event['quantity']

                if current_stock <= 0:
                    had_zero = True
                    last_zero_date = event['date']
                    current_stock = max(0, current_stock)  # Nie może być ujemny

                stock_simulation.append({
                    'date': event['date'],
                    'type': event['type'],
                    'quantity': event['quantity'],
                    'stock_after': current_stock
                })

            data['has_zero_stock_history'] = had_zero
            data['last_zero_date'] = last_zero_date
            data['rotation_analysis'] = {
                'total_deliveries': len(deliveries_sorted),
                'total_delivered_qty': sum(d['quantity'] for d in deliveries_sorted),
                'had_zero_stock': had_zero,
                'stock_events': stock_simulation
            }

            # Oblicz sprzedaż po ostatniej dostawie
            if deliveries_sorted:
                last_delivery_date = deliveries_sorted[-1]['date']
                comparison_date = last_delivery_date.date() if hasattr(last_delivery_date, 'date') else last_delivery_date
                sales_after_last = sum(
                    event['quantity']
                    for event in stock_simulation
                    if event['type'] == 'sale' and event['date'] > comparison_date
                )
                data['sales_after_last_delivery'] = sales_after_last
            else:
                data['sales_after_last_delivery'] = 0

        cursor_sql.close()
        connection.close()

        print(f"[Rotacja Dostaw] Zakończono analizę rotacji")
        return product_deliveries

    except Exception as e:
        print(f"[Rotacja Dostaw] Błąd: {str(e)}")
        import traceback
        traceback.print_exc()
        return {}


# --- Funkcja do synchronizacji dat dodania produktów z dokumentów sprzedaży ---
def sync_product_dates_from_pz():
    """
    Pobiera pierwsze daty sprzedaży dla każdego produktu
    i aktualizuje pole DateAdded w bazie SQLite
    """
    try:
        print("\n[Daty produktów] Łączenie z bazą danych SQL Server...")
        server = os.getenv("SQL_SERVER", "10.101.101.5\\INSERTGT")
        server_ip = server.split('\\')[0]
        connection = pymssql.connect(
            server=server_ip,
            port=1433,
            user=os.getenv("SQL_USERNAME"),
            password=os.getenv("SQL_PASSWORD"),
            database=os.getenv("SQL_DATABASE"),
            login_timeout=30
        )
        cursor_sql = connection.cursor()

        # Pobierz MIN(DataWystawienia) dla każdego produktu z dokumentów sprzedaży
        query = """
        SELECT
            tw.tw_Symbol AS Symbol,
            MIN(d.dok_DataWyst) AS PierwszaDataDokumentu
        FROM
            dok__Dokument d
        INNER JOIN
            dok_Pozycja dp ON d.dok_Id = dp.ob_DokMagId
        INNER JOIN
            tw__Towar tw ON dp.ob_TowId = tw.tw_Id
        WHERE
            d.dok_Typ IN (10, 11)  -- Paragon i Faktura sprzedaży
            AND d.dok_MagId IN (1, 7, 9)
        GROUP BY
            tw.tw_Symbol
        """

        cursor_sql.execute(query)
        rows = cursor_sql.fetchall()

        print(f"[Daty produktów] Pobrano {len(rows)} dat pierwszej sprzedaży")

        # Połącz z bazą SQLite
        conn_sqlite = sqlite3.connect(DATABASE_FILE)
        cursor_sqlite = conn_sqlite.cursor()

        # Kolumny: Symbol(0), PierwszaDataDokumentu(1)
        updated_count = 0
        for row in rows:
            symbol = row[0]
            first_pz_date = row[1]

            if first_pz_date:
                # Aktualizuj DateAdded tylko jeśli jest NULL lub nowsze niż data PZ
                cursor_sqlite.execute('''
                    UPDATE products
                    SET DateAdded = ?
                    WHERE Symbol = ?
                    AND (DateAdded IS NULL OR DateAdded > ?)
                ''', (
                    first_pz_date.strftime('%Y-%m-%d %H:%M:%S'),
                    symbol,
                    first_pz_date.strftime('%Y-%m-%d %H:%M:%S')
                ))

                if cursor_sqlite.rowcount > 0:
                    updated_count += 1

        conn_sqlite.commit()
        conn_sqlite.close()

        cursor_sql.close()
        connection.close()

        print(f"[Daty produktów] Zaktualizowano {updated_count} produktów")

    except Exception as e:
        print(f"[Daty produktów] Błąd podczas synchronizacji: {str(e)}")
        import traceback
        traceback.print_exc()

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

def compute_dead_stock_analysis():
    """
    Przelicza analizę dead stock i zapisuje wyniki do tabeli dead_stock_analysis.
    Ta funkcja jest wywoływana cyklicznie aby pre-compute wyniki i przyspieszyć API.

    ULEPSZONA WERSJA: Analizuje rotację na podstawie WSZYSTKICH dostaw (PZ),
    nie tylko pierwszej daty dostawy.
    """
    print("\n[Dead Stock Analysis] Rozpoczynam przeliczanie analizy...")

    # Pobierz szczegółową historię dostaw dla wszystkich produktów
    product_deliveries = get_detailed_product_rotation()

    # Połączenie z SQLite
    conn_sqlite = sqlite3.connect(DATABASE_FILE)
    cursor_sqlite = conn_sqlite.cursor()

    # Pobierz wszystkie produkty z bazy SQLite
    cursor_sqlite.execute("SELECT * FROM products")
    products = cursor_sqlite.fetchall()
    columns = [description[0] for description in cursor_sqlite.description]

    # Połączenie z SQL Server dla historii sprzedaży
    server = os.getenv('SQL_SERVER', r'10.101.101.5\INSERTGT')
    database = os.getenv('SQL_DATABASE', 'Sporting_Leszno')
    username = os.getenv('SQL_USERNAME', 'zestawienia2')
    password = os.getenv('SQL_PASSWORD', 'GIO38#@oler!!')

    try:
        server_ip = server.split('\\')[0]
        sql_connection = pymssql.connect(
            server=server_ip,
            port=1433,
            user=username,
            password=password,
            database=database,
            login_timeout=30
        )
    except pymssql.Error as conn_err:
        print(f"[Dead Stock Analysis] Błąd połączenia z SQL Server: {conn_err}")
        conn_sqlite.close()
        return

    sql_cursor = sql_connection.cursor()

    # Zapytanie SQL do pobierania sprzedaży z ostatnich 365 dni
    mag_id_filter = "1,2,3,7,9"
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
        CAST(dok_DataWyst AS DATE) >= DATEADD(day, -365, CAST(GETDATE() AS DATE))
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
        print(f"[Dead Stock Analysis] Błąd zapytania SQL: {e}")
        sql_cursor.close()
        sql_connection.close()
        conn_sqlite.close()
        return

    # Konwertuj dane sprzedaży na słownik
    # Kolumny: Symbol(0), IloscSprzedana(1), WartoscSprzedazy(2), OstatniaSprzedaz(3)
    sales_data = {}
    for row in sales_rows:
        symbol = row[0]
        if symbol:
            sales_data[symbol] = {
                "IloscSprzedana": float(row[1] or 0),
                "WartoscSprzedazy": float(row[2] or 0),
                "OstatniaSprzedaz": row[3].strftime('%Y-%m-%d') if row[3] else None
            }

    sql_cursor.close()
    sql_connection.close()

    # Wyczyść starą analizę
    cursor_sqlite.execute("DELETE FROM dead_stock_analysis")

    # Przeanalizuj każdy produkt
    today = datetime.now()
    analysis_timestamp = today.strftime('%Y-%m-%d %H:%M:%S')
    analyzed_count = 0

    for product in products:
        product_dict = dict(zip(columns, product))
        symbol = product_dict.get('Symbol')

        # Bezpieczna konwersja stanu
        try:
            stan = float(product_dict.get('Stan') or 0)
        except (ValueError, TypeError):
            stan = 0

        # Pomiń produkty z zerowym stanem
        if stan <= 0:
            continue

        # Pobierz dane sprzedaży
        sales_info = sales_data.get(symbol, {
            "IloscSprzedana": 0,
            "WartoscSprzedazy": 0,
            "OstatniaSprzedaz": None
        })

        # Oblicz średnią dzienną sprzedaż
        yearly_sales_qty = sales_info["IloscSprzedana"]
        avg_daily_sales = yearly_sales_qty / 365.0 if yearly_sales_qty > 0 else 0

        # Oblicz Days of No Movement
        last_activity_date = None

        if sales_info["OstatniaSprzedaz"]:
            try:
                last_activity_date = datetime.strptime(sales_info["OstatniaSprzedaz"], '%Y-%m-%d')
            except (ValueError, TypeError):
                pass

        last_stan_change = product_dict.get('LastStanChange')
        if not last_activity_date and last_stan_change:
            try:
                last_activity_date = datetime.strptime(last_stan_change, '%Y-%m-%dT%H:%M:%S.%f')
            except ValueError:
                try:
                    last_activity_date = datetime.strptime(last_stan_change, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    try:
                        last_activity_date = datetime.strptime(last_stan_change, '%Y-%m-%d')
                    except ValueError:
                        pass

        if last_activity_date:
            days_no_movement = (today - last_activity_date).days
        else:
            days_no_movement = 365

        # Oblicz zamrożony kapitał
        try:
            price_netto = float(product_dict.get('DetalicznaNetto') or 0)
        except (ValueError, TypeError):
            price_netto = 0

        frozen_value = stan * price_netto

        # Oblicz dni zapasu
        if avg_daily_sales > 0:
            days_of_stock = stan / avg_daily_sales
        else:
            days_of_stock = 9999

        # ULEPSZONA ANALIZA WIEKU PRODUKTU
        # Zamiast tylko pierwszej dostawy, analizujemy WSZYSTKIE dostawy
        # i obliczamy średni wiek obecnego zapasu

        is_new_product = False
        product_age_days = 9999
        oldest_delivery_age = 9999
        avg_delivery_age = 9999

        # Pobierz dane rotacji dla tego produktu
        delivery_data = product_deliveries.get(symbol, {})

        # Wyciągnij dane rotacji
        had_zero_stock = 0
        last_zero_date = None
        days_since_last_zero = None
        total_deliveries = 0
        sales_after_last_delivery = 0
        date_added = product_dict.get('DateAdded')  # Inicjalizacja date_added

        if isinstance(delivery_data, dict):
            # Nowy format - słownik z analizą rotacji
            had_zero_stock = 1 if delivery_data.get('has_zero_stock_history', False) else 0
            last_zero_date = delivery_data.get('last_zero_date')
            sales_after_last_delivery = delivery_data.get('sales_after_last_delivery', 0)

            if last_zero_date:
                # Konwertuj datę do stringa jeśli to datetime
                if isinstance(last_zero_date, datetime):
                    last_zero_date_str = last_zero_date.strftime('%Y-%m-%d')
                    days_since_last_zero = (today - last_zero_date).days
                elif isinstance(last_zero_date, date):
                    last_zero_date_str = last_zero_date.strftime('%Y-%m-%d')
                    days_since_last_zero = (today - datetime.combine(last_zero_date, datetime.min.time())).days
                else:
                    last_zero_date_str = str(last_zero_date)
                    try:
                        last_zero_dt = datetime.strptime(last_zero_date_str, '%Y-%m-%d')
                        days_since_last_zero = (today - last_zero_dt).days
                    except (ValueError, TypeError):
                        days_since_last_zero = None
                last_zero_date = last_zero_date_str

            # Pobierz liczbę dostaw z rotation_analysis
            rotation = delivery_data.get('rotation_analysis', {})
            if rotation:
                total_deliveries = rotation.get('total_deliveries', 0)

            # Wyciągnij listę dostaw do obliczeń wieku
            deliveries = delivery_data.get('deliveries', [])
        else:
            # Stary format - bezpośrednio lista dostaw
            deliveries = delivery_data if delivery_data else []
            total_deliveries = len(deliveries)

        if deliveries:
            # Sortuj dostawy chronologicznie
            deliveries_sorted = sorted(deliveries, key=lambda x: x['date'])

            # Data najstarszej dostawy (dla produktów z jedną dostawą)
            oldest_delivery = deliveries_sorted[0]
            oldest_delivery_age = (today - oldest_delivery['date']).days

            # Data najnowszej dostawy
            newest_delivery = deliveries_sorted[-1]
            newest_delivery_age = (today - newest_delivery['date']).days

            # Jeśli jest tylko jedna dostawa, używamy jej wieku
            if len(deliveries_sorted) == 1:
                product_age_days = oldest_delivery_age
            else:
                # Jeśli jest więcej dostaw, oblicz średnią ważoną wiekiem
                # (nowe dostawy mogą "odmłodzić" produkt)
                total_qty = sum(d['quantity'] for d in deliveries_sorted)
                if total_qty > 0:
                    weighted_age = sum(
                        ((today - d['date']).days * d['quantity'])
                        for d in deliveries_sorted
                    ) / total_qty
                    avg_delivery_age = int(weighted_age)

                # Używamy średniego wieku jeśli dostępny, w przeciwnym razie najstarszą dostawę
                product_age_days = avg_delivery_age if avg_delivery_age < 9999 else oldest_delivery_age

        # Jeśli brak dostaw w bazie, użyj DateAdded z SQLite jako fallback
        if product_age_days >= 9999:
            date_added = product_dict.get('DateAdded')
            if date_added:
                try:
                    added_date = datetime.strptime(date_added, '%Y-%m-%dT%H:%M:%S.%f')
                    product_age_days = (today - added_date).days
                except (ValueError, TypeError):
                    try:
                        added_date = datetime.strptime(date_added, '%Y-%m-%d %H:%M:%S.%f')
                        product_age_days = (today - added_date).days
                    except (ValueError, TypeError):
                        try:
                            added_date = datetime.strptime(date_added, '%Y-%m-%d %H:%M:%S')
                            product_age_days = (today - added_date).days
                        except (ValueError, TypeError):
                            try:
                                added_date = datetime.strptime(date_added, '%Y-%m-%d')
                                product_age_days = (today - added_date).days
                            except (ValueError, TypeError):
                                pass

        if product_age_days < 30:
            is_new_product = True

        # ULEPSZONA KATEGORYZACJA z uwzględnieniem wieku produktu i historii rotacji

        # SPECJALNA KATEGORIA: Produkty kupowane ponownie bez sprzedaży
        # (miały zerowy stan, kupiliśmy ponownie, ale nie sprzedają się po nowej dostawie)
        if (had_zero_stock and
            total_deliveries >= 2 and
            sales_after_last_delivery == 0 and
            product_age_days > 30):  # Daj produkt 30 dni na wdrożenie

            days_since_zero = days_since_last_zero if days_since_last_zero else 0
            category_label = "REPEATED_NO_SALES"
            recommendation = f"BŁĄD POWTÓRNEGO ZAKUPU ({total_deliveries} dost., 0 sprzedaży po ostatniej, {days_since_zero}d od zera) - Nie zamawiaj ponownie!"

        # Produkty bardzo nowe (0-30 dni) - okres wdrożenia
        elif is_new_product:
            category_label = "NEW"
            recommendation = "NOWY - Monitoruj przez 30 dni"

        # Produkty 1-3 miesięczne (30-90 dni) - okres testowy
        elif product_age_days <= 90:
            # Informacja o liczbie dostaw dla kontekstu
            delivery_info = f" ({total_deliveries} dost.)" if total_deliveries > 1 else ""

            # Dla stosunkowo nowych produktów (30-90 dni) sprawdź czy w ogóle się sprzedają
            if yearly_sales_qty == 0:
                category_label = "NEW_NO_SALES"
                recommendation = f"NOWY BEZ SPRZEDAŻY ({product_age_days}d{delivery_info}) - Pilna akcja marketingowa!"
            elif days_of_stock <= 90:
                category_label = "NEW_SELLING"
                recommendation = f"NOWY, SPRZEDAJE SIĘ ({product_age_days}d{delivery_info}) - Dobrze, kontynuuj"
            else:
                category_label = "NEW_SLOW"
                recommendation = f"NOWY, WOLNA SPRZEDAŻ ({product_age_days}d{delivery_info}) - Rozważ promocję"

        # Produkty powyżej 3 miesięcy - normalna klasyfikacja według rotacji
        elif days_of_stock <= 30:
            category_label = "VERY_FAST"
            recommendation = "BARDZO SZYBKA ROTACJA - Zwiększ zamówienia"
        elif days_of_stock <= 90:
            category_label = "FAST"
            recommendation = "SZYBKA ROTACJA - Utrzymuj obecne poziomy"
        elif days_of_stock <= 180:
            category_label = "NORMAL"
            recommendation = "NORMALNA ROTACJA - OK"
        elif days_of_stock <= 365:
            category_label = "SLOW"
            recommendation = "WOLNA ROTACJA - Rozważ promocję"
        elif days_of_stock < 9999:
            category_label = "VERY_SLOW"
            recommendation = "BARDZO WOLNA ROTACJA - Obniż ceny"
        else:
            category_label = "DEAD"
            # Dla martwego zapasu pokaż wiek najstarszej dostawy
            age_info = f"({oldest_delivery_age}d najst. dost.)" if oldest_delivery_age < 9999 else f"({product_age_days}d)"
            delivery_info = f", {total_deliveries} dost." if total_deliveries > 1 else ""
            recommendation = f"MARTWY ZAPAS {age_info}{delivery_info} - Wymaga natychmiastowej akcji"

        # Zapisz do tabeli
        cursor_sqlite.execute("""
            INSERT INTO dead_stock_analysis (
                Symbol, Nazwa, Marka, Rodzaj, Stan, DetalicznaNetto, DetalicznaBrutto,
                LastStanChange, DaysNoMovement, FrozenValue, SprzedazRoczna,
                SredniaDziennaSprzedaz, DniZapasu, OstatniaSprzedaz, Category,
                Recommendation, Rozmiar, Kolor, Sezon, ProductAge, LastAnalysisUpdate, DateAdded,
                HadZeroStock, LastZeroDate, DaysSinceLastZero, TotalDeliveries, SalesAfterLastDelivery
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            symbol,
            product_dict.get('Nazwa'),
            product_dict.get('Marka'),
            product_dict.get('Rodzaj'),
            stan,
            price_netto,
            float(product_dict.get('DetalicznaBrutto') or 0),
            last_stan_change,
            days_no_movement,
            frozen_value,
            yearly_sales_qty,
            avg_daily_sales,
            days_of_stock if days_of_stock < 9999 else None,
            sales_info["OstatniaSprzedaz"],
            category_label,
            recommendation,
            product_dict.get('Rozmiar'),
            product_dict.get('Kolor'),
            product_dict.get('Sezon'),
            product_age_days if product_age_days < 9999 else None,
            analysis_timestamp,
            date_added,  # Data pierwszej dostawy (PZ)
            had_zero_stock,
            last_zero_date,
            days_since_last_zero,
            total_deliveries,
            sales_after_last_delivery
        ))
        analyzed_count += 1

    conn_sqlite.commit()
    conn_sqlite.close()

    print(f"[Dead Stock Analysis] Przeanalizowano {analyzed_count} produktów")
    print(f"[Dead Stock Analysis] Zakończono o {analysis_timestamp}")

# Główna funkcja wykonawcza
def execute_script():
    print(f"\n{'='*60}")
    print(f"Rozpoczynam aktualizacje danych: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    init_db()
    upload_sql_data_to_sqlite()
    csv_url = 'https://176.32.163.90/ealpinepro2/dane/sporting/stan.csv'
    add_csv_data_to_sqlite(csv_url)
    sync_sales_history()
    sync_product_dates_from_pz()  # Synchronizuj daty dodania z dokumentów PZ
    compute_dead_stock_analysis()  # Przelicz analizę dead stock

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
