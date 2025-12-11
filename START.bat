@echo off
title Inteligentne Zakupy - Uruchamianie
color 0A

echo.
echo ======================================================
echo         INTELIGENTNE ZAKUPY - SYSTEM STARTOWY
echo ======================================================
echo.
echo  Ten skrypt uruchomi:
echo  1. Backend API (Python FastAPI) na porcie 5555
echo  2. Frontend (React + Vite) na porcie 5556
echo.
echo  Porty sa przypisane na stale i automatycznie czyszczone
echo  przed uruchomieniem aplikacji.
echo.
echo ======================================================
echo.

REM Czyszczenie portu 5555 (Backend)
echo [1/4] Sprawdzam i czyszcze port 5555 (Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5555 ^| findstr LISTENING') do (
    echo       Port 5555 zajety - zatrzymuje proces %%a
    taskkill /F /PID %%a >nul 2>&1
)
echo       Port 5555 jest wolny!
echo.

REM Czyszczenie portu 5556 (Frontend)
echo [2/4] Sprawdzam i czyszcze port 5556 (Frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5556 ^| findstr LISTENING') do (
    echo       Port 5556 zajety - zatrzymuje proces %%a
    taskkill /F /PID %%a >nul 2>&1
)
echo       Port 5556 jest wolny!
echo.

timeout /t 2 /nobreak >nul

REM Uruchomienie backendu w nowym oknie
echo [3/4] Uruchamiam Backend API...
cd /d "%~dp0backend"
start "Backend API (Port 5555)" cmd /k "python main.py"
echo       Backend uruchomiony w osobnym oknie
echo.

timeout /t 3 /nobreak >nul

REM Uruchomienie frontendu w nowym oknie
echo [4/4] Uruchamiam Frontend...
cd /d "%~dp0frontend"
start "Frontend (Port 5556)" cmd /k "npm run dev"
echo       Frontend uruchomiony w osobnym oknie
echo.

echo ======================================================
echo  APLIKACJA URUCHOMIONA!
echo ======================================================
echo.
echo  Backend API:  http://localhost:5555
echo  Dokumentacja: http://localhost:5555/docs
echo  Frontend:     http://localhost:5556
echo.
echo  W sieci lokalnej:
echo  Frontend:     http://10.101.101.137:5556
echo  Backend:      http://10.101.101.137:5555
echo.
echo ======================================================
echo.
echo  Aby zatrzymac aplikacje, zamknij okna backendu i frontendu
echo  lub nacisnij Ctrl+C w kazdym z nich.
echo.

timeout /t 10

exit
