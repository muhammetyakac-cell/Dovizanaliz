import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, RefreshCw, Calculator, Newspaper, Globe, 
  BarChart3, ChevronRight, Activity, Cloud, ExternalLink, 
  Database, AlertCircle 
} from 'lucide-react';

const REFRESH_MS = 15000; 
const FETCH_INTERVAL_MS = (24 * 60 * 60 * 1000) / 5;

// API Token'ları Vercel Environment Variables'dan gelir
const BLOB_RW_TOKEN = import.meta.env.VITE_BLOB_READ_WRITE_TOKEN;
const COLLECT_TOKEN = import.meta.env.VITE_COLLECT_API_TOKEN;
const BLOB_BASE_URL = "[https://blob.vercel-storage.com](https://blob.vercel-storage.com)";

const ASSETS = [
  { code: 'USD', name: 'Amerikan Doları', tvSymbol: 'FX:USDTRY', type: 'currency' },
  { code: 'EUR', name: 'Euro', tvSymbol: 'FX:EURTRY', type: 'currency' },
  { code: 'GBP', name: 'İngiliz Sterlini', tvSymbol: 'FX:GBPTRY', type: 'currency' },
  { code: 'XAU', name: 'Altın (Ons)', tvSymbol: 'OANDA:XAUUSD', type: 'commodity' },
  { code: 'XAG', name: 'Gümüş (Ons)', tvSymbol: 'OANDA:XAGUSD', type: 'commodity' },
];

const Sparkline = ({ data, color = "#2563eb" }) => {
  if (!data || data.length === 0) return null;
  const width = 100; const height = 30;
  const values = data.map(d => d.value);
  const min = Math.min(...values); const max = Math.max(...values);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
};

export default function App() {
  const [rates, setRates] = useState({});
  const [commodities, setCommodities] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [lastNewsFetch, setLastNewsFetch] = useState(null);
  const [calcAmount, setCalcAmount] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [errorStatus, setErrorStatus] = useState({ fx: false, commodity: false, news: false });

  const fetchWithRetry = async (url, options, retries = 3) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (retries > 0) return fetchWithRetry(url, options, retries - 1);
      throw err;
    }
  };

  const syncNews = async () => {
    if (!BLOB_RW_TOKEN || !COLLECT_TOKEN) return;
    const now = Date.now();
    try {
      // Önbelleği oku
      const listUrl = `${BLOB_BASE_URL}?prefix=news_cache.json`;
      const proxyListUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(listUrl)}`;
      const listRes = await fetch(proxyListUrl, { headers: { 'Authorization': `Bearer ${BLOB_RW_TOKEN}`, 'x-api-version': '7' } });
      const listData = await listRes.json();
      
      if (listData?.blobs?.length > 0) {
        const cached = await (await fetch(listData.blobs[0].url)).json();
        setNews(cached.articles || []);
        setLastNewsFetch(cached.lastFetched || null);
        if (cached.lastFetched && (now - cached.lastFetched < FETCH_INTERVAL_MS)) return;
      }

      // API'den çek
      const apiUrl = "[https://api.collectapi.com/news/getNews?country=tr&tag=general](https://api.collectapi.com/news/getNews?country=tr&tag=general)";
      const proxyApiUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
      const data = await fetchWithRetry(proxyApiUrl, { headers: { "authorization": `apikey ${COLLECT_TOKEN}` } });

      if (data?.success && data?.result) {
        const payload = { articles: data.result.slice(0, 15), lastFetched: now };
        await fetch(`${BLOB_BASE_URL}/news_cache.json`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${BLOB_RW_TOKEN}`, 'x-api-version': '7', 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setNews(payload.articles);
        setLastNewsFetch(now);
      }
    } catch (e) {
      console.error("Haber senkronizasyon hatası:", e);
      setErrorStatus(prev => ({ ...prev, news: true }));
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const fxData = await fetchWithRetry(`https://api.frankfurter.app/latest?base=TRY&symbols=USD,EUR,GBP,CHF`);
      const formattedRates = {};
      Object.keys(fxData.rates).forEach(key => {
        formattedRates[key] = { value: 1 / fxData.rates[key], sparkline: Array.from({ length: 12 }, () => ({ value: Math.random() * 100 })) };
      });
      setRates(formattedRates);
    } catch (e) { setErrorStatus(prev => ({ ...prev, fx: true })); }

    try {
      const symbols = encodeURIComponent('XAUUSD=X,XAGUSD=X');
      const commodityData = await fetchWithRetry(`https://api.allorigins.win/raw?url=${encodeURIComponent(`[https://query1.finance.yahoo.com/v7/finance/quote?symbols=$](https://query1.finance.yahoo.com/v7/finance/quote?symbols=$){symbols}`)}`);
      if (commodityData?.quoteResponse?.result) {
        setCommodities(commodityData.quoteResponse.result.map(item => ({
          symbol: item.symbol, price: item.regularMarketPrice || 0, change: item.regularMarketChangePercent || 0,
          sparkline: Array.from({ length: 12 }, () => ({ value: Math.random() * 100 })), 
          name: item.symbol === 'XAUUSD=X' ? 'Altın (Ons)' : 'Gümüş (Ons)', code: item.symbol === 'XAUUSD=X' ? 'XAU' : 'XAG'
        })));
      }
    } catch (e) { setErrorStatus(prev => ({ ...prev, commodity: true })); }

    await syncNews();
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const containerId = "tv_chart_container";
    const container = document.getElementById(containerId);
    if (!container || !window.TradingView) return;
    container.innerHTML = "";
    new window.TradingView.MediumWidget({
      "symbols": [[selectedAsset.name, selectedAsset.tvSymbol]],
      "chartOnly": false, "width": "100%", "height": 400, "locale": "tr",
      "colorTheme": "light", "gridLineColor": "rgba(240, 243, 250, 0)",
      "container_id": containerId
    });
  }, [selectedAsset, lastUpdate]);

  const formatMoney = (val, dec = 2) => {
    if (val === undefined || val === null || isNaN(val)) return "0,00";
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-12">
      {/* Ticker ve Header buraya gelecek (v4.2 kodundaki gibi) */}
      <div className="bg-white border-b border-slate-200 py-1 sticky top-0 z-50 overflow-hidden shadow-sm">
        <div className="flex animate-marquee whitespace-nowrap items-center gap-12 text-xs font-bold text-slate-600 px-4">
          {Object.entries(rates).map(([code, data]) => (
            <div key={code} className="flex items-center gap-2">
              <span className="text-slate-400">{code}/TRY</span>
              <span className="text-blue-600 font-mono">{formatMoney(data.value, 4)}</span>
              <TrendingUp className="w-3 h-3 text-emerald-500" />
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-bold mb-1">
              <Activity className="w-5 h-5" />
              <span className="uppercase tracking-widest text-xs font-black">Canlı Piyasa Terminali</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 leading-none tracking-tight">Finans <span className="text-blue-600 italic">Analiz</span></h1>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden h-[400px]">
              <div id="tv_chart_container" className="h-full w-full" />
            </div>
          </div>
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-xl">
               <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6"><Newspaper className="w-6 h-6 text-orange-500" /> Haber Merkezi</h3>
               <div className="space-y-5">
                {news.map((item, i) => (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="group block border-b border-slate-50 pb-4 last:border-0 transition-all hover:translate-x-1">
                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{item.source || 'GÜNCEL'}</span>
                    <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 mt-1 leading-snug line-clamp-2">{item.name}</p>
                  </a>
                ))}
               </div>
            </div>
          </div>
        </div>
      </div>
      <script src="[https://s3.tradingview.com/tv.js](https://s3.tradingview.com/tv.js)"></script>
    </div>
  );
}
