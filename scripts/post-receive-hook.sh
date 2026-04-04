#!/bin/bash
# Установка на сервере (один раз, под root):
#   cp scripts/post-receive-hook.sh /var/git/arka-flowers.git/hooks/post-receive
#   chmod +x /var/git/arka-flowers.git/hooks/post-receive
#
# После каждого git push production main с ПК обновится /var/www/arka-flowers и перезапустится PM2.

TARGET="/var/www/arka-flowers"
GIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

while read -r oldrev newrev refname; do
  branch="${refname#refs/heads/}"
  if [ "$branch" = "main" ]; then
    echo "[post-receive] Deploy main -> $TARGET"
    git --work-tree="$TARGET" --git-dir="$GIT_DIR" checkout -f main
    cd "$TARGET" || exit 1
    npm install --production --no-audit --no-fund
    if pm2 describe arka-flowers >/dev/null 2>&1; then
      pm2 restart arka-flowers
    else
      pm2 start server.js --name arka-flowers --max-memory-restart 512M
      pm2 save
    fi
    echo "[post-receive] OK"
  fi
done
