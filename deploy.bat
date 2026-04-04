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

del /F /Q "%LOCALAPPDATA%\Temp\arcaflowers-deploy.lock" 2>nul

REM SSH keys: раньше HOME всегда был ProgramData\arka-git-ssh — без ключей там
REM git push production падал с Permission denied (publickey).
REM Теперь: если в arka-git-ssh\.ssh есть ключ — используем его; иначе — %USERPROFILE%\.ssh
REM (OpenSSH из System32 нормально работает с кириллицей в пути профиля.)
set "ARKA_SSH_HOME=%ProgramData%\arka-git-ssh"
set "USE_ARKA_HOME="
if exist "%ARKA_SSH_HOME%\.ssh\id_ed25519" set "USE_ARKA_HOME=1"
if exist "%ARKA_SSH_HOME%\.ssh\id_rsa" set "USE_ARKA_HOME=1"
if defined USE_ARKA_HOME (
  set "HOME=%ARKA_SSH_HOME%"
  if not exist "!HOME!" mkdir "!HOME!" 2>nul
  if not exist "!HOME!\.ssh" mkdir "!HOME!\.ssh" 2>nul
  echo SSH: ключи из !HOME!\.ssh
) else (
  if defined USERPROFILE (
    set "HOME=%USERPROFILE%"
    echo SSH: ключи из !HOME!\.ssh ^(стандартная папка Windows^)
  ) else (
    set "HOME=%ProgramData%\arka-git-ssh"
    if not exist "!HOME!" mkdir "!HOME!" 2>nul
    if not exist "!HOME!\.ssh" mkdir "!HOME!\.ssh" 2>nul
    echo SSH: USERPROFILE не задан, используется !HOME!\.ssh
  )
  if not exist "!HOME!\.ssh\id_ed25519" if not exist "!HOME!\.ssh\id_rsa" (
    echo.
    echo [ВНИМАНИЕ] В !HOME!\.ssh не найдены id_ed25519 / id_rsa.
    echo Создайте ключ:  ssh-keygen -t ed25519 -C "deploy"
    echo Или скопируйте ключи в %ProgramData%\arka-git-ssh\.ssh и снова deploy.bat
    echo.
  )
)
if defined USERPROFILE set "GIT_CONFIG_GLOBAL=%USERPROFILE%\.gitconfig"

REM Git for Windows вызывает GIT_SSH_COMMAND через sh (MSYS): путь с C:\... ломается.
REM Нужен путь со слешами /, например C:/Windows/System32/OpenSSH/ssh.exe
set "GIT_WIN_SSH=%SystemRoot:\=/%/System32/OpenSSH/ssh.exe"
set "GIT_SSH="
if exist "%SystemRoot%\System32\OpenSSH\ssh.exe" (
  set "GIT_SSH_COMMAND=!GIT_WIN_SSH! -o StrictHostKeyChecking=accept-new"
) else (
  set "GIT_SSH_COMMAND=ssh -o StrictHostKeyChecking=accept-new"
)

REM Не пишем core.sshCommand в .git/config (та же проблема со слешами в sh).
git config --unset core.sshCommand 2>nul

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
  echo ERROR: merge conflict. Remove ^<^<^<  ^=^=^=  ^>^>^> in files, then:
  echo   git add -A
  echo   git commit -m "resolve merge"
  echo   deploy.bat
  if defined DIDSTASH echo Stash:  git stash pop  (after commit^)
  pause
  exit /b 1
)
if defined DIDSTASH (
  echo Restoring stashed files...
  git stash pop
  if errorlevel 1 (
    echo ERROR: conflict after stash pop. Fix, then:  git add -A ^&^& git commit -m "wip" ^&^& deploy.bat
    pause
    exit /b 1
  )
)

echo.
echo --- git push origin main ---
git push origin main
if errorlevel 1 (
  echo ERROR: push to GitHub failed. Check internet and credentials.
  pause
  exit /b 1
)

echo.
echo --- git push production main ^(SSH^) ---
echo If asked for password: enter root password for the server.
git push production main
if errorlevel 1 (
  echo ERROR: push to production failed. SSH password or server path.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   PUSH OK — код на сервере ^(bare repo^).
echo.
echo   Если установлен hook post-receive ^(см. scripts\post-receive-hook.sh^),
echo   сайт /var/www уже обновлён и PM2 перезапущен.
echo.
echo   Если hook ещё не ставили: дважды щёлкните  restart-production.cmd
echo   ^(введите пароль SSH^) — git pull + npm + pm2 restart.
echo ============================================================
echo.
pause
exit /b 0
