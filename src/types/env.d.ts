declare namespace NodeJS {
  interface ProcessEnv {
    // Telegram
    GROUP_ID: string;
    BOT_TOKEN: string;
    GROUP_USERNAME: string;
    TELEGRAM_WEBHOOK_PATH?: string;
    TELEGRAM_WEBHOOK_SECRET_TOKEN?: string;

    // RSS
    AUTHOR: string;
    WEBSITE_HOST: string;
    RSS_ITEM_LIMIT?: string;

    // Server
    PORT: string;
    NODE_ENV: 'dev' | 'test' | 'prod';
  }
}
