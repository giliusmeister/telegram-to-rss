import './config/dotenv';

import Telegram from './services/telegram';
import * as Server from './services/server';

const telegramWebhook = Telegram.getWebhookCallback();

if (telegramWebhook) {
  Server.use(telegramWebhook);
}

Server.launch();
Telegram.launch();
