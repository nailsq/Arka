@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Git Push ===
echo.
git add -A
git status
echo.
git commit -m "Replace flower count system with configurable sizes (S, M, L, XL)"
echo.
git push
echo.
echo === Done! ===
pause
