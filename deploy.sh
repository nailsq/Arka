#!/bin/bash
# ============================================
# Arka Flowers - Deploy Script
# Run AFTER server-setup.sh and domain purchase
# Usage: bash deploy.sh yourdomain.com
# ============================================

set -e

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
  echo "Usage: bash deploy.sh yourdomain.com"
  exit 1
fi

echo "========================================"
echo "  Deploying Arka Flowers"
echo "  Domain: $DOMAIN"
echo "========================================"

APP_DIR="/var/www/arka-flowers"

# 1. Check .env exists
if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: $APP_DIR/.env not found!"
  echo "Copy .env.template to .env and fill in all values first."
  exit 1
fi

# 2. Update PUBLIC_URL in .env
echo "[1/6] Updating PUBLIC_URL..."
sed -i "s|PUBLIC_URL=.*|PUBLIC_URL=https://$DOMAIN|" "$APP_DIR/.env"
echo "  PUBLIC_URL=https://$DOMAIN"

# 3. Install dependencies
echo ""
echo "[2/6] Installing dependencies..."
cd "$APP_DIR"
npm install --production

# 4. Configure Nginx
echo ""
echo "[3/6] Configuring Nginx..."
cat > /etc/nginx/sites-available/arka-flowers << NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 10M;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/arka-flowers /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 5. SSL Certificate
echo ""
echo "[4/6] Getting SSL certificate..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN --redirect

# 6. Start with PM2
echo ""
echo "[5/6] Starting application..."
cd "$APP_DIR"
pm2 delete arka-flowers 2>/dev/null || true
pm2 start server.js --name arka-flowers --max-memory-restart 512M
pm2 save

# 7. Verify
echo ""
echo "[6/6] Verifying..."
sleep 3
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000)
if [ "$STATUS" = "200" ]; then
  echo "App is running! HTTP $STATUS"
else
  echo "WARNING: Got HTTP $STATUS, check pm2 logs arka-flowers"
fi

echo ""
echo "========================================"
echo "  Deployment complete!"
echo "========================================"
echo ""
echo "Your app: https://$DOMAIN"
echo ""
echo "IMPORTANT - Set webhook for Telegram bot:"
echo "  curl https://api.telegram.org/bot\$(grep BOT_TOKEN .env | cut -d= -f2)/setWebhook?url=https://$DOMAIN/webhook"
echo ""
echo "Useful commands:"
echo "  pm2 logs arka-flowers    - view logs"
echo "  pm2 restart arka-flowers - restart app"
echo "  pm2 status               - check status"
echo ""
