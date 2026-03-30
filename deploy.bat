@echo off
chcp 65001 >nul
REM Deploy: GitHub + VPS. Russian messages need UTF-8 + this chcp in cmd.
setlocal EnableDelayedExpansion
cd /d "%~dp0"
if errorlevel 1 (
  echo.
  echo Failed to open script directory: %~dp0
  pause
  exit /b 1
)

REM Stale lock from old script
del /F /Q "%LOCALAPPDATA%\Temp\arcaflowers-deploy.lock" 2>nul

REM SSH: Cyrillic user path breaks Git/MSYS; HOME uses ASCII-only path for ssh keys
set "HOME=%ProgramData%\arka-git-ssh"
if not exist "%HOME%" mkdir "%HOME%" 2>nul
if not exist "%HOME%\.ssh" mkdir "%HOME%\.ssh" 2>nul
REM Git reads global config from HOME/.gitconfig — with HOME above it would miss your real profile. Force standard global config path:
if defined USERPROFILE set "GIT_CONFIG_GLOBAL=%USERPROFILE%\.gitconfig"

REM Prefer Windows OpenSSH; else Git's ssh
if exist "%SystemRoot%\System32\OpenSSH\ssh.exe" (
  set "GIT_SSH_COMMAND=%SystemRoot%\System32\OpenSSH\ssh.exe -o StrictHostKeyChecking=accept-new"
) else (
  set "GIT_SSH_COMMAND=ssh -o StrictHostKeyChecking=accept-new"
)

echo.
echo === Deploy: %CD% ===
echo.

git rev-parse --abbrev-ref HEAD >nul 2>&1
if errorlevel 1 (
  echo ERROR: Not a git repository or git is not in PATH.
  echo Install Git for Windows: https://git-scm.com/download/win
  pause
  exit /b 1
)

REM Git would use mingw ssh; core.sshCommand fixes ~/.ssh with Cyrillic profile path
if exist "%SystemRoot%\System32\OpenSSH\ssh.exe" (
  git config core.sshCommand "%SystemRoot:\=/%/System32/OpenSSH/ssh.exe -o StrictHostKeyChecking=accept-new"
)

git remote get-url production >nul 2>&1
if errorlevel 1 (
  echo ERROR: remote "production" is not configured in this repo.
  echo Run once:
  echo   git remote add production root@217.198.5.229:/var/git/arka-flowers.git
  pause
  exit /b 1
)

for /f %%i in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%i
if /I not "!BRANCH!"=="main" (
  echo ERROR: current branch is "!BRANCH!". Switch to main:  git checkout main
  pause
  exit /b 1
)

git status --porcelain >nul 2>&1
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set CHANGED=%%i
if not "!CHANGED!"=="0" (
  set "GNAME="
  set "GEMAIL="
  for /f "delims=" %%a in ('git config user.name 2^>nul') do set "GNAME=%%a"
  for /f "delims=" %%a in ('git config user.email 2^>nul') do set "GEMAIL=%%a"
  set "NEEDID="
  if "!GNAME!"=="" set NEEDID=1
  if "!GEMAIL!"=="" set NEEDID=1
  if defined NEEDID (
    echo.
    echo [ERROR] Git identity not set: user.name and user.email are required for commit.
    echo Run once in cmd:
    echo   git config --global user.email "your@email.com"
    echo   git config --global user.name "Your Name"
    echo Or double-click: git-identity-once.cmd  (same folder as deploy.bat^)
    echo Then run deploy.bat again.
    echo.
    pause
    exit /b 1
  )
  echo There are uncommitted changes. Enter commit message ^(or empty for "update"^):
  set /p COMMIT_MSG=
  if "!COMMIT_MSG!"=="" set COMMIT_MSG=update
  git add -A
  git commit -m "!COMMIT_MSG!"
  if errorlevel 1 (
    echo ERROR: git commit failed.
    pause
    exit /b 1
  )
) else (
  echo No local changes — pushing existing latest main commit.
)

echo.
echo --- Sync with GitHub: fetch + merge origin/main ---
echo    (merge is easier than rebase if histories diverged^)
set "DIDSTASH="
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set WC=%%i
if not "!WC!"=="0" (
  echo Uncommitted files — saving to stash, then merge...
  git stash push -u -m "deploy-pre-pull"
  if errorlevel 1 (
    echo ERROR: git stash failed. Close Cursor/IDE or programs locking files, then retry.
    pause
    exit /b 1
  )
  set DIDSTASH=1
)
git fetch origin
if errorlevel 1 (
  echo ERROR: git fetch failed — internet or github.com unreachable.
  if defined DIDSTASH echo Restore work:  git stash pop
  pause
  exit /b 1
)
git merge origin/main --no-edit
if errorlevel 1 (
  echo.
  echo ERROR: merge conflict with GitHub. In files remove markers ^<^<^<  ^=^=^=  ^>^>^>^, keep correct code, then run in this folder:
  echo   git add -A
  echo   git commit -m "resolve merge"
  echo   deploy.bat
  if defined DIDSTASH echo Saved work is in stash. After commit:  git stash pop
  pause
  exit /b 1
)
if defined DIDSTASH (
  echo Restoring your uncommitted files from stash...
  git stash pop
  if errorlevel 1 (
    echo.
    echo ERROR: conflict after stash pop. Fix files, then:  git add -A  ^&^&  git commit -m "wip"  ^&^&  deploy.bat
    pause
    exit /b 1
  )
)

echo.
echo --- git push origin main ---
git push origin main
if errorlevel 1 (
  echo.
  echo ERROR: push to GitHub ^(origin^) failed. Internet, credentials, or run pull again.
  pause
  exit /b 1
)

echo.
echo --- git push production main ^(SSH to VPS^) ---
echo If asked for password: enter root password for the server.
git push production main
if errorlevel 1 (
  echo.
  echo ERROR: push to production failed. Typical causes:
  echo   - Wrong SSH password or key not added on server
  echo   - Server down or firewall
  echo   - Path on server: root@217.198.5.229:/var/git/arka-flowers.git
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   PUSH OK. On the server ^(SSH^) run one line:
echo   cd /root/arka-flowers/arka-flowers ^&^& git pull ^&^& pm2 restart arka-flowers
echo ============================================================
echo.
pause
