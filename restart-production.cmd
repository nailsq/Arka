@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM Тот же хост, что и в git remote production (при необходимости замените IP/пользователя).
set "PROD_SSH=root@217.198.5.229"

echo.
echo === Перезапуск / обновление сайта на сервере ===
echo Сервер: %PROD_SSH%
echo Будет запрошен пароль SSH, если не настроены ключи.
echo.
echo ВАЖНО: файл .env НЕ едет через git. На сервере в /var/www/arka-flowers/.env
echo должны быть BOT_TOKEN=... и после правок всегда pm2 restart arka-flowers
echo.

if exist "%SystemRoot%\System32\OpenSSH\ssh.exe" (
  set "SSH_EXE=%SystemRoot%\System32\OpenSSH\ssh.exe"
) else (
  set "SSH_EXE=ssh"
)

"%SSH_EXE%" -o StrictHostKeyChecking=accept-new %PROD_SSH% "cd /var/www/arka-flowers && git pull origin main && npm install --production --no-audit --no-fund && (pm2 restart arka-flowers || pm2 start server.js --name arka-flowers --max-memory-restart 512M)"

if errorlevel 1 (
  echo.
  echo ОШИБКА: не удалось выполнить команды на сервере.
  echo Если репозиторий на сервере не клонирован с GitHub, настройте remote или используйте hook post-receive ^(см. scripts\post-receive-hook.sh^).
  pause
  exit /b 1
)

echo.
echo Готово.
pause
exit /b 0
