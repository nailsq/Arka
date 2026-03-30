#!/usr/bin/env bash
# Однократное подключение каталога на VPS к GitHub без потери .env
# Использование на сервере (после chmod +x):
#   bash scripts/server-link-git-safe.sh
# Или скопируйте содержимое в файл на сервере и запустите bash.

set -euo pipefail

APP_DIR="${APP_DIR:-/root/arka-flowers/arka-flowers}"
ORIGIN_URL="${ORIGIN_URL:-https://github.com/nailsq/Arka.git}"
BRANCH="${BRANCH:-main}"
BACKUP_DIR="${BACKUP_DIR:-/root/arka-flowers-backup-$(date +%Y%m%d-%H%M%S)}"

echo "=== Каталог приложения: $APP_DIR ==="
if [[ ! -d "$APP_DIR" ]]; then
  echo "Ошибка: каталог не найден: $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

# 1) Резервная копия .env (и при желании всей папки)
if [[ -f .env ]]; then
  mkdir -p "$BACKUP_DIR"
  cp -a .env "$BACKUP_DIR/.env"
  echo "Сохранено: $BACKUP_DIR/.env"
fi

# 2) Если уже git-репозиторий — только подтянуть изменения
if [[ -d .git ]]; then
  echo "Уже есть .git — делаю git fetch и pull..."
  git remote get-url origin &>/dev/null || git remote add origin "$ORIGIN_URL"
  git fetch origin
  git pull origin "$BRANCH" --no-edit
  echo "Готово. Перезапуск: pm2 restart arka-flowers"
  exit 0
fi

# 3) Нет .git — аккуратно связать с origin (сохраняем локальные файлы до конфликта)
echo "Нет .git — инициализация и привязка к $ORIGIN_URL"
git init
git remote remove origin 2>/dev/null || true
git remote add origin "$ORIGIN_URL"
git fetch origin "$BRANCH"

# Пытаемся выставить ветку как у удалённой (может потребоваться слияние, если файлы отличаются)
if git checkout -B "$BRANCH" "origin/$BRANCH" 2>/dev/null; then
  echo "Ветка $BRANCH выставлена как origin/$BRANCH"
else
  echo "ВНИМАНИЕ: не удалось просто checkout — есть расхождения с удалённой веткой."
  echo "Варианты: вручную разрулить конфликты ИЛИ сохранить важные файлы и клонировать в новую папку."
  echo "Резерв .env (если был): $BACKUP_DIR"
  exit 1
fi

# 4) Вернуть .env из бэкапа, если checkout его затёр
if [[ -f "$BACKUP_DIR/.env" ]]; then
  cp -a "$BACKUP_DIR/.env" .env
  echo "Восстановлен .env из $BACKUP_DIR"
fi

echo ""
echo "=== Установите зависимости при необходимости: npm ci  (или npm install) ==="
echo "Потом: pm2 restart arka-flowers"
echo "Готово."
