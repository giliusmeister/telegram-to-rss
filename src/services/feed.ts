import Feed from 'rss';
import { writeFile } from 'fs/promises';

const RSS_FILE_PATH = 'public/rss.xml';
const DEFAULT_ITEM_LIMIT = 50;

const { AUTHOR, WEBSITE_HOST, GROUP_USERNAME } = process.env;
const PUBLIC_WEBSITE_URL = WEBSITE_HOST.replace(/\/+$/, '');
const FEED_URL = `${PUBLIC_WEBSITE_URL}/rss.xml`;

const getItemLimit = () => {
  if (!process.env.RSS_ITEM_LIMIT) return DEFAULT_ITEM_LIMIT;

  const limit = Number(process.env.RSS_ITEM_LIMIT);

  if (!isFinite(limit) || limit < 0) return DEFAULT_ITEM_LIMIT;

  return Math.floor(limit);
};

const createFeed = () => {
  const now = new Date();

  return new Feed({
    language: 'en',
    webMaster: AUTHOR,
    feed_url: FEED_URL,
    copyright: `${now.getFullYear()}: ${AUTHOR}`,
    site_url: PUBLIC_WEBSITE_URL,
    managingEditor: AUTHOR,
    title: `${GROUP_USERNAME} RSS`,
    pubDate: now.toLocaleString('en'),
    description: `RSS Feed for Telegram channel: ${GROUP_USERNAME}`,
  });
};

type FeedItem = Parameters<ReturnType<typeof createFeed>['item']>[0];

const items: FeedItem[] = [];

export const addItem = async (item: FeedItem) => {
  console.log('[FEED] Adding New Feed Item', item);

  items.unshift(item);

  const itemLimit = getItemLimit();

  if (itemLimit > 0) items.splice(itemLimit);

  const feed = createFeed();

  items.forEach((feedItem) => feed.item(feedItem));

  await writeFile(RSS_FILE_PATH, feed.xml(), { flag: 'w+' });
};
