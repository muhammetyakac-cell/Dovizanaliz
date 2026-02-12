import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, RefreshCw, Calculator, 
  Newspaper, Globe, BarChart3, ChevronRight, Activity, 
  ArrowUpRight, ArrowDownRight, Maximize2, AlertCircle,
  ExternalLink, Database, Cloud
} from 'lucide-react';

// Sabitler
const REFRESH_MS = 15000;

const ASSETS = [
  { code: 'USD', name: 'Amerikan Doları', tvSymbol: 'FX:USDTRY', type: 'currency' },
  { code: 'EUR', name: 'Euro', tvSymbol: 'FX:EURTRY', type: 'currency' },
  { code: 'GBP', name: 'İngiliz Sterlini', tvSymbol: 'FX:GBPTRY', type: 'currency' },
  { code: 'XAU', name: 'Altın (Ons)', tvSymbol: 'OANDA:XAUUSD', type: 'commodity' },
  { code: 'XAG', name: 'Gümüş (Ons)', tvSymbol: 'OANDA:XAGUSD', type: 'commodity' },
];

// Trendler için basit SVG çizim bileşeni
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

const generateSparklineData = () => Array.from({ length: 12 }, () => ({ value: Math.floor(Math.random() * 100) }));

const App = () => {
  const [rates, setRates] = useState({});
  const [commodities, setCommodities] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [lastNewsFetch, setLastNewsFetch] = useState(null);
  const [calcAmount, setCalcAmount] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [errorStatus, setErrorStatus] = useState({ fx: false, commodity: false, news: false });

  // Gelişmiş fetch fonksiyonu (Retry mekanizmalı)
  const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP Hatası: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw err;
    }
  };


  const syncNews = async () => {
    try {
      const data = await fetchWithRetry('/api/news', { method: 'GET' }, 2);

      if (data?.articles) {
        setNews(data.articles);
        setLastNewsFetch(data.lastFetched || null);
        setErrorStatus(prev => ({ ...prev, news: false }));
      }
    } catch (e) {
      console.warn('Haber servisi hatası:', e.message);
      setErrorStatus(prev => ({ ...prev, news: true }));
    }
  };

  const fetchData = async () => {
    setLoading(true);
    // Döviz
    try {
      const fxData = await fetchWithRetry(`https://api.frankfurter.app/latest?base=TRY&symbols=USD,EUR,GBP,CHF`, {});
      if (fxData?.rates) {
        const formattedRates = {};
        Object.keys(fxData.rates).forEach(key => {
          formattedRates[key] = { value: 1 / fxData.rates[key], sparkline: generateSparklineData() };
        });
        setRates(formattedRates);
        setErrorStatus(prev => ({ ...prev, fx: false }));
      }
    } catch (e) { setErrorStatus(prev => ({ ...prev, fx: true })); }

    // Emtia
    try {
      const symbols = encodeURIComponent('XAUUSD=X,XAGUSD=X');
      const commodityData = await fetchWithRetry(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`)}`, {});
      if (commodityData?.quoteResponse?.result) {
        setCommodities(commodityData.quoteResponse.result.map(item => ({
          symbol: item.symbol, price: item.regularMarketPrice || 0, change: item.regularMarketChangePercent || 0,
          sparkline: generateSparklineData(), name: item.symbol === 'XAUUSD=X' ? 'Altın (Ons)' : 'Gümüş (Ons)', code: item.symbol === 'XAUUSD=X' ? 'XAU' : 'XAG'
        })));
        setErrorStatus(prev => ({ ...prev, commodity: false }));
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
    const initWidget = () => {
      if (window.TradingView && document.getElementById(containerId)) {
        document.getElementById(containerId).innerHTML = "";
        new window.TradingView.MediumWidget({
          "symbols": [[selectedAsset.name, selectedAsset.tvSymbol]],
          "chartOnly": false, "width": "100%", "height": 400, "locale": "tr",
          "colorTheme": "light", "gridLineColor": "rgba(240, 243, 250, 0)",
          "fontFamily": "Inter, sans-serif", "trendLineColor": "#2962FF",
          "underLineColor": "rgba(41, 98, 255, 0.08)", "underLineBottomColor": "rgba(41, 98, 255, 0)",
          "isTransparent": false, "autosize": false, "container_id": containerId
        });
      }
    };

    if (!window.TradingView) {
      const script = document.createElement('script');
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      initWidget();
    }
  }, [selectedAsset, lastUpdate]);

  const formatMoney = (val, dec = 2) => {
    if (val === undefined || val === null || isNaN(val)) return "0,00";
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-12">
      {/* Üst Kayan Fiyat Bandı */}
      <div className="bg-white border-b border-slate-200 py-1 sticky top-0 z-50 overflow-hidden shadow-sm">
        <div className="flex animate-marquee whitespace-nowrap items-center gap-12 text-xs font-bold text-slate-600 px-4">
          {Object.entries(rates).length > 0 ? Object.entries(rates).map(([code, data]) => (
            <div key={code} className="flex items-center gap-2">
              <span className="text-slate-400">{code}/TRY</span>
              <span className="text-blue-600 font-mono">{formatMoney(data.value, 4)}</span>
              <TrendingUp className="w-3 h-3 text-emerald-500" />
            </div>
          )) : <div className="text-slate-400 italic">Döviz kurları yükleniyor...</div>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header Alanı */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-bold mb-1">
              <Activity className="w-5 h-5" />
              <span className="uppercase tracking-widest text-xs font-black">Canlı Piyasa Terminali</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 leading-none tracking-tight">Finans <span className="text-blue-600 italic">Analiz</span></h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
            <span className="flex items-center gap-2 text-slate-500">
              <div className={`w-2 h-2 rounded-full ${loading ? 'bg-orange-400 animate-pulse' : 'bg-emerald-500'}`} />
              {lastUpdate ? `Veri: ${lastUpdate.toLocaleTimeString('tr-TR')}` : 'Bağlanıyor...'}
            </span>
            <button onClick={fetchData} className="p-1 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none">
              <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {/* TradingView Grafik Kartı */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden relative min-h-[400px]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center text-slate-800">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-200"><BarChart3 className="w-6 h-6" /></div>
                  <div><h2 className="text-xl font-bold">{selectedAsset.name}</h2><p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{selectedAsset.tvSymbol}</p></div>
                </div>
              </div>
              <div id="tv_chart_container" className="h-[400px] w-full bg-slate-50" />
            </div>

            {/* Piyasa İzleme Listesi */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between"><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" /> Piyasa İzleme Listesi</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-50">
                      <th className="px-8 py-4">Enstrüman</th><th className="px-6 py-4">Fiyat</th><th className="px-6 py-4 text-center">Trend</th><th className="px-6 py-4 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ASSETS.map(asset => {
                      const isSelected = selectedAsset.code === asset.code;
                      const currentRate = asset.type === 'currency' ? rates[asset.code]?.value : commodities.find(c => c.code === asset.code)?.price;
                      const sparklineData = asset.type === 'currency' ? rates[asset.code]?.sparkline : commodities.find(c => c.code === asset.code)?.sparkline;
                      return (
                        <tr key={asset.code} onClick={() => setSelectedAsset(asset)} className={`group cursor-pointer transition-all ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                          <td className="px-8 py-5"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>{asset.code}</div><div><div className="font-bold text-slate-800">{asset.name}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{asset.type}</div></div></div></td>
                          <td className="px-6 py-5 font-mono font-bold text-slate-700 text-sm">{currentRate ? (asset.type === 'currency' ? `${formatMoney(currentRate, 4)} ₺` : `$${formatMoney(currentRate)}`) : '---'}</td>
                          <td className="px-6 py-5 w-32"><div className="h-8 w-full flex items-center"><Sparkline data={sparklineData} color={isSelected ? "#2563eb" : "#94a3b8"} /></div></td>
                          <td className="px-6 py-5 text-right"><button className={`p-2 rounded-xl transition-all ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'}`}><ChevronRight className="w-4 h-4" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            {/* Hesap Makinesi Widget */}
            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-xl shadow-slate-200/50">
              <div className="flex items-center gap-3 mb-6"><div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Calculator className="w-6 h-6" /></div><h3 className="text-xl font-bold text-slate-800 tracking-tight">Hızlı Dönüştürücü</h3></div>
              <div className="space-y-4">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter text-slate-400">Bozulacak Miktar (TRY)</label><input type="number" value={calcAmount} onChange={(e) => setCalcAmount(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner text-slate-800" /></div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {ASSETS.slice(0, 4).map(asset => {
                    const rate = asset.type === 'currency' ? rates[asset.code]?.value : (commodities.find(c => c.code === asset.code)?.price * (rates['USD']?.value || 1));
                    return <div key={asset.code} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-blue-100 transition-colors"><div className="text-[10px] font-bold text-slate-400 mb-1">{asset.code} Karşılığı</div><div className="font-black text-slate-700 truncate text-sm">{rate ? formatMoney(calcAmount / rate, 2) : '---'}</div></div>;
                  })}
                </div>
              </div>
            </div>

            {/* Haber Merkezi Widget (Blob Önbellekli) */}
            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-xl shadow-slate-200/50 relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Newspaper className="w-6 h-6 text-orange-500" /> Haber Merkezi</h3>
                <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 shadow-sm">
                  <Cloud className="w-3 h-3 text-blue-500" />
                  <span className="text-[9px] font-bold text-blue-600 uppercase tracking-tighter italic font-black">REST API</span>
                </div>
              </div>
              <div className="space-y-5 min-h-[100px]">
                {news && news.length > 0 ? news.map((item, i) => (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="group block border-b border-slate-50 pb-4 last:border-0 last:pb-0 transition-all hover:translate-x-1">
                    <div className="flex justify-between items-start gap-2 text-slate-900">
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{item.source || 'GÜNCEL'}</span>
                      <ExternalLink className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors mt-1 leading-snug line-clamp-2">{item.name}</p>
                  </a>
                )) : (
                  <div className="py-8 text-center flex flex-col items-center gap-2 text-slate-400">
                    <Activity className="w-8 h-8 animate-pulse text-slate-200" />
                    <div className="text-xs italic tracking-tight">Veritabanı senkronize ediliyor...</div>
                  </div>
                )}
              </div>
              {lastNewsFetch && (
                <div className="mt-6 pt-4 border-t border-slate-50 text-[10px] text-slate-400 text-center italic font-medium">
                  Senkronizasyon: {new Date(lastNewsFetch).toLocaleString('tr-TR')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center py-10 text-slate-400 text-xs px-4"><p>© 2026 Finans Merkezi - Vercel Blob REST Architecture v4.5</p></footer>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; background: #f8fafc; margin: 0; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: inline-flex; animation: marquee 30s linear infinite; width: max-content; }
        .animate-marquee:hover { animation-play-state: paused; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      `}</style>
    </div>
  );
};

export default App;
