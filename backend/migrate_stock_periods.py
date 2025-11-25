"""
Migracja bazy danych - dodanie nowych kolumn do custom_stock_periods
"""
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATABASE_FILE = BASE_DIR / "product_states.db"

def migrate_database():
    """Dodaje nowe kolumny do tabeli custom_stock_periods"""
    conn = sqlite3.connect(str(DATABASE_FILE))
    cursor = conn.cursor()

    try:
        # Sprawdz czy tabela istnieje
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='custom_stock_periods'
        """)

        if not cursor.fetchone():
            print("Tworze nowa tabele custom_stock_periods...")
            cursor.execute("""
                CREATE TABLE custom_stock_periods (
                    symbol TEXT PRIMARY KEY,
                    delivery_time_days INTEGER DEFAULT 7,
                    order_frequency_days INTEGER DEFAULT 14,
                    optimal_order_quantity INTEGER DEFAULT 0,
                    notes TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            print("[OK] Tabela utworzona")
        else:
            print("Tabela custom_stock_periods istnieje")

            # Sprawdz istniejace kolumny
            cursor.execute("PRAGMA table_info(custom_stock_periods)")
            existing_columns = {row[1] for row in cursor.fetchall()}
            print(f"Istniejace kolumny: {existing_columns}")

            # Dodaj nowe kolumny jesli nie istnieja
            new_columns = {
                'delivery_time_days': 'INTEGER DEFAULT 7',
                'order_frequency_days': 'INTEGER DEFAULT 14',
                'optimal_order_quantity': 'INTEGER DEFAULT 0'
            }

            for col_name, col_type in new_columns.items():
                if col_name not in existing_columns:
                    print(f"Dodaję kolumnę: {col_name}")
                    cursor.execute(f"""
                        ALTER TABLE custom_stock_periods
                        ADD COLUMN {col_name} {col_type}
                    """)
                    print(f"[OK] Kolumna {col_name} dodana")
                else:
                    print(f"[OK] Kolumna {col_name} juz istnieje")

            # Jesli istnieje stara kolumna custom_period_days, migruj dane
            if 'custom_period_days' in existing_columns:
                print("\nMigruje dane ze starej kolumny custom_period_days...")
                cursor.execute("""
                    UPDATE custom_stock_periods
                    SET order_frequency_days = custom_period_days
                    WHERE order_frequency_days IS NULL OR order_frequency_days = 0
                """)
                rows_migrated = cursor.rowcount
                print(f"[OK] Zmigrowano {rows_migrated} wierszy")

        conn.commit()
        print("\n[OK] Migracja zakonczona pomyslnie!")

        # Pokaz strukture tabeli
        cursor.execute("PRAGMA table_info(custom_stock_periods)")
        columns = cursor.fetchall()
        print("\nAktualna struktura tabeli custom_stock_periods:")
        for col in columns:
            print(f"  - {col[1]}: {col[2]}")

    except Exception as e:
        print(f"[ERROR] Blad migracji: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("=== Migracja bazy danych ===\n")
    migrate_database()
