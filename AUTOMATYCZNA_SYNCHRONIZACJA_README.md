# Automatyczna Synchronizacja Planów Sprzedażowych - Instrukcja

## Przegląd Systemu

System automatycznie synchronizuje plany sprzedażowe z Google Sheets do bazy danych SQLite. Dane są dostępne w aplikacji frontend przez dedykowane endpointy API.

---

## 🚀 Jak to Działa

### 1. **Automatyczna Synchronizacja w Tle**

Backend automatycznie synchronizuje dane gdy:
- ✅ Po 30 minutach od uruchomienia aplikacji (pierwsza synchronizacja)
- ✅ Co 30 minut (kolejne automatyczne aktualizacje)

**UWAGA:** Synchronizacja NIE uruchamia się przy starcie aplikacji - pierwsza synchronizacja nastąpi po 30 minutach.
Jeśli potrzebujesz danych od razu, użyj ręcznej synchronizacji przez frontend lub API.

#### Logi synchronizacji:

```
[STARTUP] Harmonogram synchronizacji planów zostanie uruchomiony za 30 minut...

[AUTO-SYNC] Rozpoczynam automatyczną synchronizację planów sprzedażowych...
Pobieranie danych z Google Sheets: https://docs.google.com/...
Dodano plan dla 01.11.2025: GLS=15600.0, 4F=11158.56, JEANS=6600.0
...
Synchronizacja zakończona:
  - Dodano: 31
  - Zaktualizowano: 0
  - Pominięto (bez zmian): 0
[AUTO-SYNC] Synchronizacja planów zakończona pomyślnie!
```

---

## 📋 Opcje Uruchomienia

### Opcja 1: Backend z Wbudowaną Synchronizacją (ZALECANE)

Uruchom serwer backend - automatyczna synchronizacja włączy się automatycznie:

```bash
cd "c:\Users\admin\Desktop\zakupy\Inteligentne zakupy\backend"
python main.py
```

**Cechy:**
- ✅ Synchronizacja przy starcie
- ✅ Automatyczna aktualizacja co 30 minut
- ✅ Działa w tle, nie wymaga dodatkowych działań

### Opcja 2: Standalone Skrypt (dla testów)

Uruchom niezależny skrypt synchronizacji:

#### Jednorazowa synchronizacja:
```bash
cd "c:\Users\admin\Desktop\zakupy\Inteligentne zakupy"
python auto_sync_sales_plans.py --once
```

#### Ciągła synchronizacja (co 30 minut):
```bash
python auto_sync_sales_plans.py --interval 30
```

#### Ciągła synchronizacja (co 15 minut):
```bash
python auto_sync_sales_plans.py --interval 15
```

---

## 🌐 Używanie API

### 1. Pobierz Wszystkie Plany

```bash
# Bez synchronizacji (tylko odczyt z bazy)
curl "http://localhost:5555/api/sales-plans"

# Ze synchronizacją przed zwróceniem
curl "http://localhost:5555/api/sales-plans?sync=true"

# Z filtrowaniem dat
curl "http://localhost:5555/api/sales-plans?start_date=01.11.2025&end_date=30.11.2025"
```

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
  "plans": [...]
}
```

### 2. Pobierz Plan na Dziś

```bash
# Bez synchronizacji
curl "http://localhost:5555/api/sales-plans/today"

# Ze synchronizacją
curl "http://localhost:5555/api/sales-plans/today?sync=true"
```

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

### 3. Wymuś Synchronizację

```bash
curl -X POST "http://localhost:5555/api/sales-plans/sync"
```

**Odpowiedź:**
```json
{
  "success": true,
  "message": "Dane zostały zsynchronizowane z Google Sheets",
  "count": 31
}
```

---

## 💻 Frontend - Gdzie Znajdziesz Dane

### 1. **Strona "Plany Sprzedażowe"** (`/sales-plans`)

![Plany Sprzedażowe](docs/sales-plans-page.png)

**Funkcje:**
- 📊 Wykresy trendów (liniowy i słupkowy)
- 📋 Szczegółowa tabela z danymi
- 🎯 Statystyki podsumowujące
- 🔄 Przycisk "Synchronizuj z Google Sheets"
- 📅 Filtrowanie po datach

**Przycisk Synchronizacji:**
- Kliknij przycisk **"Synchronizuj z Google Sheets"**
- System pobierze najnowsze dane z arkusza
- Tabela i wykresy zaktualizują się automatycznie

### 2. **Dashboard - Wykresy** (`/`)

![Dashboard](docs/dashboard.png)

**Widget "Plan sprzedażowy na dziś":**
- 🎯 Plan GLS, 4F, JEANS i RAZEM
- 📈 Procent realizacji (jeśli dostępne dane sprzedaży)
- 📅 Aktualna data
- Automatyczna aktualizacja przy odświeżaniu strony

**Lokalizacja:** Wyświetla się nad "Podsumowanie dnia"

---

## 🔧 Konfiguracja

### Google Sheets URL

Zmień URL arkusza w pliku [main.py](backend/main.py:38):

```python
GOOGLE_SHEETS_URL = "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=0"
```

### Interwał Synchronizacji

Zmień interwał w pliku [main.py](backend/main.py:87):

```python
def schedule_sales_plans_sync():
    """Synchronizuje plany sprzedażowe co X minut"""
    while True:
        time.sleep(30 * 60)  # Zmień 30 na dowolną wartość w minutach
        ...
```

### Format Arkusza Google Sheets

System oczekuje następującej struktury CSV:

| DATA       | GLS      | 4F        | JEANS    |
|------------|----------|-----------|----------|
| 01.11.2025 | 15600.0  | 11158.56  | 6600.0   |
| 02.11.2025 | 16800.0  | 11571.84  | 5500.0   |
| ...        | ...      | ...       | ...      |

**Wymagania:**
- Kolumna `DATA` w formacie `DD.MM.YYYY`
- Kolumny `GLS`, `4F`, `JEANS` z wartościami liczbowymi
- Przecinki lub kropki jako separator dziesiętny (system obsługuje oba)

---

## 🧪 Testowanie

### Test 1: Sprawdź czy dane są w bazie

```bash
cd "c:\Users\admin\Desktop\zakupy\Inteligentne zakupy"
python check_specific_date.py
```

### Test 2: Wykonaj pełny test synchronizacji

```bash
python test_sync_sales_plans.py
```

**Oczekiwany wynik:**
```
============================================================
TEST SYNCHRONIZACJI PLANÓW SPRZEDAŻOWYCH
============================================================

1. Pobieranie aktualnych danych z bazy...
   Liczba rekordow przed synchronizacja: 31

2. Synchronizacja z Google Sheets...
Synchronizacja zakonczona:
  - Dodano: 0
  - Zaktualizowano: 0
  - Pominięto (bez zmian): 31

3. Pobieranie danych po synchronizacji...
   Liczba rekordow po synchronizacji: 31
```

### Test 3: Test cyklu modyfikacja -> synchronizacja

```bash
python full_test.py
```

---

## 📊 Monitoring

### Logi Backend

Śledź logi w konsoli backend:

```
[STARTUP] Synchronizacja planów sprzedażowych przy starcie...
[AUTO-SYNC] Rozpoczynam automatyczną synchronizację planów sprzedażowych...
[AUTO-SYNC] Synchronizacja planów zakończona pomyślnie!
```

### Sprawdzenie Statusu

#### Przez API:
```bash
curl "http://localhost:5555/api/sales-plans/today"
```

#### Przez Frontend:
1. Otwórz **Dashboard** (`http://localhost:5173`)
2. Sprawdź widget **"Plan sprzedażowy na dziś"**
3. Jeśli widoczny - dane są zsynchronizowane ✅

---

## ❓ FAQ

### Q: Jak często dane są aktualizowane?
**A:** Automatycznie co 30 minut. Pierwsza synchronizacja następuje 30 minut po uruchomieniu backendu (NIE przy starcie).

### Q: Dlaczego dane nie są synchronizowane przy starcie aplikacji?
**A:** Aby uniknąć opóźnień przy starcie aplikacji, synchronizacja jest uruchamiana dopiero po 30 minutach. Jeśli potrzebujesz danych od razu, użyj ręcznej synchronizacji.

### Q: Mogę zmienić interwał synchronizacji?
**A:** Tak, edytuj wartość w `main.py` (linia 87) i zmień `30 * 60` na `X * 60` gdzie X to minuty.

### Q: Co jeśli synchronizacja się nie powiedzie?
**A:** System będzie próbował ponownie przy następnym cyklu (za 30 minut). Sprawdź logi backendu.

### Q: Jak wymusić natychmiastową synchronizację?
**A:** Opcja 1: Kliknij "Synchronizuj z Google Sheets" w aplikacji frontend
**A:** Opcja 2: `curl -X POST http://localhost:5555/api/sales-plans/sync`
**A:** Opcja 3: Uruchom `python auto_sync_sales_plans.py --once`

### Q: Gdzie są przechowywane dane?
**A:** W bazie SQLite: `product_states.db` w tabeli `sales_plans`

### Q: Czy mogę zobaczyć historię zmian?
**A:** Tak, każdy rekord ma pola `created_at` i `updated_at` pokazujące kiedy został utworzony/zaktualizowany.

---

## 🛠 Troubleshooting

### Problem: "Brak danych planów sprzedażowych w bazie"

**Rozwiązanie:**
```bash
# 1. Sprawdź czy tabela istnieje
python create_sales_plans_table.py

# 2. Wykonaj synchronizację
python test_sync_sales_plans.py
```

### Problem: "Nie udało się zsynchronizować danych z Google Sheets"

**Możliwe przyczyny:**
1. ❌ Brak połączenia z internetem
2. ❌ Nieprawidłowy URL Google Sheets
3. ❌ Arkusz nie jest publiczny

**Rozwiązanie:**
1. Sprawdź URL w `main.py`
2. Upewnij się że arkusz jest udostępniony jako "Każdy kto ma link"
3. Przetestuj URL w przeglądarce - powinien pobrać CSV

### Problem: Widget nie pojawia się na Dashboard

**Rozwiązanie:**
1. Sprawdź czy są dane na dziś: `curl http://localhost:5555/api/sales-plans/today`
2. Jeśli plan.total = 0, widget się nie wyświetli (warunek w kodzie)
3. Dodaj dane na dziś w Google Sheets i zsynchronizuj

---

## 📁 Pliki Projektu

```
Inteligentne zakupy/
├── backend/
│   └── main.py                                 # API + automatyczna synchronizacja
├── frontend/src/
│   └── pages/
│       ├── SalesPlans.jsx                      # Strona planów sprzedażowych
│       └── DashboardCharts.jsx                 # Dashboard z widgetem
├── product_states.db                           # Baza danych SQLite
├── auto_sync_sales_plans.py                    # Standalone skrypt synchronizacji
├── create_sales_plans_table.py                 # Tworzenie tabeli
├── test_sync_sales_plans.py                    # Test synchronizacji
├── full_test.py                                # Pełny test cyklu
├── check_specific_date.py                      # Sprawdzanie konkretnej daty
├── SALES_PLANS_DB_README.md                    # Dokumentacja bazy danych
└── AUTOMATYCZNA_SYNCHRONIZACJA_README.md       # Ta dokumentacja
```

---

## ✅ Checklist Uruchomienia

- [ ] Backend uruchomiony: `python backend/main.py`
- [ ] Frontend uruchomiony: `npm run dev` (w katalogu frontend)
- [ ] Widoczne logi synchronizacji w konsoli backend
- [ ] Strona `/sales-plans` pokazuje dane
- [ ] Dashboard pokazuje widget "Plan sprzedażowy na dziś"
- [ ] Przycisk "Synchronizuj z Google Sheets" działa

---

## 🎉 Gotowe!

System jest w pełni zautomatyzowany i nie wymaga ręcznej interwencji.
Dane będą aktualizowane automatycznie co 30 minut.

W razie pytań - sprawdź logi lub wykonaj testy diagnostyczne.
