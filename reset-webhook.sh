#!/usr/bin/env bash

set -e

set -a
source .env
set +a

curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true"
echo

./set-webhook.sh
./get-webhook.sh
