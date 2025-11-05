"""
Sprawdza szczegóły dla konkretnej daty
"""
import sqlite3
from pathlib import Path

DATABASE_FILE = Path(__file__).parent / "product_states.db"

def check_date(date):
    """Sprawdza wartości dla konkretnej daty"""
    conn = sqlite3.connect(str(DATABASE_FILE))
    cursor = conn.cursor()

    cursor.execute("""
        SELECT date, gls, four_f, jeans, total, created_at, updated_at
        FROM sales_plans
        WHERE date = ?
    """, (date,))

    row = cursor.fetchone()

    if row:
        print(f"\nSzczegoly dla daty: {date}")
        print(f"  GLS: {row[1]}")
        print(f"  4F: {row[2]}")
        print(f"  JEANS: {row[3]}")
        print(f"  TOTAL: {row[4]}")
        print(f"  Created: {row[5]}")
        print(f"  Updated: {row[6]}")
    else:
        print(f"Brak danych dla: {date}")

    conn.close()

if __name__ == "__main__":
    check_date("03.11.2025")
