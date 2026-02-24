#!/bin/bash
# ============================================
# Arka Flowers - Server Setup Script
# Run on Timeweb VPS (Ubuntu 22.04)
# ============================================

set -e

echo "========================================"
echo "  Arka Flowers - Server Setup"
echo "========================================"

# 1. Update system
echo ""
echo "[1/8] Updating system..."
apt update && apt upgrade -y

# 2. Install Node.js 18
echo ""
echo "[2/8] Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# 3. Install Nginx
echo ""
echo "[3/8] Installing Nginx..."
apt install -y nginx
systemctl enable nginx
systemctl start nginx

# 4. Install PM2
echo ""
echo "[4/8] Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root

# 5. Install Certbot (SSL)
echo ""
echo "[5/8] Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# 6. Install Git
echo ""
echo "[6/8] Installing Git..."
apt install -y git

# 7. Create app directory
echo ""
echo "[7/8] Creating app directory..."
mkdir -p /var/www/arka-flowers
cd /var/www/arka-flowers

# 8. Firewall
echo ""
echo "[8/8] Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "========================================"
echo "  Setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Upload your app to /var/www/arka-flowers/"
echo "2. Create .env file with your variables"
echo "3. Run: cd /var/www/arka-flowers && npm install"
echo "4. Configure Nginx (see nginx-arka.conf)"
echo "5. Get SSL certificate"
echo "6. Start app with PM2"
echo ""
