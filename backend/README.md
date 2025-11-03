# Backend Python - Inteligentne Zakupy

Backend API napisany w FastAPI do zarządzania danymi sprzedażowymi.

## Instalacja

1. Zainstaluj zależności:
```bash
pip install -r requirements.txt
```

## Uruchomienie

### Metoda 1: Bezpośrednio przez Python
```bash
python main.py
```

### Metoda 2: Przez uvicorn (rekomendowane dla developmentu)
```bash
uvicorn main:app --reload --port 3001
```

Serwer uruchomi się na: `http://localhost:3001`

## Endpointy API

- `GET /` - Strona główna z informacjami o API
- `GET /api/sales-data` - Pobiera wszystkie dane produktów
- `GET /api/sales-summary` - Pobiera zagregowane dane sprzedażowe (dzienne, tygodniowe, miesięczne, roczne)
- `GET /docs` - Interaktywna dokumentacja Swagger UI
- `GET /redoc` - Alternatywna dokumentacja ReDoc

## Funkcjonalności

- Automatyczne uruchamianie skryptu `product_data_manager.py` przy starcie serwera
- Cykliczne uruchamianie skryptu co 5 minut
- CORS włączony dla wszystkich źródeł (zmień w produkcji)
- Obsługa bazy danych SQLite
- Agregacja danych sprzedażowych po dniu, tygodniu, miesiącu i roku

## Wymagania

- Python 3.7+
- FastAPI
- Uvicorn
- SQLite (wbudowany w Python)

## Struktura projektu

```
backend/
├── main.py              # Główny plik aplikacji FastAPI
├── requirements.txt     # Zależności Python
└── README.md           # Ten plik
```
