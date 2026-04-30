import './config/dotenv';

import Telegram from './services/telegram';
import * as Feed from './services/feed';
import * as Server from './services/server';

const launch = async () => {
  await Feed.initialize();

  const telegramWebhook = Telegram.getWebhookCallback();

  if (telegramWebhook) {
    Server.get(process.env.TELEGRAM_WEBHOOK_PATH!, (_req, res) => {
      res.status(200).json({ ok: true, service: 'telegram-to-rss' });
    });
    Server.use(process.env.TELEGRAM_WEBHOOK_PATH!, telegramWebhook);
  }

  Server.launch();
  await Telegram.launch();
};

launch().catch((error) => {
  console.error('[ENTRY] Failed to launch application', error);
  process.exit(1);
});
