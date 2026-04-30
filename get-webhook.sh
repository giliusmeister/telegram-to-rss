#!/usr/bin/env bash

set -e

set -a
source .env
set +a

if command -v jq >/dev/null 2>&1; then
  curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq .
else
  curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
  echo
fi
