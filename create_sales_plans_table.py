"""
Skrypt migracji - tworzy tabele sales_plans w bazie danych SQLite
"""
import sqlite3
from pathlib import Path

DATABASE_FILE = Path(__file__).parent / "product_states.db"

def create_sales_plans_table():
    """Tworzy tabele sales_plans w bazie danych"""
    print(f"Laczenie z baza danych: {DATABASE_FILE}")

    conn = sqlite3.connect(str(DATABASE_FILE))
    cursor = conn.cursor()

    # Sprawdź czy tabela już istnieje
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='sales_plans'
    """)

    if cursor.fetchone():
        print("Tabela sales_plans juz istnieje!")

        # Pokaz strukture tabeli
        cursor.execute("PRAGMA table_info(sales_plans)")
        columns = cursor.fetchall()
        print("\nStruktura tabeli:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")

        conn.close()
        return

    # Utworz tabele sales_plans
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sales_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            gls REAL NOT NULL DEFAULT 0,
            four_f REAL NOT NULL DEFAULT 0,
            jeans REAL NOT NULL DEFAULT 0,
            total REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Utworz indeks na kolumnie date dla szybszego wyszukiwania
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sales_plans_date
        ON sales_plans(date)
    """)

    conn.commit()
    print("Tabela sales_plans zostala utworzona pomyslnie!")

    # Pokaz strukture tabeli
    cursor.execute("PRAGMA table_info(sales_plans)")
    columns = cursor.fetchall()
    print("\nStruktura tabeli:")
    for col in columns:
        print(f"  - {col[1]} ({col[2]})")

    conn.close()
    print(f"\nBaza danych: {DATABASE_FILE}")

if __name__ == "__main__":
    create_sales_plans_table()
