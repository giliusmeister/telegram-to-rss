import { createHmac } from 'crypto';
import { type Context, Telegraf, Telegram } from 'telegraf';
import type { RequestHandler } from 'express';
import type { Message, PhotoSize, Update } from 'telegraf/typings/core/types/typegram';

import * as Feed from './feed';

const CHAT_ID = process.env.GROUP_ID;
const CHAT_NAME = process.env.GROUP_USERNAME;
const WEBSITE_HOST = process.env.WEBSITE_HOST;
const TITLE_MAX_LENGTH = 140;

const isTruthy = (value?: string) => ['1', 'true', 'yes', 'on'].includes((value || '').trim().toLowerCase());

const INCLUDE_SOURCE_LINK = isTruthy(process.env.RSS_INCLUDE_SOURCE_LINK);
const RSS_LANGUAGE = (process.env.RSS_LANGUAGE || 'en').toLowerCase();
const SOURCE_LINK_LABEL = RSS_LANGUAGE.indexOf('ru') === 0 ? 'Ссылка на источник' : 'Link to Source';

const Bot = new Telegraf(process.env.BOT_TOKEN);
const TelegramClient = new Telegram(process.env.BOT_TOKEN);

type TelegramPostMessage = Update.New & (Message.TextMessage | Message.PhotoMessage);
type TelegramPostMessageWithForward = TelegramPostMessage & {
  chat?: {
    id?: number;
    type?: string;
    username?: string;
  };
  from?: {
    first_name?: string;
  };
  forward_from_chat?: {
    id?: number;
    username?: string;
  };
  forward_from_message_id?: number;
  is_automatic_forward?: boolean;
};

const formatDate = (date: Date) =>
  date.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });

const normalizeTelegramUsername = (username?: string) =>
  (username || '')
    .trim()
    .replace(/^(https?:\/\/)?t\.me\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '');

const normalizeWebhookPath = (path?: string) => {
  if (!path) return null;

  const normalizedPath = path.trim();

  if (!normalizedPath) return null;

  return normalizedPath.indexOf('/') === 0 ? normalizedPath : `/${normalizedPath}`;
};

const getWebhookPath = () => normalizeWebhookPath(process.env.TELEGRAM_WEBHOOK_PATH);

const getWebhookURL = () => {
  const webhookPath = getWebhookPath();

  if (!webhookPath) return null;

  return `${WEBSITE_HOST.replace(/\/+$/, '')}${webhookPath}`;
};

const getContextPost = (ctx: Context) =>
  (ctx as Context & { message?: TelegramPostMessage; channelPost?: TelegramPostMessage }).message ||
  (ctx as Context & { message?: TelegramPostMessage; channelPost?: TelegramPostMessage }).channelPost;

const isConfiguredChat = (ctx: Context) => {
  if (!ctx.chat) return false;

  return (
    ctx.chat.id === +CHAT_ID ||
    normalizeTelegramUsername('username' in ctx.chat ? ctx.chat.username : undefined) ===
      normalizeTelegramUsername(CHAT_NAME)
  );
};

const isTelegramChannelPost = (message: TelegramPostMessage) => {
  const forwardedMessage = message as TelegramPostMessageWithForward;
  const forwardedUsername = normalizeTelegramUsername(
    forwardedMessage.forward_from_chat && forwardedMessage.forward_from_chat.username,
  );
  const directChannelUsername = normalizeTelegramUsername(
    forwardedMessage.chat && forwardedMessage.chat.username,
  );
  const configuredUsername = normalizeTelegramUsername(CHAT_NAME);
  const isDirectChannelPost =
    forwardedMessage.chat &&
    forwardedMessage.chat.type === 'channel' &&
    (directChannelUsername === configuredUsername || forwardedMessage.chat.id === +CHAT_ID);

  return (
    forwardedMessage.is_automatic_forward === true ||
    (forwardedMessage.from && forwardedMessage.from.first_name === 'Telegram') ||
    (forwardedUsername.length > 0 && forwardedUsername === configuredUsername) ||
    isDirectChannelPost
  );
};

const withValidation = <T extends Context>(
  ctx: T,
  cb: (ctx: T) => any,
) => {
  const post = getContextPost(ctx);

  if (
    !post ||
    !isConfiguredChat(ctx) ||
    ctx.chat.type === 'private' ||
    !isTelegramChannelPost(post)
  )
    return;

  return cb(ctx);
};

const getImageURL = async (photos: PhotoSize[]): Promise<string> => {
  const photoMeta = photos[photos.length - 1];
  const photoData = await TelegramClient.getFileLink(photoMeta.file_id);

  return photoData.toString();
};

const getFallbackTitle = (date: Date) => `${formatDate(date)} on ${CHAT_NAME}`;

const truncateTitle = (title: string) => {
  const normalizedTitle = title.replace(/\s+/g, ' ').trim();

  if (normalizedTitle.length <= TITLE_MAX_LENGTH) return normalizedTitle;

  return `${normalizedTitle.slice(0, TITLE_MAX_LENGTH - 3).trim()}...`;
};

const parseNews = (text: string, fallbackTitle: string) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    return {
      description: '',
      title: fallbackTitle,
    };
  }

  return {
    description: lines.length > 1 ? lines.slice(1).join('\n\n') : lines[0],
    title: truncateTitle(lines[0]),
  };
};

const getMessageText = (message: TelegramPostMessage) =>
  'text' in message ? message.text : message.caption || '';

const getTelegramPostIdentity = (message: any) => {
  const username = normalizeTelegramUsername(
    message.forward_from_chat?.username || message.chat?.username || process.env.GROUP_USERNAME,
  );
  const chatId = message.forward_from_chat?.id || message.chat?.id || process.env.GROUP_ID || username;
  const messageId = message.forward_from_message_id || message.message_id;

  return {
    messageId,
    sourceKey: `telegram:${chatId}:${messageId}`,
    username,
  };
};

const getTelegramPermalink = (message: any) => {
  const { messageId, username } = getTelegramPostIdentity(message);

  return `https://t.me/${username}/${messageId}`;
};

const getTelegramGuid = (message: any) => {
  const guidSecret =
    process.env.RSS_GUID_SECRET || process.env.BOT_TOKEN || process.env.GROUP_USERNAME || 'telegram-to-rss';
  const { sourceKey } = getTelegramPostIdentity(message);
  const digest = createHmac('sha256', guidSecret).update(sourceKey).digest('hex');

  return `telegram:${digest}`;
};

const buildDescription = (description: string, sourceUrl: string, imageUrl?: string) => {
  const parts = [description.trim(), imageUrl];

  if (INCLUDE_SOURCE_LINK) parts.push(`${SOURCE_LINK_LABEL}: <a href="${sourceUrl}">${sourceUrl}</a>`);

  return parts.filter((part) => Boolean(part)).join('\n\n');
};

const addMessageToFeed = async (message: TelegramPostMessage, imageUrl?: string) => {
  const date = new Date(message.date * 1000);
  const url = getTelegramPermalink(message);
  const parsedNews = parseNews(getMessageText(message), getFallbackTitle(date));

  await Feed.addItem({
    url,
    guid: getTelegramGuid(message),
    date,
    description: buildDescription(parsedNews.description, url, imageUrl),
    title: parsedNews.title,
  });
};

const getWebhookCallback = (): RequestHandler | null => {
  const webhookPath = getWebhookPath();

  if (!webhookPath) return null;

  return Bot.webhookCallback('/', {
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN,
  }) as RequestHandler;
};

const launch = async () => {
  const webhookURL = getWebhookURL();

  console.log('[TELEGRAM] RSS_INCLUDE_SOURCE_LINK:', INCLUDE_SOURCE_LINK);
  console.log('[TELEGRAM] RSS_LANGUAGE:', RSS_LANGUAGE);
  console.log('[TELEGRAM] SOURCE_LINK_LABEL:', SOURCE_LINK_LABEL);

  if (!webhookURL) {
    await Bot.launch();
    console.log('[TELEGRAM] Bot launched with long polling');
    return;
  }

  const webhookOptions = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN
    ? { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN }
    : {};

  await Bot.telegram.setWebhook(webhookURL, webhookOptions);
  console.log('[TELEGRAM] Webhook configured at', webhookURL);
};

Bot.use((ctx: any, next) => {
  const post = ctx.update.channel_post;

  if (post?.text || post?.photo) {
    if (String(post.chat.id) !== String(process.env.GROUP_ID)) {
      console.log('[TELEGRAM] ignored channel_post by GROUP_ID', {
        got: post.chat.id,
        expected: process.env.GROUP_ID,
      });
      return;
    }

    return addMessageToFeed(post);
  }

  return next();
});

Bot.on('text', (ctx: any) => {
  const message = ctx.message || ctx.channelPost;

  return withValidation(ctx, () => addMessageToFeed(message));
});

Bot.on('photo', (ctx) =>
  withValidation(ctx, async () => {
    const message = ctx.message || ctx.channelPost;
    const imageUrl = await getImageURL(message.photo);

    await addMessageToFeed(message, imageUrl);
  }),
);

export default {
  getWebhookCallback,
  launch,
};
