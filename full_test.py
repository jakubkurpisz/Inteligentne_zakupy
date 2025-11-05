"""
Pełny test cyklu: modyfikacja -> synchronizacja -> weryfikacja
"""
import sys
from pathlib import Path
import sqlite3

sys.path.insert(0, str(Path(__file__).parent / "backend"))

from main import sync_sales_plans_from_google

DATABASE_FILE = Path(__file__).parent / "product_states.db"

def full_test():
    print("=" * 70)
    print("PELNY TEST SYNCHRONIZACJI")
    print("=" * 70)

    # Krok 1: Zmień wartości
    print("\n[KROK 1] Zmiana wartosci testowych w bazie...")
    conn = sqlite3.connect(str(DATABASE_FILE))
    cursor = conn.cursor()

    test_date = "03.11.2025"

    cursor.execute("""
        SELECT gls, four_f, jeans
        FROM sales_plans
        WHERE date = ?
    """, (test_date,))

    original = cursor.fetchone()
    print(f"Oryginalne wartosci: GLS={original[0]}, 4F={original[1]}, JEANS={original[2]}")

    # Zmień wartości
    new_gls = original[0] + 1000
    new_4f = original[1] + 500
    new_jeans = original[2] + 300
    new_total = new_gls + new_4f + new_jeans

    cursor.execute("""
        UPDATE sales_plans
        SET gls = ?, four_f = ?, jeans = ?, total = ?
        WHERE date = ?
    """, (new_gls, new_4f, new_jeans, new_total, test_date))

    conn.commit()
    conn.close()

    print(f"Zmienione na: GLS={new_gls}, 4F={new_4f}, JEANS={new_jeans}")

    # Krok 2: Synchronizuj
    print("\n[KROK 2] Synchronizacja z Google Sheets...")
    success = sync_sales_plans_from_google()

    if not success:
        print("Synchronizacja nie powiodla sie!")
        return False

    # Krok 3: Sprawdź wynik
    print("\n[KROK 3] Weryfikacja po synchronizacji...")
    conn = sqlite3.connect(str(DATABASE_FILE))
    cursor = conn.cursor()

    cursor.execute("""
        SELECT gls, four_f, jeans, total, updated_at
        FROM sales_plans
        WHERE date = ?
    """, (test_date,))

    after_sync = cursor.fetchone()
    conn.close()

    print(f"Po synchronizacji: GLS={after_sync[0]}, 4F={after_sync[1]}, JEANS={after_sync[2]}")
    print(f"Updated at: {after_sync[4]}")

    # Krok 4: Podsumowanie
    print("\n" + "=" * 70)
    print("WYNIK TESTU")
    print("=" * 70)

    # Sprawdź czy wartości zostały zmienione z naszych testowych
    if (after_sync[0] != new_gls or
        after_sync[1] != new_4f or
        after_sync[2] != new_jeans):
        print("SUKCES! System wykryl roznice i zaktualizowal dane z Google Sheets")
        print(f"  Zmienione wartosci: GLS={new_gls}, 4F={new_4f}, JEANS={new_jeans}")
        print(f"  Po synchronizacji: GLS={after_sync[0]}, 4F={after_sync[1]}, JEANS={after_sync[2]}")
        return True
    else:
        print("BLAD! Wartosci nie zostaly zaktualizowane")
        return False

if __name__ == "__main__":
    full_test()
