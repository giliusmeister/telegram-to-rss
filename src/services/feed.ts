import Feed from 'rss';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';

const RSS_FILE_PATH = 'public/rss.xml';
const RSS_ITEMS_FILE_PATH = process.env.RSS_ITEMS_FILE_PATH || 'data/rss-items.json';
const DEFAULT_ITEM_LIMIT = 50;
const DEFAULT_RSS_LANGUAGE = 'en';

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
    language: process.env.RSS_LANGUAGE || DEFAULT_RSS_LANGUAGE,
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
let isInitialized = false;
let writeQueue: Promise<void> = Promise.resolve();

const applyItemLimit = () => {
  const itemLimit = getItemLimit();

  if (itemLimit > 0) items.splice(itemLimit);
};

const loadItems = async () => {
  if (isInitialized) return;

  try {
    const persistedItems = JSON.parse(await readFile(RSS_ITEMS_FILE_PATH, 'utf-8')) as FeedItem[];

    if (!Array.isArray(persistedItems)) throw new Error('Persisted feed items must be an array');

    items.splice(0, items.length);
    persistedItems.forEach((item) => items.push(item));
    applyItemLimit();
    console.log('[FEED] Loaded Persisted Feed Items', items.length);
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;

    console.log('[FEED] No persisted feed items found');
  }

  isInitialized = true;
};

const writeItems = async () => {
  await mkdir(dirname(RSS_ITEMS_FILE_PATH), { recursive: true });
  await writeFile(RSS_ITEMS_FILE_PATH, JSON.stringify(items, null, 2), { flag: 'w+' });
};

const writeFeed = async () => {
  await mkdir(dirname(RSS_FILE_PATH), { recursive: true });

  const feed = createFeed();

  items.forEach((feedItem) => feed.item(feedItem));

  await writeFile(RSS_FILE_PATH, feed.xml(), { flag: 'w+' });
};

export const initialize = async () => {
  await loadItems();
  await writeFeed();
};

const addItemUnsafe = async (item: FeedItem) => {
  await loadItems();

  const isDuplicate = items.some(
    (feedItem) => (item.guid && feedItem.guid === item.guid) || (!item.guid && feedItem.url === item.url),
  );

  if (isDuplicate) {
    console.log('[FEED] Skipping Duplicate Feed Item', {
      guid: item.guid,
      title: item.title,
      url: item.url,
    });
    return;
  }

  console.log('[FEED] Adding New Feed Item', item);

  items.unshift(item);
  applyItemLimit();

  await writeItems();
  await writeFeed();
};

export const addItem = async (item: FeedItem) => {
  writeQueue = writeQueue.then(() => addItemUnsafe(item), () => addItemUnsafe(item));

  return writeQueue;
};
