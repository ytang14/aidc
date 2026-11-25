// 数据加载与派生计算。所有价格统一换算成 USD / GPU·小时，人民币按中间价。

export const KEYS = ["GB300","GB200","B300","B200","H200","H100","H800","H20","A100","A800","MI300X","MI355X","910C","910B","RTX 4090","RTX 5090"];
export const REGION = { US: "美国", CN: "中国", Global: "全球", Other: "其他" };
export const TERMS = ["spot", "1y", "3y", "5y"];
export const TERM = { spot: "现货", "1y": "1 年", "3y": "3 年", "5y": "5 年" };
export const BASIS = { published: "公开报价", deal: "合同折算", estimate: "调研估算", inferred: "推算", spot: "现货代表价" };

export const keyOf = (s) => {
  const u = String(s || "").toUpperCase().replace(/\s|昇腾/g, "");
  return KEYS.find((k) => u.includes(k.replace(" ", ""))) || null;
};
const median = (a) => {
  const v = [...a].sort((x, y) => x - y), n = v.length;
  return n ? (n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2) : null;
};

export async function loadAll() {
  const get = (u) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [D, BF, idx, CI] = await Promise.all([get("/data/latest.json"), get("/data/backfill.json"), get("/data/history/index.json"), get("/data/cost_inputs.json")]);
  const days = Array.isArray(idx) ? idx.slice(-120) : [];
  const HIST = (await Promise.all(days.map((d) => get(`/data/history/${d}.json`)))).filter(Boolean);
  return { ...makeModel(D, BF, HIST), CI: CI || {} };
}

export function makeModel(D, BF, HIST) {
  const FX = D?.fx_usdcny || null;
  const toUSD = (v, unit) => (v == null ? null : unit && unit.startsWith("CNY") ? (FX ? v / FX : null) : v);
  const rentBy = (region, key) => D.rental.find((r) => r.region === region && (r.gpu_key || keyOf(r.gpu)) === key);
  const contractBy = (region, key, term) =>
    (D.contracts || []).find((c) => c.region === region && c.gpu_key === key && c.term === term && c.channel !== "hyperscaler");

  function seriesFor(key) {
    const ss = (BF?.series || []).filter((s) => s.gpu === key).map((s) => ({ ...s, points: [...s.points] }));
    for (const h of HIST) {
      const r = h.rental?.find((x) => x.region === "US" && (x.gpu_key || keyOf(x.gpu)) === key);
      if (!r) continue;
      const kind = /ornn/i.test(r.source) ? "成交指数" : "看板代表价";
      let s = ss.find((x) => x.kind === kind);
      if (!s) { s = { gpu: key, kind, source: r.source, points: [] }; ss.push(s); }
      if (!s.points.some((p) => p.date === r.as_of)) s.points.push({ date: r.as_of, value: r.price, source: r.source + "（看板存档）", url: r.url });
    }
    ss.forEach((s) => s.points.sort((a, b) => a.date.localeCompare(b.date)));
    return ss.filter((s) => s.points.length);
  }

  return { D, BF, HIST, FX, toUSD, rentBy, contractBy, seriesFor };
}

/* ---------- 置信度 ----------
   高：公开报价 / 合同折算，来源置信度 high，区间窄
   中：来源置信度 medium，或调研估算且区间不宽
   低：来源置信度 low、推算、或区间宽度超过中值的 60% */
export function confOf(v) {
  if (!v) return null;
  const w = v.hi > v.lo && v.usd ? (v.hi - v.lo) / v.usd : 0;
  if (v.basis === "inferred") return w <= 0.3 ? "mid" : "lo";
  let lvl = v.confidence === "high" ? 2 : v.confidence === "medium" ? 1 : v.confidence === "low" ? 0 : 1;
  if (v.basis === "estimate") lvl = Math.min(lvl, 1);
  if (w > 0.6) lvl -= 1;
  return ["lo", "mid", "hi"][Math.max(0, lvl)];
}
export const CONF = {
  hi: { label: "高", desc: "公开报价或合同折算，来源可靠", color: "var(--conf-hi)", bg: "var(--conf-hi-bg)" },
  mid: { label: "中", desc: "单一来源、二手转引，或区间较窄的估算", color: "var(--conf-mid)", bg: "var(--conf-mid-bg)" },
  lo: { label: "低", desc: "推算、低置信来源，或区间很宽", color: "var(--conf-lo)", bg: "var(--conf-lo-bg)" },
};

/* ---------- 现货 vs 长协矩阵（含推算补全） ---------- */
export function ltaGrid(M) {
  const { D, toUSD, rentBy, contractBy } = M;
  const C = D.contracts || [], res = {};
  const keys = KEYS.filter((k) => C.some((c) => c.gpu_key === k && c.channel !== "hyperscaler"));
  for (const region of ["US", "CN"]) {
    const grid = {};
    for (const key of keys) {
      const sp = rentBy(region, key), cs = {};
      for (const t of ["1y", "3y", "5y"]) {
        const c = contractBy(region, key, t);
        if (!c) continue;
        const u = toUSD(c.price, c.unit);
        let lo = toUSD(c.low ?? c.price, c.unit), hi = toUSD(c.high ?? c.price, c.unit);
        if (c.basis === "estimate" && !(hi > lo)) { lo = u * 0.85; hi = u * 1.15; }
        cs[t] = { ...c, usd: u, lo, hi };
      }
      if (!Object.keys(cs).length) continue;
      grid[key] = cs;
      if (sp) {
        const u = toUSD(sp.price, sp.unit);
        grid[key].spot = { ...sp, basis: "spot", usd: u, lo: u, hi: u };
      }
    }
    // 相邻期限比值：同地区其他型号的实测点两两相比
    const R = {};
    for (let i = 1; i < TERMS.length; i++) {
      const rs = Object.values(grid)
        .map((g) => (g[TERMS[i - 1]] && g[TERMS[i]] && g[TERMS[i - 1]].basis !== "inferred" && g[TERMS[i]].basis !== "inferred" ? g[TERMS[i]].usd / g[TERMS[i - 1]].usd : null))
        .filter(Boolean);
      R[TERMS[i]] = { r: median(rs), lo: rs.length ? Math.min(...rs) : null, hi: rs.length ? Math.max(...rs) : null, n: rs.length };
    }
    const inf = (o) => ({ basis: "inferred", confidence: "low", ...o });
    for (const g of Object.values(grid)) {
      for (let pass = 0; pass < 2; pass++)
        for (let i = 1; i < TERMS.length; i++) {
          const a = TERMS[i - 1], b = TERMS[i], rr = R[b];
          if (!rr.r || a === "spot") continue;
          if (g[a] && !g[b]) g[b] = inf({ usd: g[a].usd * rr.r, lo: g[a].lo * rr.lo, hi: g[a].hi * rr.hi, how: `${TERM[a]}价 × ${rr.lo.toFixed(2)}–${rr.hi.toFixed(2)}（中位 ${rr.r.toFixed(2)}，${rr.n} 个样本）` });
          if (g[b] && !g[a]) g[a] = inf({ usd: g[b].usd / rr.r, lo: g[b].lo / rr.hi, hi: g[b].hi / rr.lo, how: `${TERM[b]}价 ÷ ${rr.lo.toFixed(2)}–${rr.hi.toFixed(2)}（中位 ${rr.r.toFixed(2)}，${rr.n} 个样本）` });
        }
    }
    // 同系列新一代有实测长协时，优先用「新一代长协 × 两者现货比」
    const NEXT = { GB200: "GB300", B200: "B300", H100: "H200", A100: "H100" };
    for (const [k, g] of Object.entries(grid)) {
      const nk = NEXT[k], ng = nk && grid[nk];
      if (!ng || !g.spot || !ng.spot) continue;
      const sr = g.spot.usd / ng.spot.usd;
      for (const t of ["1y", "3y", "5y"]) {
        if (g[t]?.basis !== "inferred" || !ng[t] || ng[t].basis === "inferred") continue;
        const m = ng[t].usd * sr;
        g[t] = inf({ usd: m, lo: Math.min(ng[t].lo * sr, m * 0.85), hi: Math.max(ng[t].hi * sr, m * 1.15), how: `${nk} ${TERM[t]}长协 $${ng[t].usd.toFixed(2)} × 两者现货比 ${sr.toFixed(3)}，区间取 ±15% 与 ${nk} 自身区间的较宽者` });
      }
    }
    for (const g of Object.values(grid)) for (const t of TERMS) if (g[t]) g[t].conf = t === "spot" ? confOf({ ...g[t], lo: g[t].usd, hi: g[t].usd }) : confOf(g[t]);
    res[region] = { grid, R };
  }
  return { keys, res };
}

/* ---------- 回本测算 ---------- */
export function paybackRows(M, util, opexUSD, mode) {
  const { D, FX, rentBy, contractBy } = M;
  const out = [];
  for (const p of D.purchase) {
    const key = p.gpu && p.gpu !== "other" ? p.gpu : keyOf(p.item);
    if (!key || !p.cards) continue;
    const region = p.region === "Global" ? "US" : p.region;
    const spot = rentBy(region, key);
    if (!spot) continue;
    const cny = p.unit === "CNY";
    if (cny && !spot.unit.startsWith("CNY")) continue;
    const ct = mode && mode !== "spot" ? contractBy(region, key, mode) : null;
    const r = ct ? { ...spot, price: ct.price, source: `${ct.source}（${TERM[mode]}长协）`, as_of: ct.as_of } : spot;
    const fallback = mode && mode !== "spot" && !ct;
    const card = p.price / p.cards;
    const opex = cny ? opexUSD * (FX || 7) : opexUSD;
    const net = r.price - opex;
    const months = net > 0 ? card / (net * 730 * util) : Infinity;
    out.push({ label: `${REGION[region]} ${p.item}`, channel: p.channel, region, key, card, cny, rent: r.price, months, p, r, fallback });
  }
  return out;
}

/* ---------- 持有成本（项目融资口径，每卡时盈亏平衡租金） ----------
   三档：
   ① 新购全成本：按今天的采购价新建
   ② 存量成本：按当年采购价，折旧期内仍要还本付息并回收定金；过了折旧期资本成本为 0
   ③ 现金成本底线：只算电费、托管、维护（资本已沉没）
   资本：C = 每卡采购价 × (1 + 网络/存储/安装)；贷款 D = C×(1−定金)，等额本息 PMT(D, SOFR+利差, n)；定金按股权回报率年金回收（0% 即直线折旧）；残值 0
   运营：功耗 kW × PUE × 8760 × 电价 + kW × 托管 $/kW·月 × 12 + C × 维护%
   每卡时 = 年成本 ÷ (8760 × 利用率) */
export const REGION_COST = {
  US: { power: 0.09, pue: 1.2, colo: 155, maint: 3 },
  CN: { power: 0.054, pue: 1.2, colo: 40, maint: 3 },
};
export const COST_DEFAULTS = { spread: 8.0, down: 30, years: 5, util: 85, overhead: null, equity: 0, now: 2026.9, ...REGION_COST.US, cn: REGION_COST.CN };
const annuity = (P, r, n) => (n <= 0 ? 0 : r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n)));

function capexRows(M, key, region) {
  const { D, FX, CI } = M;
  const ci = region === "US" && CI?.capex_us?.[key];
  if (ci) return { low: ci.low, mid: ci.mid, high: ci.high, src: ci, nvl: ci.basis === "整柜", confidence: ci.tier_est ? "low" : "medium", from: "cost_inputs" };
  const rows = (D.purchase || []).filter((p) => {
    const k = p.gpu && p.gpu !== "other" ? p.gpu : keyOf(p.item);
    return k === key && (p.region === "Global" ? "US" : p.region) === region && p.cards > 0;
  }).map((p) => ({ p, single: p.cards === 1, card: (p.unit === "CNY" ? (FX ? p.price / FX : null) : p.price) / p.cards * (p.cards === 1 ? 1.3 : 1) })).filter((x) => x.card);
  if (!rows.length) return null;
  const v = rows.map((x) => x.card);
  return { low: Math.min(...v), mid: median(v), high: Math.max(...v), rows, nvl: false,
    confidence: rows.some((x) => x.p.confidence === "low" || x.single) ? "low" : "medium", from: "purchase" };
}

export function holdingCost(M, key, region, a) {
  const cap = capexRows(M, key, region);
  const rc = region === "CN" ? a.cn : a;
  const kW = M.CI?.power_kw_per_gpu?.[key]?.v ?? 1.3;
  const ovh = (a.overhead ?? (cap?.nvl ? M.CI?.overhead?.nvl72 ?? 12 : M.CI?.overhead?.hgx ?? 15)) / 100;
  const r = ((M.D.sofr ?? 4) + a.spread) / 100, n = a.years, h = a.equity / 100, dn = a.down / 100;
  const hours = 8760 * a.util / 100;
  const opexOf = (C) => {
    const power = kW * rc.pue * 8760 * rc.power, colo = kW * rc.colo * 12, maint = C * rc.maint / 100;
    return { power, colo, maint, total: power + colo + maint };
  };
  const capital = (C) => annuity(C * (1 - dn), r, n) + annuity(C * dn, h, n);
  const perHour = (card, withCapital = true) => { const C = card * (1 + ovh); const o = opexOf(C); return { C, o, usd: ((withCapital ? capital(C) : 0) + o.total) / hours }; };

  const out = { kW, ovh, r, region };
  if (cap) {
    const lo = perHour(cap.low), mid = perHour(cap.mid), hi = perHour(cap.high);
    out.newc = { basis: "estimate", confidence: cap.confidence, usd: mid.usd, lo: lo.usd, hi: hi.usd, cap, mid };
    if (!(out.newc.hi > out.newc.lo)) { out.newc.lo = mid.usd * 0.9; out.newc.hi = mid.usd * 1.1; }
    out.newc.conf = confOf(out.newc);
  }
  const vin = region === "US" && M.CI?.vintage_us?.[key];
  if (vin) {
    const age = a.now - vin.year, left = n - age;
    const f = (card) => { const x = perHour(card, left > 0); return x.usd; };
    out.vint = { basis: "estimate", confidence: "medium", usd: f(vin.mid), lo: f(vin.low), hi: f(vin.high), vin, age, left };
    out.vint.conf = confOf(out.vint);
  }
  // 现金底线：以存量（或新购）设备的维护费计
  const baseCard = vin ? vin.mid : cap?.mid;
  if (baseCard) {
    const x = perHour(baseCard, false);
    out.cash = { basis: "estimate", confidence: "medium", usd: x.usd, lo: x.usd * 0.85, hi: x.usd * 1.15, o: x.o };
    out.cash.conf = confOf(out.cash);
  }
  return out.newc || out.cash ? out : null;
}
