@echo off
title Inteligentne Zakupy - Uruchamianie
color 0A

echo.
echo ======================================================
echo         INTELIGENTNE ZAKUPY - SYSTEM STARTOWY
echo ======================================================
echo.
echo  Ten skrypt uruchomi:
echo  1. Backend API (Python FastAPI) na porcie 3002
echo  2. Frontend (React + Vite) na porcie 5173
echo.
echo  Porty sa przypisane na stale i automatycznie czyszczone
echo  przed uruchomieniem aplikacji.
echo.
echo ======================================================
echo.

REM Czyszczenie portu 3002 (Backend)
echo [1/4] Sprawdzam i czyszcze port 3002 (Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    echo       Port 3002 zajety - zatrzymuje proces %%a
    taskkill /F /PID %%a >nul 2>&1
)
echo       Port 3002 jest wolny!
echo.

REM Czyszczenie portu 5173 (Frontend)
echo [2/4] Sprawdzam i czyszcze port 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo       Port 5173 zajety - zatrzymuje proces %%a
    taskkill /F /PID %%a >nul 2>&1
)
echo       Port 5173 jest wolny!
echo.

timeout /t 2 /nobreak >nul

REM Uruchomienie backendu w nowym oknie
echo [3/4] Uruchamiam Backend API...
cd /d "%~dp0backend"
start "Backend API (Port 3002)" cmd /k "python main.py"
echo       Backend uruchomiony w osobnym oknie
echo.

timeout /t 3 /nobreak >nul

REM Uruchomienie frontendu w nowym oknie
echo [4/4] Uruchamiam Frontend...
cd /d "%~dp0frontend"
start "Frontend (Port 5173)" cmd /k "npm run dev"
echo       Frontend uruchomiony w osobnym oknie
echo.

echo ======================================================
echo  APLIKACJA URUCHOMIONA!
echo ======================================================
echo.
echo  Backend API:  http://localhost:3002
echo  Dokumentacja: http://localhost:3002/docs
echo  Frontend:     http://localhost:5173
echo.
echo  W sieci lokalnej:
echo  Frontend:     http://10.101.101.137:5173
echo  Backend:      http://10.101.101.137:3002
echo.
echo ======================================================
echo.
echo  Aby zatrzymac aplikacje, zamknij okna backendu i frontendu
echo  lub nacisnij Ctrl+C w kazdym z nich.
echo.

timeout /t 10

exit
