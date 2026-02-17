@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Удаляю старую базу данных...
if exist arka.db del arka.db
echo Создаю новую базу данных...
node seed.js
echo.
echo Готово! База данных пересоздана.
pause
