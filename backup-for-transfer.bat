@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SRC=C:\dev\arcaflowers"
set "DST=C:\transfer-arka"

echo ========================================
echo  ARKA backup for transfer
echo ========================================
echo.

if not exist "%SRC%" (
  echo [ERROR] Source folder not found: %SRC%
  pause
  exit /b 1
)

if not exist "%DST%" mkdir "%DST%"
if not exist "%DST%\project" mkdir "%DST%\project"

if exist "%SRC%\restore-on-new-pc.bat" (
  copy /Y "%SRC%\restore-on-new-pc.bat" "%DST%\" >nul
)

echo [1/4] Copying critical files...
for %%F in (.env arka.db arka.db-wal arka.db-shm) do (
  if exist "%SRC%\%%F" (
    copy /Y "%SRC%\%%F" "%DST%\" >nul
    echo   [OK] %%F
  ) else (
    echo   [SKIP] %%F not found
  )
)

echo [2/4] Copying project files (without node_modules/.git)...
robocopy "%SRC%" "%DST%\project" /E /XD node_modules .git .cursor /XF npm-debug.log yarn-error.log >nul
set "RC=%ERRORLEVEL%"
if %RC% LEQ 7 (
  echo   [OK] Project copied
) else (
  echo   [WARN] Robocopy return code: %RC%
)

echo [3/4] Creating ZIP archive...
powershell -NoProfile -Command "if (Test-Path '%DST%\arka-project.zip') { Remove-Item '%DST%\arka-project.zip' -Force }; Compress-Archive -Path '%DST%\project\*' -DestinationPath '%DST%\arka-project.zip' -Force"
if errorlevel 1 (
  echo   [WARN] ZIP creation failed
) else (
  echo   [OK] ZIP created: %DST%\arka-project.zip
)

echo [4/4] Done.
echo Transfer folder: %DST%
echo.
echo Move this folder to the new PC, then run:
echo   C:\transfer-arka\restore-on-new-pc.bat
echo.
pause
