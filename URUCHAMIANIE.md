# Inteligentne Zakupy - Instrukcja Uruchamiania

## Stałe Porty

Aplikacja używa następujących portów, które są przypisane na stałe:

- **Backend (FastAPI)**: Port `3002`
- **Frontend (React + Vite)**: Port `5173`

## Szybkie Uruchomienie

### Opcja 1: Automatyczne uruchomienie (ZALECANE)

Po prostu kliknij dwukrotnie na plik:

```
START.bat
```

Ten skrypt automatycznie:
1. Sprawdzi i oczyści porty 3002 i 5173
2. Uruchomi backend w osobnym oknie
3. Uruchomi frontend w osobnym oknie

### Opcja 2: Uruchomienie ręczne

#### Backend:
```
cd backend
start-backend.bat
```

#### Frontend:
```
cd frontend
start-frontend.bat
```

## Dostęp do aplikacji

### Dostęp lokalny:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3002
- **Dokumentacja API**: http://localhost:3002/docs

### Dostęp z sieci lokalnej:
- **Frontend**: http://10.101.101.137:5173
- **Backend API**: http://10.101.101.137:3002

## Rozwiązywanie problemów

### Problem: Port jest zajęty

Skrypty automatycznie czyszczą porty przed uruchomieniem. Jeśli nadal masz problemy:

1. **Sprawdź co zajmuje port 3002:**
   ```
   netstat -ano | findstr :3002
   ```

2. **Sprawdź co zajmuje port 5173:**
   ```
   netstat -ano | findstr :5173
   ```

3. **Zabij proces ręcznie:**
   ```
   taskkill /F /PID [numer_procesu]
   ```

### Problem: Backend się nie uruchamia

1. Sprawdź czy masz zainstalowane wymagane biblioteki Python:
   ```
   cd backend
   pip install -r requirements.txt
   ```

2. Sprawdź czy masz dostęp do bazy danych SQL Server

### Problem: Frontend się nie uruchamia

1. Zainstaluj zależności npm:
   ```
   cd frontend
   npm install
   ```

2. Sprawdź czy plik `.env` istnieje w katalogu frontend

## Konfiguracja

### Backend
- Konfiguracja: `backend/main.py`
- Port: `3002` (linia 471)
- Host: `0.0.0.0` (dostęp z sieci, linia 475)

### Frontend
- Konfiguracja: `frontend/vite.config.js`
- Port: `5173` (linia 7)
- StrictPort: `true` (nie pozwala na zmianę portu, linia 8)
- Host: `true` (dostęp z sieci, linia 9)
- API URL: `frontend/.env`

### Zmiana adresu IP dla sieci lokalnej

Jeśli Twój adres IP się zmieni, edytuj plik:
```
frontend/.env
```

Zmień wartość `VITE_API_URL` na nowy adres IP:
```
VITE_API_URL=http://[NOWY_IP]:3002
```

## Zatrzymywanie aplikacji

### Opcja 1: Automatyczne zatrzymanie (ZALECANE)

Kliknij dwukrotnie na plik:
```
STOP.bat
```

### Opcja 2: Ręczne zatrzymanie

1. Zamknij okna backendu i frontendu (kliknij X)
2. Lub naciśnij `Ctrl+C` w każdym oknie terminala

## Wymagania systemowe

- Python 3.8+
- Node.js 16+
- npm 8+
- Dostęp do SQL Server (dla pełnej funkcjonalności)
- Windows (skrypty .bat)

## Wsparcie

W razie problemów sprawdź logi w oknach terminala backendu i frontendu.
