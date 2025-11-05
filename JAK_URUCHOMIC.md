# Jak uruchomić aplikację "Inteligentne Zakupy"

## Porty aplikacji

- **Backend**: Port **5555**
- **Frontend**: Port **5556**

## Szybkie uruchomienie

### 1. Uruchomienie backendu (terminal 1)

```bash
cd "C:\Users\admin\Desktop\zakupy\Inteligentne zakupy\backend"
python main.py
```

Backend uruchomi się na:
- `http://localhost:5555`
- `http://10.101.101.137:5555` (sieć lokalna)
- Dokumentacja API: `http://localhost:5555/docs`

### 2. Uruchomienie frontendu (terminal 2)

```bash
cd "C:\Users\admin\Desktop\zakupy\Inteligentne zakupy\frontend"
npm run dev
```

Frontend uruchomi się na:
- `http://localhost:5556`
- `http://10.101.101.137:5556` (sieć lokalna)

## Zatrzymanie aplikacji

### Zatrzymanie procesów (z terminala)
- W terminalu backendu: naciśnij `Ctrl + C`
- W terminalu frontendu: naciśnij `Ctrl + C`

### Zatrzymanie wszystkich procesów (awaryjnie)

```bash
# Zatrzymaj wszystkie procesy Python (backend)
taskkill /F /IM python.exe

# Zatrzymaj wszystkie procesy Node (frontend)
taskkill /F /IM node.exe
```

### Zwolnienie konkretnych portów

```bash
# Znajdź proces na porcie 5555 (backend)
netstat -ano | findstr :5555

# Znajdź proces na porcie 5556 (frontend)
netstat -ano | findstr :5556

# Zabij proces po PID (zamień 12345 na faktyczny PID)
taskkill /F /PID 12345
```

## Konfiguracja połączenia z bazą danych

### Backend - SQL Server (Subiekt GT)

Utwórz plik `.env` w folderze `backend/`:

```env
SQL_SERVER=10.101.101.5\INSERTGT
SQL_DATABASE=Sporting_Leszno
SQL_USERNAME=zestawienia2
SQL_PASSWORD=twoje_haslo
```

**Uwaga:** SQL Server jest na stałym adresie `10.101.101.5\INSERTGT` i nie zmienia się.

### Frontend - Połączenie z backendem

Frontend automatycznie wykrywa IP i łączy się z backendem na tym samym adresie.

**Opcjonalnie** - jeśli chcesz ręcznie ustawić adres backendu, utwórz plik `.env` w folderze `frontend/`:

```env
VITE_API_URL=http://10.101.101.137:5555
```

## Środowiska pracy

### Praca lokalna (localhost)
- Frontend: `http://localhost:5556`
- Backend: `http://localhost:5555`
- Frontend automatycznie łączy się z backendem na `localhost:5555`

### Praca w sieci lokalnej (VM / inna maszyna)
- Frontend: `http://10.101.101.137:5556`
- Backend: `http://10.101.101.137:5555`
- Frontend automatycznie wykrywa IP i łączy się z backendem na `10.101.101.137:5555`

### Praca na domenie produkcyjnej
- Ustaw zmienną `VITE_API_URL` w pliku `.env` frontendu na właściwy adres domeny

## Rozwiązywanie problemów

### Backend nie startuje - port zajęty

```bash
netstat -ano | findstr :5555
taskkill /F /PID [znaleziony_PID]
```

### Frontend nie startuje - port zajęty

```bash
netstat -ano | findstr :5556
taskkill /F /PID [znaleziony_PID]
```

### Błąd połączenia z bazą danych

1. Sprawdź czy plik `.env` w folderze `backend/` istnieje i ma poprawne dane
2. Sprawdź połączenie z SQL Server: `10.101.101.5\INSERTGT`
3. Upewnij się, że użytkownik `zestawienia2` ma dostęp do bazy

### Frontend nie łączy się z backendem

1. Sprawdź czy backend działa: otwórz `http://localhost:5555` w przeglądarce
2. Sprawdź czy port 5555 jest otwarty: `netstat -ano | findstr :5555`
3. Sprawdź konsolę przeglądarki (F12) - tam zobaczysz błędy połączenia

## Struktura projektu

```
Inteligentne zakupy/
├── backend/
│   ├── main.py           # Główny plik backendu (port 5555)
│   ├── .env              # Konfiguracja bazy danych (nie commituj!)
│   └── ...
├── frontend/
│   ├── vite.config.js    # Konfiguracja Vite (port 5556)
│   ├── src/
│   │   ├── config/
│   │   │   └── api.js    # Automatyczne wykrywanie IP backendu
│   │   └── ...
│   └── .env              # Opcjonalna konfiguracja API URL
└── JAK_URUCHOMIC.md      # Ten plik
```

## Automatyczne wykrywanie IP

Aplikacja jest skonfigurowana tak, aby:
- Frontend automatycznie używa tego samego IP/hostname co strona, tylko zmienia port na 5555
- Backend automatycznie wykrywa swoje lokalne IP
- SQL Server pozostaje na stałym adresie: `10.101.101.5\INSERTGT`

**Jedna wersja kodu działa na:**
- localhost
- maszynie wirtualnej
- serwerze produkcyjnym z domeną
