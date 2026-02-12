import { getOrRefreshNews } from '../lib/news-cache.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = await getOrRefreshNews();
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      error: 'Haberler alınamadı.',
      details: error.message,
    });
  }
}
