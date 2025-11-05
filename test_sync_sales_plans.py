"""
Skrypt testowy do synchronizacji planów sprzedażowych
"""
import sys
from pathlib import Path

# Dodaj ścieżkę do głównego katalogu
sys.path.insert(0, str(Path(__file__).parent / "backend"))

# Import funkcji z main.py
from main import sync_sales_plans_from_google, get_sales_plans_from_db

def test_sync():
    """Testuje synchronizację planów sprzedażowych"""
    print("=" * 60)
    print("TEST SYNCHRONIZACJI PLANÓW SPRZEDAŻOWYCH")
    print("=" * 60)

    # Sprawdz aktualny stan bazy przed synchronizacja
    print("\n1. Pobieranie aktualnych danych z bazy...")
    plans_before = get_sales_plans_from_db()
    print(f"   Liczba rekordow przed synchronizacja: {len(plans_before)}")

    if plans_before:
        print(f"   Ostatni rekord: {plans_before[-1]}")

    # Wykonaj synchronizacje
    print("\n2. Synchronizacja z Google Sheets...")
    success = sync_sales_plans_from_google()

    if success:
        print("   Synchronizacja zakonczona powodzeniem!")
    else:
        print("   Synchronizacja nie powiodla sie!")
        return False

    # Sprawdz stan po synchronizacji
    print("\n3. Pobieranie danych po synchronizacji...")
    plans_after = get_sales_plans_from_db()
    print(f"   Liczba rekordow po synchronizacji: {len(plans_after)}")

    if plans_after:
        print(f"   Pierwszy rekord: {plans_after[0]}")
        print(f"   Ostatni rekord: {plans_after[-1]}")

    # Podsumowanie
    print("\n" + "=" * 60)
    print("PODSUMOWANIE")
    print("=" * 60)
    print(f"Rekordow przed: {len(plans_before)}")
    print(f"Rekordow po: {len(plans_after)}")
    print(f"Roznica: {len(plans_after) - len(plans_before)}")

    # Pokaz przykladowe dane
    if plans_after:
        print("\nPrzykladowe dane (ostatnie 5 rekordow):")
        for plan in plans_after[-5:]:
            print(f"  {plan['date']}: GLS={plan['gls']}, 4F={plan['four_f']}, JEANS={plan['jeans']}, TOTAL={plan['total']}")

    return True

if __name__ == "__main__":
    test_sync()
