"""
Skrypt automatycznej synchronizacji planow sprzedazowych
Uruchamia sie cyklicznie i synchronizuje dane z Google Sheets
"""
import sys
import time
import schedule
from pathlib import Path
from datetime import datetime

# Dodaj sciezke do backendu
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from main import sync_sales_plans_from_google

def sync_job():
    """Zadanie synchronizacji - wykonywane cyklicznie"""
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print("\n" + "=" * 70)
    print(f"[{current_time}] Rozpoczynam automatyczna synchronizacje...")
    print("=" * 70)

    try:
        success = sync_sales_plans_from_google()

        if success:
            print(f"[{current_time}] Synchronizacja zakonczona pomyslnie!")
        else:
            print(f"[{current_time}] Synchronizacja nie powiodla sie!")

    except Exception as e:
        print(f"[{current_time}] BLAD: {e}")

    print("=" * 70)

def run_scheduler(interval_minutes=30):
    """
    Uruchamia scheduler do automatycznej synchronizacji

    Args:
        interval_minutes: Interwal w minutach (domyslnie 30)
    """
    print("=" * 70)
    print("AUTOMATYCZNA SYNCHRONIZACJA PLANOW SPRZEDAZOWYCH")
    print("=" * 70)
    print(f"Interwal synchronizacji: {interval_minutes} minut")
    print(f"Pierwsza synchronizacja: za 1 minute")
    print("Nacisnij Ctrl+C aby zakonczyc...")
    print("=" * 70)

    # Uruchom pierwsza synchronizacje po 1 minucie
    schedule.every(1).minutes.do(sync_job)

    # Nastepne synchronizacje co X minut
    schedule.every(interval_minutes).minutes.do(sync_job)

    try:
        while True:
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\nZatrzymywanie automatycznej synchronizacji...")
        print("Do widzenia!")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Automatyczna synchronizacja planow sprzedazowych z Google Sheets"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Interwal synchronizacji w minutach (domyslnie: 30)"
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Wykonaj synchronizacje tylko raz i zakoncz"
    )

    args = parser.parse_args()

    if args.once:
        # Jednorazowa synchronizacja
        print("Wykonywanie jednorazowej synchronizacji...")
        sync_job()
    else:
        # Cykliczna synchronizacja
        run_scheduler(interval_minutes=args.interval)
