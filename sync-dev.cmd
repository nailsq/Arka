@echo off
cd /d "%~dp0"
copy /Y "server.js" "C:\dev\arcaflowers\server.js"
if errorlevel 1 (
  echo Copy failed.
  pause
  exit /b 1
)
echo OK: C:\dev\arcaflowers\server.js
for %%F in ("C:\dev\arcaflowers\server.js") do echo %%~zF bytes
