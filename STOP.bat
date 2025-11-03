@echo off
title Inteligentne Zakupy - Zatrzymywanie
color 0C

echo.
echo ======================================================
echo     INTELIGENTNE ZAKUPY - ZATRZYMYWANIE APLIKACJI
echo ======================================================
echo.

REM Zatrzymanie backendu (port 3002)
echo [1/2] Zatrzymuje Backend (port 3002)...
set backend_stopped=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    echo       Zatrzymuje proces %%a
    taskkill /F /PID %%a >nul 2>&1
    set backend_stopped=1
)
if %backend_stopped%==0 (
    echo       Backend nie byl uruchomiony
) else (
    echo       Backend zatrzymany
)
echo.

REM Zatrzymanie frontendu (port 5173)
echo [2/2] Zatrzymuje Frontend (port 5173)...
set frontend_stopped=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo       Zatrzymuje proces %%a
    taskkill /F /PID %%a >nul 2>&1
    set frontend_stopped=1
)
if %frontend_stopped%==0 (
    echo       Frontend nie byl uruchomiony
) else (
    echo       Frontend zatrzymany
)
echo.

echo ======================================================
echo  APLIKACJA ZATRZYMANA
echo ======================================================
echo.

timeout /t 5
exit
