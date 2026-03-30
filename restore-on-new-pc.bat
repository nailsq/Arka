@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "TRANSFER_DIR=C:\transfer-arka"
set "ZIP_FILE=%TRANSFER_DIR%\arka-project.zip"
set "TARGET_DIR=C:\dev\arcaflowers"

echo ========================================
echo  ARKA restore on new PC
echo ========================================
echo.

if not exist "%TRANSFER_DIR%" (
  echo [ERROR] Transfer folder not found: %TRANSFER_DIR%
  echo Copy transfer folder to this PC first.
  pause
  exit /b 1
)

if not exist "%ZIP_FILE%" (
  echo [ERROR] Archive not found: %ZIP_FILE%
  echo Put arka-project.zip into %TRANSFER_DIR%.
  pause
  exit /b 1
)

if not exist "C:\dev" (
  mkdir "C:\dev"
)

if not exist "%TARGET_DIR%" (
  mkdir "%TARGET_DIR%"
)

echo [1/5] Unpacking project to %TARGET_DIR%...
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%TARGET_DIR%' -Force"
if errorlevel 1 (
  echo [ERROR] Failed to unpack project archive.
  pause
  exit /b 1
)

echo [2/5] Restoring critical files (.env + database)...
for %%F in (.env arka.db arka.db-wal arka.db-shm) do (
  if exist "%TRANSFER_DIR%\%%F" (
    copy /Y "%TRANSFER_DIR%\%%F" "%TARGET_DIR%\" >nul
    echo   [OK] %%F restored
  ) else (
    echo   [SKIP] %%F not found in transfer folder
  )
)

echo [3/5] Installing npm dependencies...
pushd "%TARGET_DIR%"
call npm install
if errorlevel 1 (
  popd
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)
popd

echo [4/5] Restore complete.
echo.
echo Project folder: %TARGET_DIR%
echo Next commands:
echo   cd /d %TARGET_DIR%
echo   node server.js
echo.
echo Optional PM2:
echo   npm i -g pm2
echo   pm2 start server.js --name arka-flowers
echo   pm2 save
echo.
echo [5/5] Done.
pause
