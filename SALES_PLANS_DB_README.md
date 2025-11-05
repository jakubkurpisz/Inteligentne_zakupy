# System Zarządzania Planami Sprzedażowymi

## Przegląd

System przechowuje plany sprzedażowe w bazie danych SQLite z inteligentną synchronizacją z Google Sheets. Dane są automatycznie aktualizowane tylko gdy wystąpią różnice między bazą a arkuszem.

## Struktura Bazy Danych

### Tabela: `sales_plans`

```sql
CREATE TABLE sales_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,              -- Data w formacie DD.MM.YYYY
    gls REAL NOT NULL DEFAULT 0,            -- Plan sprzedaży GLS
    four_f REAL NOT NULL DEFAULT 0,         -- Plan sprzedaży 4F
    jeans REAL NOT NULL DEFAULT 0,          -- Plan sprzedaży JEANS
    total REAL NOT NULL DEFAULT 0,          -- Suma wszystkich planów
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

## Logika Synchronizacji

System automatycznie:

1. **Pobiera dane z Google Sheets**
2. **Dla każdej daty:**
   - Jeśli **nie istnieje** w bazie → **DODAJE** nowy rekord
   - Jeśli **istnieje** w bazie:
     - Sprawdza czy wartości się różnią (z tolerancją 0.01)
     - Jeśli **różne** → **AKTUALIZUJE** wartości
     - Jeśli **identyczne** → **POMIJA** (brak zmian)

## API Endpoints

### 1. Pobierz plany sprzedażowe
```
GET /api/sales-plans?sync=false&start_date=DD.MM.YYYY&end_date=DD.MM.YYYY
```

**Parametry:**
- `sync` (bool): Czy zsynchronizować przed zwróceniem danych (domyślnie: false)
- `start_date` (optional): Data początkowa filtrowania
- `end_date` (optional): Data końcowa filtrowania

**Odpowiedź:**
```json
{
  "success": true,
  "count": 31,
  "summary": {
    "total_gls": 550200.0,
    "total_4f": 467280.96,
    "total_jeans": 241900.0,
    "total_all": 1259380.96,
    "avg_daily_gls": 17748.39,
    "avg_daily_4f": 15073.58,
    "avg_daily_jeans": 7803.23,
    "avg_daily_all": 40625.19
  },
  "plans": [
    {
      "date": "01.11.2025",
      "gls": 15600.0,
      "four_f": 11158.56,
      "jeans": 6600.0,
      "total": 33358.56
    },
    ...
  ]
}
```

### 2. Pobierz plan na dzisiaj
```
GET /api/sales-plans/today?sync=false
```

**Parametry:**
- `sync` (bool): Czy zsynchronizować przed zwróceniem danych

**Odpowiedź:**
```json
{
  "success": true,
  "plan": {
    "date": "05.11.2025",
    "gls": 15600.0,
    "four_f": 10745.28,
    "jeans": 5500.0,
    "total": 31845.28
  }
}
```

### 3. Synchronizuj dane z Google Sheets
```
POST /api/sales-plans/sync
```

**Odpowiedź:**
```json
{
  "success": true,
  "message": "Dane zostały zsynchronizowane z Google Sheets",
  "count": 31
}
```

## Migracja

Aby utworzyć tabelę w bazie danych:

```bash
python create_sales_plans_table.py
```

## Testy

### Test 1: Podstawowa synchronizacja
```bash
python test_sync_sales_plans.py
```

**Oczekiwany wynik:**
- Wyświetla liczbę rekordów przed i po synchronizacji
- Pokazuje ile rekordów dodano/zaktualizowano/pominięto

### Test 2: Pełny cykl (modyfikacja + synchronizacja)
```bash
python full_test.py
```

**Oczekiwany wynik:**
- Modyfikuje testowe dane
- Synchronizuje z Google Sheets
- Weryfikuje czy wartości zostały poprawnie przywrócone

### Test 3: Sprawdzenie konkretnej daty
```bash
python check_specific_date.py
```

## Przykłady Użycia

### Python - Synchronizacja danych
```python
from main import sync_sales_plans_from_google

# Synchronizuj dane z Google Sheets
success = sync_sales_plans_from_google()

if success:
    print("Synchronizacja zakończona pomyślnie")
```

### Python - Pobieranie danych z bazy
```python
from main import get_sales_plans_from_db

# Pobierz wszystkie plany
plans = get_sales_plans_from_db()

# Pobierz plany z filtrowaniem
plans_filtered = get_sales_plans_from_db(
    start_date="01.11.2025",
    end_date="30.11.2025"
)
```

### cURL - Synchronizacja przez API
```bash
# Synchronizuj dane
curl -X POST http://localhost:5555/api/sales-plans/sync

# Pobierz plany (ze synchronizacją)
curl "http://localhost:5555/api/sales-plans?sync=true"

# Pobierz plan na dzisiaj
curl "http://localhost:5555/api/sales-plans/today"
```

## Zalety Nowego Rozwiązania

### ✓ Wydajność
- Baza danych SQLite zamiast CSV
- Szybkie zapytania z indeksami
- Możliwość filtrowania na poziomie bazy

### ✓ Inteligentna Synchronizacja
- Aktualizacja tylko zmienionych danych
- Automatyczne wykrywanie nowych dat
- Śledzenie historii zmian (created_at, updated_at)

### ✓ Elastyczność
- API obsługuje synchronizację on-demand
- Możliwość filtrowania po datach
- Łatwe rozszerzanie o nowe funkcje

### ✓ Niezawodność
- Transakcje bazodanowe
- Obsługa błędów
- Logi synchronizacji

## Troubleshooting

### Problem: Brak danych w bazie
```bash
# Wykonaj synchronizację ręcznie
python test_sync_sales_plans.py
```

### Problem: Dane nie są aktualizowane
```bash
# Sprawdź szczegóły dla konkretnej daty
python check_specific_date.py
```

### Problem: Błąd połączenia z Google Sheets
- Sprawdź URL w `main.py`: `GOOGLE_SHEETS_URL`
- Upewnij się, że arkusz jest publiczny
- Sprawdź połączenie internetowe

## Struktura Plików

```
Inteligentne zakupy/
├── backend/
│   └── main.py                          # Główne API z funkcjami synchronizacji
├── product_states.db                    # Baza danych SQLite
├── create_sales_plans_table.py          # Skrypt migracji tabeli
├── test_sync_sales_plans.py             # Test synchronizacji
├── test_update_plan.py                  # Test aktualizacji pojedynczego planu
├── full_test.py                         # Pełny test cyklu
├── check_specific_date.py               # Sprawdzenie konkretnej daty
└── SALES_PLANS_DB_README.md            # Ta dokumentacja
```

## Historia Zmian

### Wersja 1.0 (2025-11-05)
- ✓ Utworzenie tabeli `sales_plans` w bazie SQLite
- ✓ Implementacja inteligentnej synchronizacji
- ✓ Aktualizacja API endpoints
- ✓ Testy jednostkowe i integracyjne
- ✓ Dokumentacja

## Kontakt

W razie pytań lub problemów, sprawdź logi lub skontaktuj się z zespołem rozwoju.
