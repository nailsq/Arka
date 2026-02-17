@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "public\images" mkdir "public\images"

echo Откройте проводник, который сейчас появится.
echo Скопируйте ваш логотип PNG в эту папку и назовите его logo.png
echo.
explorer "%~dp0public\images"
pause
