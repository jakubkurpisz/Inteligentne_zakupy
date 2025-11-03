# Inteligentne Zakupy - System zarządzania produktami

System do zarządzania produktami z automatyczną aktualizacją danych z SQL Server i CSV, śledzeniem zmian stanów i cen oraz interfejsem webowym.

## Struktura projektu

```
Inteligentne zakupy/
├── backend/                      # Backend API (Python FastAPI)
│   ├── main.py                  # Główny plik API
│   ├── requirements.txt         # Zależności Python
│   └── README.md               # Dokumentacja backendu
├── frontend/                    # Frontend (React + Vite)
│   ├── src/                    # Kod źródłowy React
│   ├── package.json            # Zależności npm
│   └── README.md              # Dokumentacja frontendu
├── product_data_manager_optimized.py  # Skrypt do aktualizacji danych (NOWY!)
├── product_data_manager.py     # Stary skrypt (backup)
├── migrate_db.py               # Skrypt migracji bazy danych
├── product_states.db           # Baza danych SQLite
└── .env                        # Konfiguracja środowiska
```

## Nowe funkcje (Zoptymalizowany system)

### Śledzenie zmian
System teraz śledzi:
- ✓ **Zmiany stanów** - monitorowanie zmian ilości produktów
- ✓ **Zmiany cen** - śledzenie aktualizacji cen
- ✓ **Nowe produkty** - oznaczanie nowo dodanych produktów
- ✓ **Historia zmian** - pełna historia wszystkich zmian w bazie

### Nowe kolumny w bazie danych
- `LastUpdated` - data ostatniej aktualizacji produktu
- `LastStanChange` - data ostatniej zmiany stanu
- `LastPriceChange` - data ostatniej zmiany ceny
- `PreviousStan` - poprzedni stan magazynowy
- `PreviousPrice` - poprzednia cena
- `IsNew` - flaga oznaczająca nowy produkt

### Nowa tabela change_log
Przechowuje historię wszystkich zmian:
- ID zmiany
- Symbol produktu
- Typ zmiany (STAN, PRICE, NEW)
- Stara wartość
- Nowa wartość
- Data zmiany

## Wymagania

### Backend (Python)
- Python 3.7+
- pip
- SQLite (wbudowany w Python)

### Frontend (Node.js)
- Node.js 16+
- npm

## Instalacja

### 1. Backend

```bash
cd "Inteligentne zakupy/backend"
pip install -r requirements.txt
```

### 2. Frontend

```bash
cd "Inteligentne zakupy/frontend"
npm install
```

### 3. Migracja bazy danych (jednorazowo)

Jeśli masz istniejącą bazę danych, uruchom migrację aby dodać nowe kolumny:

```bash
cd "Inteligentne zakupy"
python migrate_db.py
```

## Uruchomienie

### Sposób 1: Ręczne uruchomienie wszystkich komponentów

#### Terminal 1 - Backend API
```bash
cd "Inteligentne zakupy/backend"
python main.py
```
Backend będzie dostępny na: `http://localhost:3001`

#### Terminal 2 - Frontend
```bash
cd "Inteligentne zakupy/frontend"
npm run dev
```
Frontend będzie dostępny na: `http://localhost:5173`

### Sposób 2: Backend z auto-reload (dla developmentu)
```bash
cd "Inteligentne zakupy/backend"
uvicorn main:app --reload --port 3001
```

## Endpointy API

### Podstawowe
- `GET /` - Strona główna API z informacjami
- `GET /docs` - Interaktywna dokumentacja Swagger UI
- `GET /redoc` - Dokumentacja ReDoc

### Dane produktów
- `GET /api/sales-data` - Wszystkie produkty
- `GET /api/sales-summary` - Podsumowanie sprzedaży (dzienne, tygodniowe, miesięczne, roczne)

### Nowe endpointy (śledzenie zmian)
- `GET /api/stats` - Statystyki bazy danych
- `GET /api/changes/recent?limit=100` - Ostatnie zmiany (domyślnie 100)
- `GET /api/products/new` - Nowe produkty
- `GET /api/products/updated?minutes=10` - Produkty zaktualizowane w ostatnich X minutach

## Automatyczna aktualizacja danych

Backend automatycznie uruchamia skrypt `product_data_manager_optimized.py`:
- **Przy starcie** - natychmiastowa aktualizacja
- **Co 5 minut** - cykliczna aktualizacja danych

Skrypt:
1. Pobiera dane z SQL Server (9000+ produktów)
2. Pobiera dane z CSV Alpine Pro (900+ produktów)
3. Śledzi zmiany i loguje je w `change_log`
4. Wyświetla podsumowanie zmian

### Przykładowy output aktualizacji:
```
============================================================
Rozpoczynam aktualizacje danych: 2025-10-29 13:35:13
============================================================

[SQL Server] Pobrano 9337 produktow
  [SQL] ZMIANA STANU: 194502370805 (2.0 -> 1.0)
  [SQL] NOWY PRODUKT: 195244488063
  [SQL] ZMIANA CENY: 4068801539637 (69.99 -> 64.99)

[CSV] Pobrano 932 produktow
  [CSV] NOWY PRODUKT: 8591747780864
  [CSV] ZMIANA STANU: 8591747710984 (1.0 -> 2.0)

============================================================
PODSUMOWANIE:
  Laczna liczba produktow: 10488
  Nowe produkty: 257
  Zaktualizowane produkty: 10231
  Laczna liczba zmian: 588
============================================================
```

## Konfiguracja (.env)

Plik `.env` w katalogu głównym:

```env
SQL_SERVER=10.101.101.5\INSERTGT
SQL_DATABASE=Sporting_Leszno
SQL_USERNAME=zestawienia2
SQL_PASSWORD=***
```

## Przykłady użycia API

### Sprawdzenie statystyk
```bash
curl http://localhost:3001/api/stats
```

Odpowiedź:
```json
{
  "total_products": 10488,
  "new_products": 257,
  "recently_updated": 10231,
  "recent_changes": 588,
  "total_changes_logged": 588
}
```

### Ostatnie zmiany
```bash
curl http://localhost:3001/api/changes/recent?limit=10
```

### Nowe produkty
```bash
curl http://localhost:3001/api/products/new
```

### Produkty zaktualizowane w ostatnich 30 minutach
```bash
curl http://localhost:3001/api/products/updated?minutes=30
```

## Różnice między starym a nowym systemem

| Funkcja | Stary system | Nowy system |
|---------|-------------|-------------|
| Backend | Node.js | Python FastAPI |
| Aktualizacja danych | INSERT OR REPLACE (wszystko) | Inteligentny upsert (tylko zmiany) |
| Śledzenie zmian | Brak | Pełna historia zmian |
| Wydajność | Wolniejsza | Szybsza (tylko zmiany) |
| Dokumentacja API | Brak | Swagger + ReDoc |
| Logowanie zmian | Brak | Szczegółowe logi |
| Statystyki | Podstawowe | Zaawansowane |

## Rozwiązywanie problemów

### Backend nie uruchamia się
```bash
# Sprawdź czy zainstalowane są zależności
pip install -r backend/requirements.txt

# Sprawdź czy port 3001 jest wolny
netstat -an | findstr 3001
```

### Baza danych nie ma nowych kolumn
```bash
# Uruchom migrację
python migrate_db.py
```

### Frontend nie łączy się z backendem
- Sprawdź czy backend działa na porcie 3001
- Sprawdź ustawienia CORS w `backend/main.py`
- Sprawdź konfigurację API URL w frontendzie

## Autor

System zarządzania produktami dla Sporting Leszno

## Licencja

Prywatne - tylko do użytku wewnętrznego
