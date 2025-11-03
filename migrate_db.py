import sqlite3
from datetime import datetime

DATABASE_FILE = 'product_states.db'

def migrate_database():
    """Dodaje nowe kolumny do śledzenia zmian w bazie danych"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()

    # Sprawdź czy kolumny już istnieją
    cursor.execute("PRAGMA table_info(products)")
    columns = [col[1] for col in cursor.fetchall()]

    migrations = []

    if 'LastUpdated' not in columns:
        migrations.append("ALTER TABLE products ADD COLUMN LastUpdated TEXT")
        print("Dodaję kolumnę LastUpdated")

    if 'LastStanChange' not in columns:
        migrations.append("ALTER TABLE products ADD COLUMN LastStanChange TEXT")
        print("Dodaję kolumnę LastStanChange")

    if 'LastPriceChange' not in columns:
        migrations.append("ALTER TABLE products ADD COLUMN LastPriceChange TEXT")
        print("Dodaję kolumnę LastPriceChange")

    if 'PreviousStan' not in columns:
        migrations.append("ALTER TABLE products ADD COLUMN PreviousStan REAL DEFAULT 0")
        print("Dodaję kolumnę PreviousStan")

    if 'PreviousPrice' not in columns:
        migrations.append("ALTER TABLE products ADD COLUMN PreviousPrice REAL DEFAULT 0")
        print("Dodaję kolumnę PreviousPrice")

    if 'IsNew' not in columns:
        migrations.append("ALTER TABLE products ADD COLUMN IsNew INTEGER DEFAULT 0")
        print("Dodaję kolumnę IsNew")

    # Wykonaj migracje
    for migration in migrations:
        try:
            cursor.execute(migration)
            print(f"OK: {migration}")
        except sqlite3.OperationalError as e:
            print(f"BLAD: {e}")

    # Ustaw domyślne wartości dla istniejących rekordów
    if migrations:
        now = datetime.now().isoformat()
        cursor.execute("""
            UPDATE products
            SET LastUpdated = ?,
                PreviousStan = Stan,
                PreviousPrice = DetalicznaBrutto
            WHERE LastUpdated IS NULL
        """, (now,))

    conn.commit()
    conn.close()

    print("\nMigracja bazy danych zakonczona pomyslnie!")
    print(f"Dodano {len(migrations)} nowych kolumn")

if __name__ == '__main__':
    migrate_database()
