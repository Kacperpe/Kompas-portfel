// Dzienne notowania z Yahoo Finance dla listy symboli (proxy, bo przeglądarka nie ma dostępu przez CORS).
// GET /api/history?symbols=HOOD,PKO.WA,USDPLN=X&from=2025-01-01
module.exports = async (req, res) => {
  const syms = String(req.query.symbols || "")
    .split(",").map(s => s.trim()).filter(s => /^[A-Za-z0-9.^=\-]{1,20}$/.test(s)).slice(0, 120);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || "") ? req.query.from : "2015-01-01";
  const p1 = Math.floor(Date.parse(from + "T00:00:00Z") / 1000) - 86400 * 10;
  const p2 = Math.floor(Date.now() / 1000) + 86400;
  const data = {}, errors = {};

  const one = async (s) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?period1=${p1}&period2=${p2}&interval=1d`;
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (KompasPortfela)", Accept: "application/json" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      const x = j && j.chart && j.chart.result && j.chart.result[0];
      if (!x || !x.timestamp) throw new Error("brak notowań");
      const close = (x.indicators && x.indicators.quote && x.indicators.quote[0] && x.indicators.quote[0].close) || [];
      const t = [], c = [];
      x.timestamp.forEach((ts, i) => {
        const v = close[i];
        if (v != null && isFinite(v)) { t.push(Math.floor(ts / 86400)); c.push(+v.toFixed(4)); }
      });
      if (!t.length) throw new Error("brak notowań");
      data[s] = { ccy: (x.meta && x.meta.currency) || "", t, c };
    } catch (e) {
      errors[s] = String((e && e.message) || e);
    }
  };

  for (let i = 0; i < syms.length; i += 8) await Promise.all(syms.slice(i, i + 8).map(one));
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.status(200).json({ data, errors });
};
