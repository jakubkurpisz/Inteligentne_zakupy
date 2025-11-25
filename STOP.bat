@echo off
echo Zatrzymywanie wszystkich procesow Python...
taskkill /F /IM python.exe 2^
timeout /t 2 ^
echo Gotowe!
