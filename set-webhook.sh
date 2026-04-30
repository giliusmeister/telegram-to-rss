#!/usr/bin/env bash

set -e

# загружаем .env
set -a
source .env
set +a

WEBHOOK_URL="${WEBSITE_HOST}${TELEGRAM_WEBHOOK_PATH}"

echo "Setting webhook to:"
echo "$WEBHOOK_URL"

curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${WEBHOOK_URL}" \
  ${TELEGRAM_WEBHOOK_SECRET_TOKEN:+-d "secret_token=${TELEGRAM_WEBHOOK_SECRET_TOKEN}"}

echo
echo "Done."
