# Telegram To RSS
Generate an RSS feed from your Telegram Channel.

![Banner image](./banner.png)

# Why did I make this?
I run a personal website and want it to be a centralized place where I can have everything I ever published on the web. I also don't want to have a telegram integration on that website and prefer having a unified way of accessing my web artifacts.

With this project I can turn my Telegram channel posts into an RSS feed and parse it on my personal website.

# How does it work?
This Project is consisted of two distinct services:
  - Telegram Bot Handler
  - Express File Server

## Telegram Bot Handler

This service listens to messages on the [discussion group chat](https://core.telegram.org/api/discussion) of your channel.

When you post a message on your channel, Telegram will automatically forward the message to the corresponding discussion group, then the bot will process the message and update the RSS feed accordingly.

The app can receive Telegram updates through a webhook when `TELEGRAM_WEBHOOK_PATH` is configured. If it is not configured, the bot falls back to long polling, which is convenient for local testing.

## Express File Server

When the Bot Handler receives the message and updates the RSS Feed, it writes an `rss.xml` file in the `public/` directory which is served by the express static file server.

Thus you can access the RSS feed via: `<SERVER_URL>/rss.xml`.

# Getting Started
In order to use this project, you need:
  - Telegram Bot
    - Create one with [`BotFather`](https://core.telegram.org/bots#6-botfather)
    - Disable group privacy mode
    - Copy the API KEY
  - Telegram Channel
    - After creating the channel, create a discussion group.
    - Add the newly created bot account to the discussion group.

Afterwards, clone the project and install the dependencies:

```sh
git clone https://github.com/giliusmeister/telegram-to-rss.git
```

```sh
cd telegram-to-rss
```

```sh
npm install
```

## Telegram Bot Setup

Create and configure the bot before deploying the app:

1. Open [`@BotFather`](https://t.me/BotFather) in Telegram.
2. Run `/newbot`, choose a name and username, then copy the token into `BOT_TOKEN`.
3. Run `/setprivacy`, choose the new bot, then choose `Disable` so the bot can read messages in the linked discussion group.
4. Create a Telegram channel and set a public channel username. Use that username without `@` as `GROUP_USERNAME`.
5. Create or link a discussion group for the channel in the channel settings.
6. Add the bot to the linked discussion group. Member permissions are enough when privacy mode is disabled, but admin permissions are also fine.
7. Publish a test post in the channel so Telegram forwards it to the discussion group.
8. Get the discussion group ID before enabling webhook mode:

```sh
BOT_TOKEN=123456789:telegram-bot-token
curl "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates"
```

Find `message.chat.id` in the response and use it as `GROUP_ID`. It usually looks like `-1001234567890`.

If `getUpdates` returns an error about an active webhook, delete the existing webhook first:

```sh
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true"
```

## Telegram Webhook

Webhook mode is recommended for a server deployment. Set `TELEGRAM_WEBHOOK_PATH` in `.env`, and the app will register the webhook automatically on startup using `WEBSITE_HOST + TELEGRAM_WEBHOOK_PATH`.

Example:

```env
WEBSITE_HOST=https://rss.example.com
TELEGRAM_WEBHOOK_PATH=/telegram/webhook/replace-with-random-path
TELEGRAM_WEBHOOK_SECRET_TOKEN=replace-with-random-secret
```

Generate secret values on the server:

```sh
openssl rand -hex 24
```

Check the active Telegram webhook after the service starts:

```sh
BOT_TOKEN=123456789:telegram-bot-token
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

Check the app heartbeat on the webhook path:

```sh
WEBHOOK_PATH=/telegram/webhook/replace-with-random-path
curl -i "http://127.0.0.1:4444${WEBHOOK_PATH}"
```

Smoke-test the local webhook endpoint from the server. If `TELEGRAM_WEBHOOK_SECRET_TOKEN` is set, include the same value in `X-Telegram-Bot-Api-Secret-Token`; otherwise Telegraf rejects the request and Express returns `404`.

```sh
WEBHOOK_PATH=/telegram/webhook/replace-with-random-path
WEBHOOK_SECRET=replace-with-random-secret

curl -i -X POST "http://127.0.0.1:4444${WEBHOOK_PATH}" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: ${WEBHOOK_SECRET}" \
  -d '{
    "update_id": 1,
    "message": {
      "message_id": 10,
      "from": { "id": 777000, "is_bot": false, "first_name": "Telegram" },
      "chat": { "id": -1001234567890, "type": "supergroup", "title": "Discussion" },
      "date": 1777548641,
      "is_automatic_forward": true,
      "forward_from_chat": { "id": -1009876543210, "type": "channel", "username": "my_channel" },
      "forward_from_message_id": 2,
      "text": "Test title\nTest body"
    }
  }'
```

For local development, omit `TELEGRAM_WEBHOOK_PATH`; the bot will use long polling.

## Configuration
Follow the `.env.example` file to setup your environment.

_Note: You need to create separate `.env.{NODE_ENV}` files for each environment(i.e. `.env.dev` will be used when testing locally)_

|Name|Type|Description|
|---|---|---|
|PORT|Number|File Server Port|
|GROUP_ID|String|Linked discussion group chat ID, usually starts with `-100`|
|BOT_TOKEN|String|Your Bot's API key|
|GROUP_USERNAME|String|Your Channel Username|
|TELEGRAM_WEBHOOK_PATH|String|Optional public webhook path; enables webhook mode when set|
|TELEGRAM_WEBHOOK_SECRET_TOKEN|String|Optional Telegram webhook secret token|
|AUTHOR|String|RSS Feed Author Name|
|WEBSITE_HOST|String|Public URL of the RSS feed host, for example `https://rss.example.com`|
|RSS_ITEM_LIMIT|Number|Maximum RSS items to keep, defaults to `50`; use `0` to disable the limit|

## Ubuntu Server Deployment

The example below assumes:

- the app will live in `/opt/telegram-to-rss`
- the app will run as the `telegram-rss` system user
- Express will listen only behind nginx on port `4444`
- nginx will expose the public feed at `https://rss.example.com/rss.xml`

Install system packages and Node.js 18 or newer:

```sh
sudo apt update
sudo apt install -y git nginx curl

# Example: install Node.js 20 from NodeSource.
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node -v
npm -v
```

Create a dedicated user and deploy the project:

```sh
sudo useradd --system --create-home --shell /usr/sbin/nologin telegram-rss
sudo mkdir -p /opt/telegram-to-rss
sudo chown telegram-rss:telegram-rss /opt/telegram-to-rss

sudo -u telegram-rss git clone https://github.com/giliusmeister/telegram-to-rss.git /opt/telegram-to-rss
cd /opt/telegram-to-rss

sudo -u telegram-rss npm install
sudo -u telegram-rss npm run build
sudo -u telegram-rss npm prune --omit=dev
```

Create `/opt/telegram-to-rss/.env`:

```env
NODE_ENV=prod
PORT=4444
GROUP_ID=-1001234567890
BOT_TOKEN=123456789:telegram-bot-token
GROUP_USERNAME=my_channel
TELEGRAM_WEBHOOK_PATH=/telegram/webhook/replace-with-random-path
TELEGRAM_WEBHOOK_SECRET_TOKEN=replace-with-random-secret

AUTHOR=Your Name
WEBSITE_HOST=https://rss.example.com
RSS_ITEM_LIMIT=50
```

Create `/etc/systemd/system/telegram-to-rss.service`:

```ini
[Unit]
Description=Telegram to RSS
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=telegram-rss
Group=telegram-rss
WorkingDirectory=/opt/telegram-to-rss
Environment=NODE_ENV=prod
ExecStart=/usr/bin/node dist/entry.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now telegram-to-rss
sudo systemctl status telegram-to-rss
```

Useful service commands:

```sh
sudo journalctl -u telegram-to-rss -f
sudo systemctl restart telegram-to-rss
```

Example nginx config for `/etc/nginx/sites-available/telegram-to-rss`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name rss.example.com;

    location /telegram/webhook/ {
        proxy_pass http://127.0.0.1:4444;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /rss.xml {
        proxy_pass http://127.0.0.1:4444/rss.xml;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        return 404;
    }
}
```

Enable nginx config:

```sh
sudo ln -s /etc/nginx/sites-available/telegram-to-rss /etc/nginx/sites-enabled/telegram-to-rss
sudo nginx -t
sudo systemctl reload nginx
```

If you use Let's Encrypt, install Certbot and issue a certificate after DNS points to the server:

```sh
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d rss.example.com
```

Deploy updates:

```sh
cd /opt/telegram-to-rss
sudo -u telegram-rss git pull
sudo -u telegram-rss npm install
sudo -u telegram-rss npm run build
sudo -u telegram-rss npm prune --omit=dev
sudo systemctl restart telegram-to-rss
```

## Available Scripts

- `npm start` - starts the project.
- `npm run watch` - starts `nodemon` development server.
- `npm run build` - builds the TypeScript project.

## TODOs

- [x] Make RSS feed metadata configurable
- [ ] Persist the auto-generated RSS Feed so stopping/restarting the process does not override it.
- [ ] Make Feed generation configurable(Currently only the messages from the Channel admin are allowed, but some may want to also include discussion messages from other members(i.e. replies)).
