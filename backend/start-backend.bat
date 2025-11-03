@echo off
echo ==========================================
echo  Uruchamianie Backend API (Port 3002)
echo ==========================================
echo.

REM Sprawdz czy port 3002 jest zajety
echo Sprawdzam czy port 3002 jest wolny...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    echo Port 3002 jest zajety przez proces %%a
    echo Zatrzymuje proces...
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 2 /nobreak >nul
)

echo Port 3002 jest wolny!
echo.
echo Uruchamiam backend...
echo.

python main.py

pause
