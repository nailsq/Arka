@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Git Push ===
echo.
git add -A
git status
echo.
git commit -m "Cart: bigger cards, no size jump. Profile: prominent tracking widget"
echo.
git push
echo.
echo === Done! ===
pause
