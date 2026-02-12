const BLOB_BASE_URL = 'https://blob.vercel-storage.com';
const BLOB_FILENAME = 'news_cache.json';
const COLLECT_API_URL = 'https://api.collectapi.com/news/getNews?country=tr&tag=general';

export const FETCH_INTERVAL_MS = (24 * 60 * 60 * 1000) / 5;

const getBlobHeaders = () => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN tanımlı değil.');
  }

  return {
    Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
    'x-api-version': '7',
  };
};

const getCollectApiHeaders = () => {
  if (!process.env.COLLECT_API_TOKEN) {
    throw new Error('COLLECT_API_TOKEN tanımlı değil.');
  }

  return {
    'content-type': 'application/json',
    authorization: `apikey ${process.env.COLLECT_API_TOKEN}`,
  };
};

export const getLatestNewsFromBlob = async () => {
  const listResponse = await fetch(`${BLOB_BASE_URL}?prefix=${BLOB_FILENAME}`, {
    headers: getBlobHeaders(),
    cache: 'no-store',
  });

  if (!listResponse.ok) {
    throw new Error(`Blob list hatası: ${listResponse.status}`);
  }

  const listData = await listResponse.json();
  const firstBlob = listData?.blobs?.[0];
  if (!firstBlob?.url) {
    return null;
  }

  const blobResponse = await fetch(firstBlob.url, { cache: 'no-store' });
  if (!blobResponse.ok) {
    throw new Error(`Blob okuma hatası: ${blobResponse.status}`);
  }

  return blobResponse.json();
};

export const fetchNewsFromCollectApi = async () => {
  const response = await fetch(COLLECT_API_URL, {
    method: 'GET',
    headers: getCollectApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`CollectAPI hatası: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.success || !Array.isArray(data?.result)) {
    throw new Error('CollectAPI yanıtı beklenen formatta değil.');
  }

  const payload = {
    articles: data.result.slice(0, 15),
    lastFetched: Date.now(),
  };

  const putResponse = await fetch(`${BLOB_BASE_URL}/${BLOB_FILENAME}`, {
    method: 'PUT',
    headers: {
      ...getBlobHeaders(),
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!putResponse.ok) {
    throw new Error(`Blob yazma hatası: ${putResponse.status}`);
  }

  return payload;
};

export const getOrRefreshNews = async ({ force = false } = {}) => {
  const cached = await getLatestNewsFromBlob().catch(() => null);
  const now = Date.now();

  if (!force && cached?.lastFetched && now - cached.lastFetched < FETCH_INTERVAL_MS) {
    return { ...cached, source: 'blob-cache' };
  }

  const fresh = await fetchNewsFromCollectApi();
  return { ...fresh, source: 'collectapi' };
};
