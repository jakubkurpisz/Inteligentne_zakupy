"""
Test aktualizacji pojedynczego planu sprzedażowego
"""
import sqlite3
from pathlib import Path

DATABASE_FILE = Path(__file__).parent / "product_states.db"

def test_update():
    """Testuje mechanizm aktualizacji wartości"""
    print("=" * 60)
    print("TEST AKTUALIZACJI PLANU SPRZEDAZOWEGO")
    print("=" * 60)

    conn = sqlite3.connect(str(DATABASE_FILE))
    cursor = conn.cursor()

    # Wybierz przykładową datę do testu
    test_date = "03.11.2025"

    # Pobierz aktualne wartości
    cursor.execute("""
        SELECT date, gls, four_f, jeans, total
        FROM sales_plans
        WHERE date = ?
    """, (test_date,))

    row = cursor.fetchone()

    if row:
        print(f"\nAktualne wartosci dla {test_date}:")
        print(f"  GLS: {row[1]}")
        print(f"  4F: {row[2]}")
        print(f"  JEANS: {row[3]}")
        print(f"  TOTAL: {row[4]}")

        # Zmień wartości testowo
        new_gls = row[1] + 1000
        new_4f = row[2] + 500
        new_jeans = row[3] + 300
        new_total = new_gls + new_4f + new_jeans

        print(f"\nZmiana wartosci na testowe:")
        print(f"  GLS: {new_gls}")
        print(f"  4F: {new_4f}")
        print(f"  JEANS: {new_jeans}")
        print(f"  TOTAL: {new_total}")

        cursor.execute("""
            UPDATE sales_plans
            SET gls = ?, four_f = ?, jeans = ?, total = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE date = ?
        """, (new_gls, new_4f, new_jeans, new_total, test_date))

        conn.commit()

        # Sprawdź zaktualizowane wartości
        cursor.execute("""
            SELECT date, gls, four_f, jeans, total, updated_at
            FROM sales_plans
            WHERE date = ?
        """, (test_date,))

        updated_row = cursor.fetchone()

        print(f"\nWartosci po aktualizacji:")
        print(f"  GLS: {updated_row[1]}")
        print(f"  4F: {updated_row[2]}")
        print(f"  JEANS: {updated_row[3]}")
        print(f"  TOTAL: {updated_row[4]}")
        print(f"  Updated at: {updated_row[5]}")

        print("\n" + "=" * 60)
        print("UWAGA: Uruchom test_sync_sales_plans.py aby przywrocic")
        print("       oryginalne wartosci z Google Sheets")
        print("=" * 60)

    else:
        print(f"\nNie znaleziono planu dla daty: {test_date}")

    conn.close()

if __name__ == "__main__":
    test_update()
