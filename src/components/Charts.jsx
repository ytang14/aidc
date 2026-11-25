import { useMemo, useState } from "react";
import { LineChart, BarChartHorizontal, Spline } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Tip } from "@/components/ui/tooltip";
import { KEYS, REGION, TERM, TERMS, BASIS, confOf, CONF, keyOf } from "@/lib/data";
import { f2, usd, pct, niceStep } from "@/lib/utils";

const KIND_COLOR = { 成交指数: "var(--us)", 挂牌月均: "var(--cn)", 挂牌中位: "var(--conf-hi)", 挂牌指数: "var(--conf-hi)", 看板代表价: "var(--conf-hi)" };
const Hit = ({ x, y, r = 12, tip }) => <Tip content={tip}><circle cx={x} cy={y} r={r} fill="transparent" /></Tip>;
const Legend = ({ items }) => (
  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
    {items.map((it, i) => <span key={i} className="inline-flex items-center gap-1.5">{it.mark}{it.label}</span>)}
  </div>
);
const Line = ({ color }) => <span className="inline-block h-[3px] w-3.5 rounded" style={{ background: color }} />;
const Dot = ({ color, hollow }) => <span className="inline-block size-2.5 rounded-full" style={hollow ? { border: `2px solid ${color}` } : { background: color }} />;

/* ---------- 美国租金走势 ---------- */
export function Trend({ M }) {
  const keys = [...new Set((M.BF?.series || []).map((s) => s.gpu))];
  const [key, setKey] = useState(keys.includes("H100") ? "H100" : keys[0]);
  const ss = useMemo(() => {
    const cut = new Date(); cut.setMonth(cut.getMonth() - 7);
    return M.seriesFor(key).map((s) => ({ ...s, points: s.points.filter((p) => new Date(p.date) >= cut) })).filter((s) => s.points.length);
  }, [M, key]);
  const W = 560, H = 250, L = 44, R = 40, T = 12, B = 28;
  const all = ss.flatMap((s) => s.points);
  const xs = all.map((p) => +new Date(p.date)), ys = all.map((p) => p.value);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const yMax = Math.max(...ys) * 1.12, step = niceStep(yMax / 4), top = Math.ceil(yMax / step) * step;
  const X = (t) => L + ((t - x0) / (x1 - x0 || 1)) * (W - L - R), Y = (v) => T + (1 - v / top) * (H - T - B);
  const grid = []; for (let v = 0; v <= top + 1e-9; v += step) grid.push(v);
  const d0 = new Date(x0); d0.setDate(1); d0.setMonth(d0.getMonth() + 1);
  const months = []; for (let d = new Date(d0); +d <= x1; d.setMonth(d.getMonth() + 1)) months.push(new Date(d));
  return (
    <Card>
      <CardHeader icon={LineChart} title="美国租金走势" desc="USD / GPU·小时，近 7 个月。空心点为按来源环比反推。"
        right={<Segmented label="选择型号" options={keys.map((k) => ({ value: k, label: k }))} value={key} onChange={setKey} />} />
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[460px] overflow-visible" role="img" aria-label={`${key} 美国租金走势`}>
          {grid.map((v) => <g key={v}><line className="gl" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} /><text x={L - 6} y={Y(v) + 4} textAnchor="end">${f2(v, step < 1 ? 1 : 0)}</text></g>)}
          {months.map((d, i) => i % Math.ceil(months.length / 7) ? null : <text key={i} x={X(+d)} y={H - 8} textAnchor="middle">{d.getFullYear() % 100}/{d.getMonth() + 1}</text>)}
          <line className="ax" x1={L} x2={W - R} y1={H - B} y2={H - B} />
          {ss.map((s) => {
            const c = KIND_COLOR[s.kind] || "var(--ink-2)";
            const lp = s.points.at(-1);
            return (
              <g key={s.kind + s.source}>
                {s.points.length > 1 && <path d={s.points.map((p, i) => (i ? "L" : "M") + X(+new Date(p.date)).toFixed(1) + " " + Y(p.value).toFixed(1)).join(" ")} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />}
                {s.points.map((p) => {
                  const x = X(+new Date(p.date)), y = Y(p.value);
                  return <g key={p.date}><circle cx={x} cy={y} r="4.5" fill={p.derived ? "var(--panel)" : c} stroke={p.derived ? c : "var(--panel)"} strokeWidth="2" />
                    <Hit x={x} y={y} tip={<><b className="num">{usd(p.value)}</b> · {p.date}<br />{s.kind} · {p.source}</>} /></g>;
                })}
                <text className="val" x={X(+new Date(lp.date)) + 8} y={Y(lp.value) + 4}>{f2(lp.value)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <Legend items={[...ss.map((s) => ({ mark: <Line color={KIND_COLOR[s.kind] || "var(--ink-2)"} />, label: `${s.kind} · ${s.source}` })), { mark: <Dot color="var(--ink-2)" hollow />, label: "反推点" }]} />
      <p className="mt-2 text-xs text-muted">共 {all.length} 个数据点。成交指数和挂牌价走势不一致时，说明实际成交比报价软或硬。每天存档一次，曲线会越来越密。</p>
    </Card>
  );
}

/* ---------- 进货价 → 售价梯 ---------- */
export function Spread({ M }) {
  const { D, rentBy, toUSD } = M;
  const rows = D.rental.filter((r) => r.region === "US").map((r) => {
    const key = r.gpu_key || keyOf(r.gpu); const cn = rentBy("CN", key);
    return { key, us: r, cn: cn ? toUSD(cn.price, cn.unit) : null, cnRaw: cn };
  });
  for (const r of D.rental.filter((r) => r.region === "CN")) if (!rows.some((x) => x.key === (r.gpu_key || keyOf(r.gpu)))) rows.push({ key: r.gpu_key || keyOf(r.gpu), us: null, cn: toUSD(r.price, r.unit), cnRaw: r });
  const order = (k) => { const i = KEYS.indexOf(k); return i < 0 ? 99 : i; };
  rows.sort((a, b) => order(a.key) - order(b.key));
  const max = Math.max(...rows.flatMap((x) => [x.us?.high, x.us?.price, x.cn].filter(Boolean)));
  const W = 560, L = 84, R = 56, rowH = 28, T = 22, H = T + rows.length * rowH + 6, top = Math.ceil(max / 5) * 5;
  const X = (v) => L + Math.sqrt(v / top) * (W - L - R);
  const ticks = [0, 0.5, 1, 2, 5, 10, 20, top].filter((v, i, a) => v <= top && a.indexOf(v) === i);
  return (
    <Card>
      <CardHeader icon={BarChartHorizontal} title="进货价 → 售价梯" desc="USD / GPU·小时。条带从市场地板到超大云按需价，圆点为代表价，菱形为中国价。横轴为平方根刻度。" />
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[460px] overflow-visible" role="img" aria-label="各型号租金区间与中美对比">
          {ticks.map((v) => <g key={v}><line className="gl" x1={X(v)} x2={X(v)} y1={T - 4} y2={H - 4} /><text x={X(v)} y={T - 9} textAnchor="middle">${v}</text></g>)}
          {rows.map((r, i) => {
            const y = T + i * rowH + rowH / 2, u = r.us;
            return (
              <g key={r.key}>
                <text className="lbl" x={L - 10} y={y + 4} textAnchor="end">{r.key}</text>
                {u && <>
                  <rect x={X(u.low)} y={y - 4} width={Math.max(2, X(u.high) - X(u.low))} height="8" rx="4" fill="var(--us)" opacity=".22" />
                  <circle cx={X(u.price)} cy={y} r="5.5" fill="var(--us)" stroke="var(--panel)" strokeWidth="2" />
                  <Tip content={<><b>{r.key} 美国</b><br /><span className="num">地板 {usd(u.low)} → 代表价 {usd(u.price)} → 最高 {usd(u.high)}</span><br />地板到代表价 {pct(u.price / u.low - 1)}<br /><span className="text-muted">{u.source} · {u.as_of}</span></>}>
                    <rect x={X(u.low) - 6} y={y - 12} width={X(u.high) - X(u.low) + 12} height="24" fill="transparent" />
                  </Tip>
                </>}
                {r.cn != null && <>
                  <path d={`M${X(r.cn)} ${y - 6} L${X(r.cn) + 6} ${y} L${X(r.cn)} ${y + 6} L${X(r.cn) - 6} ${y} Z`} fill="var(--cn)" stroke="var(--panel)" strokeWidth="1.5" />
                  <Hit x={X(r.cn)} y={y} r={10} tip={<><b>{r.key} 中国</b><br /><span className="num">{usd(r.cn)}（¥{f2(r.cnRaw.price)}）</span>{u && <><br />较美国代表价 {pct(r.cn / u.price - 1)}</>}<br /><span className="text-muted">{r.cnRaw.source} · {r.cnRaw.as_of}</span></>} />
                </>}
                <text className="val" x={W - R + 8} y={y + 4}>{f2(u ? u.price : r.cn)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <Legend items={[{ mark: <span className="inline-block h-2 w-5 rounded bg-us/25" />, label: "美国：地板 → 最高" }, { mark: <Dot color="var(--us)" />, label: "美国代表价" }, { mark: <span className="inline-block size-2.5 rotate-45 bg-cn" />, label: "中国（折美元）" }]} />
    </Card>
  );
}

/* ---------- 长协期限曲线 ---------- */
export function TermCurves({ M }) {
  const { D, rentBy, toUSD } = M;
  const C = D.contracts || [];
  const keys = KEYS.filter((k) => C.some((c) => c.gpu_key === k));
  const W = 240, H = 170, L = 36, R = 10, T = 14, B = 24;
  const X = (i) => L + (i * (W - L - R)) / 3;
  return (
    <Card>
      <CardHeader icon={Spline} title="长协期限曲线" desc="每个型号单独刻度。点的颜色表示置信度，竖线为区间，灰色菱形为超大云承诺价（参照）。" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {keys.map((key) => {
          const pts = [];
          for (const region of ["US", "CN"]) {
            const sp = rentBy(region, key);
            if (sp) { const u = toUSD(sp.price, sp.unit); pts.push({ ...sp, region, term: "spot", basis: "spot", channel: "market", usd: u, lo: u, hi: u }); }
            for (const c of C.filter((c) => c.region === region && c.gpu_key === key))
              pts.push({ ...c, usd: toUSD(c.price, c.unit), lo: toUSD(c.low ?? c.price, c.unit), hi: toUSD(c.high ?? c.price, c.unit) });
          }
          pts.forEach((p) => (p.conf = confOf(p.term === "spot" ? { ...p, lo: p.usd, hi: p.usd } : p)));
          const top = Math.max(...pts.flatMap((p) => [p.usd, p.hi]).filter((v) => v != null)) * 1.15;
          const step = niceStep(top / 3), ymax = Math.ceil(top / step) * step;
          const Y = (v) => T + (1 - v / ymax) * (H - T - B);
          const gl = []; for (let v = 0; v <= ymax + 1e-9; v += step) gl.push(v);
          return (
            <div key={key} className="rounded-lg border border-line p-3">
              <h3 className="num mb-1 text-[13px] font-semibold">{key}</h3>
              <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`${key} 期限曲线`}>
                {gl.map((v) => <g key={v}><line className="gl" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} /><text x={L - 5} y={Y(v) + 4} textAnchor="end">{f2(v, Number.isInteger(step) ? 0 : (step * 10) % 1 === 0 ? 1 : 2)}</text></g>)}
                {TERMS.map((t, i) => <text key={t} x={X(i)} y={H - 6} textAnchor="middle">{TERM[t]}</text>)}
                {["US", "CN"].map((region) => {
                  const col = region === "US" ? "var(--us)" : "var(--cn)";
                  const line = TERMS.map((t, i) => [i, pts.find((p) => p.region === region && p.term === t && p.channel !== "hyperscaler")]).filter((x) => x[1] && x[1].usd != null);
                  return (
                    <g key={region}>
                      {line.length > 1 && <path d={line.map(([i, p], j) => (j ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.usd).toFixed(1)).join(" ")} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" opacity=".85" />}
                      {pts.filter((p) => p.region === region && p.usd != null).map((p, k) => {
                        const x = X(TERMS.indexOf(p.term)) + (region === "US" ? -4 : 4), y = Y(p.usd), cc = CONF[p.conf].color;
                        const tip = <><b>{key} {REGION[region]} · {TERM[p.term]}</b>{p.channel === "hyperscaler" ? "（超大云）" : ""}<br /><span className="num">{usd(p.usd)}{p.hi > p.lo ? ` · 区间 ${usd(p.lo)}–${usd(p.hi)}` : ""}</span><br /><span style={{ color: cc }}>置信度{CONF[p.conf].label}</span> · {BASIS[p.basis]}{p.method ? `：${p.method}` : ""}<br /><span className="text-muted">{p.source} · {p.as_of}</span></>;
                        return (
                          <g key={k}>
                            {p.hi > p.lo && <line x1={x} x2={x} y1={Y(p.lo)} y2={Y(p.hi)} stroke={cc} strokeWidth="3" strokeLinecap="round" opacity=".35" />}
                            {p.channel === "hyperscaler"
                              ? <rect x={x - 4} y={y - 4} width="8" height="8" transform={`rotate(45 ${x} ${y})`} fill="var(--hs)" />
                              : <circle cx={x} cy={y} r="4.5" fill={cc} stroke={col} strokeWidth="2" />}
                            <Hit x={x} y={y} r={11} tip={tip} />
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })}
      </div>
      <Legend items={[{ mark: <Line color="var(--us)" />, label: "美国市场" }, { mark: <Line color="var(--cn)" />, label: "中国国内" }, ...Object.values(CONF).map((c) => ({ mark: <Dot color={c.color} />, label: `置信度${c.label}` })), { mark: <span className="inline-block size-2 rotate-45 bg-[var(--hs)]" />, label: "超大云承诺价" }]} />
    </Card>
  );
}
