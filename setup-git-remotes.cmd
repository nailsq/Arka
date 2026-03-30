@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === Проверка связи с GitHub и сервером ===
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo Ошибка: здесь нет git-репозитория.
  pause
  exit /b 1
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo Добавляю remote origin ^(GitHub^)...
  git remote add origin https://github.com/nailsq/Arka.git
) else (
  echo origin уже есть.
)

git remote get-url production >nul 2>&1
if errorlevel 1 (
  echo Добавляю remote production ^(VPS^)...
  git remote add production root@217.198.5.229:/var/git/arka-flowers.git
) else (
  echo production уже есть.
)

echo.
echo Текущие remotes:
git remote -v

echo.
echo Проверка доступа к GitHub ^(только чтение^)...
git ls-remote origin refs/heads/main >nul 2>&1
if errorlevel 1 (
  echo [ВНИМАНИЕ] Не удалось связаться с GitHub. Интернет, VPN или настройки доступа к репозиторию.
) else (
  echo [OK] Ветка main на GitHub доступна.
)

echo.
echo Дальше: настройте имя/email для Git ^(один раз^), затем запускайте deploy.bat
echo   git config --global user.email "ваш@email.com"
echo   git config --global user.name "Ваше имя"
echo.
pause
