import { getOrRefreshNews } from '../../lib/news-cache.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = await getOrRefreshNews({ force: true });
    return res.status(200).json({
      ok: true,
      updatedAt: payload.lastFetched,
      articleCount: payload.articles?.length || 0,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
