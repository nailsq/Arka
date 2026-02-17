# ARKA STUDIO FLOWERS - Telegram Mini App v2

## Quick Start

Open **cmd.exe** in the project folder and run:

```
del arka.db
npm install
node seed.js
node server.js
```

Or double-click `setup.bat` for automatic setup and launch.

**App:** http://localhost:3000
**Admin:** http://localhost:3000/admin (login: admin / admin123)

## Configuration (.env)

```
PORT=3000
ADMIN_LOGIN=admin
ADMIN_PASSWORD=admin123
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
PAYMENT_PROVIDER=test
PUBLIC_URL=http://localhost:3000
```

Set `BOT_TOKEN` to your Telegram bot token for initData validation.
Set `PAYMENT_PROVIDER` to `yookassa` or `tinkoff` and fill in the corresponding keys for real payment processing.

## Project Structure

```
arka-flowers/
  .env                - Configuration
  server.js           - Express backend with all API endpoints
  database.js         - SQLite schema (users, categories, products, orders, settings)
  seed.js             - Test data seeder
  package.json        - Dependencies
  public/
    index.html        - Client SPA shell
    style.css         - Black-and-white minimalist styles
    app.js            - Client logic (Telegram, catalog, cart, delivery, payment, account)
    admin.html        - Admin panel shell
    admin.css         - Admin panel styles
    admin.js          - Admin panel logic (orders, products, categories, settings)
    images/
      logo.png        - Replace with actual logo
```

## API Endpoints

### Public
- GET  /api/categories
- GET  /api/products?category_id=
- GET  /api/products/:id
- GET  /api/settings
- POST /api/auth/telegram
- POST /api/user/update
- GET  /api/user/orders?telegram_id=
- POST /api/orders
- POST /api/payments/create
- POST /api/payments/webhook

### Admin (requires X-Admin-Token header)
- POST /api/admin/login
- POST /api/admin/logout
- GET  /api/admin/orders?status=
- POST /api/admin/orders/:id/status
- GET/POST        /api/admin/categories
- PUT/DELETE      /api/admin/categories/:id
- GET/POST        /api/admin/products
- PUT/DELETE      /api/admin/products/:id
- GET/POST        /api/admin/settings

## Telegram Integration

1. Create a bot via @BotFather
2. Create a Web App via @BotFather -> /newapp
3. Set the Web App URL to your public server URL
4. Put the bot token in .env as BOT_TOKEN
5. Users open the app via t.me/your_bot/app_name

## Payment

Test mode: clicking "Pay" opens a test confirmation page that marks the order as paid.
For production: configure YooKassa or Tinkoff credentials in .env and implement the actual API calls in server.js payment section.
