@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
if errorlevel 1 (
  echo.
  echo Failed to open script directory: %~dp0
  pause
  exit /b 1
)

set "LOCK_FILE=%~dp0.deploy.lock"
set "EXIT_CODE=0"

if exist "%LOCK_FILE%" (
  echo.
  echo Deploy is already running - lock file exists:
  echo %LOCK_FILE%
  echo.
  echo If you are sure no deploy is running, delete the lock file manually.
  echo Example: del "%LOCK_FILE%"
  pause
  exit /b 1
)

echo started> "%LOCK_FILE%"

REM Accept new host keys without writing to invalid NUL path
set "GIT_SSH_COMMAND=ssh -o StrictHostKeyChecking=accept-new"

git rev-parse --abbrev-ref HEAD >nul 2>&1
if errorlevel 1 (
  echo.
  echo Not a git repository or git is unavailable.
  set "EXIT_CODE=1"
  goto :finish
)

for /f %%i in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%i
if /I not "%BRANCH%"=="main" (
  echo.
  echo Current branch is "%BRANCH%". Switch to "main" before deploy.
  set "EXIT_CODE=1"
  goto :finish
)

git status --porcelain >nul 2>&1
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set CHANGED=%%i
if not "%CHANGED%"=="0" (
  echo.
  set /p COMMIT_MSG=Enter commit message: 
  if "!COMMIT_MSG!"=="" set COMMIT_MSG=update
  git add -A
  git commit -m "!COMMIT_MSG!"
  if errorlevel 1 (
    echo.
    echo Commit failed.
    set "EXIT_CODE=1"
    goto :finish
  )
) else (
  echo.
  echo No local changes. Deploying latest main commit.
)

git push origin main
if errorlevel 1 (
  echo.
  echo GitHub push failed.
  set "EXIT_CODE=1"
  goto :finish
)

git push production main
if errorlevel 1 (
  echo.
  echo Production deploy push failed.
  set "EXIT_CODE=1"
  goto :finish
)

echo.
echo Done.
goto :finish

:finish
if exist "%LOCK_FILE%" del "%LOCK_FILE%" >nul 2>&1
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Deploy finished with errors.
  pause
  exit /b %EXIT_CODE%
)
pause
exit /b 0
