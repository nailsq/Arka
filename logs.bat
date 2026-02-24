@echo off
setlocal
cd /d C:\Users\Пользователь\arka-flowers

REM Avoid SSH host-key prompt/known_hosts issues on Windows with Cyrillic profile path
set "GIT_SSH_COMMAND=ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=NUL"

ssh root@217.198.5.229 "pm2 logs 0 --lines 120 --nostream"
echo.
pause
