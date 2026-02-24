@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
if errorlevel 1 (
  echo.
  echo Failed to open script directory: %~dp0
  pause
  exit /b 1
)

REM Accept new host keys without writing to invalid NUL path
set "GIT_SSH_COMMAND=ssh -o StrictHostKeyChecking=accept-new"

git rev-parse --abbrev-ref HEAD >nul 2>&1
if errorlevel 1 (
  echo.
  echo Not a git repository or git is unavailable.
  pause
  exit /b 1
)

for /f %%i in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%i
if /I not "%BRANCH%"=="main" (
  echo.
  echo Current branch is "%BRANCH%". Switch to "main" before deploy.
  pause
  exit /b 1
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
    pause
    exit /b 1
  )
) else (
  echo.
  echo No local changes. Deploying latest main commit.
)

git push origin main
if errorlevel 1 (
  echo.
  echo GitHub push failed.
  pause
  exit /b 1
)

git push production main
if errorlevel 1 (
  echo.
  echo Production deploy push failed.
  pause
  exit /b 1
)

echo.
echo Done.
pause
