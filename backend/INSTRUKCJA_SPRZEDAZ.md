# Instrukcja konfiguracji historii sprzedaży

## Problem
Endpoint `/api/sales-history` próbuje pobrać dane sprzedaży z tabel dokumentów w Subiekcie GT (`tw__DokElem`, `tw__Dokument`), ale te tabele nie są dostępne w aktualnej konfiguracji bazy danych.

## Rozwiązanie tymczasowe
Aktualnie system pokazuje **stany magazynowe** zamiast prawdziwej historii sprzedaży.

## Aby włączyć prawdziwą historię sprzedaży:

### Opcja 1: Użyj danych z change_log (ZAIMPLEMENTOWANE)
Endpoint został zmieniony żeby używać tabeli `change_log` z naszej bazy SQLite jako proxy dla sprzedaży:
- Zmniejszenia stanów = sprzedaż
- Dane z ostatnich aktualizacji

### Opcja 2: Skonfiguruj dostęp do tabel dokumentów (ZALECANE)
1. Upewnij się że użytkownik bazy danych ma dostęp do tabel:
   - `tw__DokElem` - elementy dokumentów
   - `tw__Dokument` - nagłówki dokumentów

2. Poprawne typy dokumentów sprzedaży w Subiekcie GT:
   - 305 = Faktura VAT
   - 306 = Faktura VAT marża
   - 307 = Paragon

3. Przywróć oryginalne zapytanie SQL w `backend/main.py` (linijka ~352)

### Opcja 3: Import historii sprzedaży
Utwórz skrypt do importu danych historycznych sprzedaży do osobnej tabeli w SQLite.

## Aktualny status
✓ Backend działa na porcie 3002
✓ Frontend pokazuje "Stany Magazynowe" (10,488 produktów)
⚠ "Analiza Sprzedaży" używa symulowanych danych z change_log
