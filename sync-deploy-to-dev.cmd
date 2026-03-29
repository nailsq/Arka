@echo off
chcp 65001 >nul
REM Копирует актуальный deploy.bat в C:\dev\arcaflowers — запускайте из папки arka-flowers двойным щелчком.
set "TARGET=C:\dev\arcaflowers"
if not exist "%TARGET%\*" (
  echo [ОШИБКА] Нет папки: %TARGET%
  echo Создайте её или откройте этот .cmd в блокноте и исправьте путь TARGET.
  pause
  exit /b 1
)
copy /Y "%~dp0deploy.bat" "%TARGET%\deploy.bat"
if errorlevel 1 (
  echo Копирование не удалось.
  pause
  exit /b 1
)
echo Готово: deploy.bat скопирован в %TARGET%
echo Дальше: откройте cmd, выполните:  cd /d %TARGET%   и   deploy.bat
pause
