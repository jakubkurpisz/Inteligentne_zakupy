@echo off
echo ==========================================
echo  Uruchamianie Frontend (Port 5173)
echo ==========================================
echo.

REM Sprawdz czy port 5173 jest zajety
echo Sprawdzam czy port 5173 jest wolny...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo Port 5173 jest zajety przez proces %%a
    echo Zatrzymuje proces...
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 2 /nobreak >nul
)

echo Port 5173 jest wolny!
echo.
echo Uruchamiam frontend...
echo.

npm run dev

pause
