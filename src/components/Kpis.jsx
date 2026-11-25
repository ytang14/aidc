import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { paybackRows } from "@/lib/data";
import { f2, usd, pct, cn } from "@/lib/utils";

function Spark({ points, color }) {
  if (points.length < 2) return null;
  const W = 120, H = 32, xs = points.map((p) => +new Date(p.date)), ys = points.map((p) => p.value);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys) * 0.95, y1 = Math.max(...ys) * 1.05;
  const X = (v) => ((v - x0) / (x1 - x0 || 1)) * (W - 6) + 3, Y = (v) => H - 3 - ((v - y0) / (y1 - y0 || 1)) * (H - 6);
  const d = points.map((p, i) => (i ? "L" : "M") + X(xs[i]).toFixed(1) + " " + Y(p.value).toFixed(1)).join(" ");
  const area = d + ` L${X(xs.at(-1))} ${H} L${X(xs[0])} ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-24 shrink-0" aria-hidden>
      <path d={area} fill={color} opacity=".1" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={X(xs.at(-1))} cy={Y(points.at(-1).value)} r="3" fill={color} />
    </svg>
  );
}

function Kpi({ label, value, unit, delta, deltaTxt, src, spark }) {
  const dir = delta == null ? 0 : delta > 0.005 ? 1 : delta < -0.005 ? -1 : 0;
  const Icon = dir > 0 ? TrendingUp : dir < 0 ? TrendingDown : Minus;
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-line bg-panel p-4 shadow-[var(--shadow)]">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="num text-[26px] leading-tight font-semibold tracking-tight whitespace-nowrap">
          {value}<span className="ml-1 text-xs font-normal text-ink-2">{unit}</span>
        </div>
        {spark}
      </div>
      {deltaTxt && (
        <div className={cn("flex items-center gap-1 text-xs", delta == null ? "text-ink-2" : dir > 0 ? "text-bad" : dir < 0 ? "text-good" : "text-ink-2")}>
          {delta != null && <Icon className="size-3.5" aria-hidden />}<span className="truncate">{deltaTxt}</span>
        </div>
      )}
      <div className="truncate text-[11px] text-muted">{src}</div>
    </div>
  );
}

export function Kpis({ M }) {
  const { rentBy, seriesFor, FX } = M;
  const out = [];
  for (const key of ["H100", "B200"]) {
    const r = rentBy("US", key);
    if (!r) continue;
    const all = seriesFor(key);
    const multi = all.filter((x) => x.points.length > 1).sort((a, b) => b.points.at(-1).date.localeCompare(a.points.at(-1).date));
    const s = multi.find((x) => x.kind === "成交指数") || multi[0] || all[0];
    const pts = s?.points || [];
    const prev = pts.length > 1 ? pts.at(-2) : null;
    const dl = prev ? pts.at(-1).value / prev.value - 1 : null;
    out.push(<Kpi key={key} label={`${key} 美国租金`} value={usd(r.price)} unit="/卡时" delta={dl}
      deltaTxt={prev ? `${s.kind} ${pct(dl)}（${prev.date.slice(5)} → ${pts.at(-1).date.slice(5)}）` : ""}
      src={<a href={r.url} target="_blank" rel="noopener" className="hover:underline">{r.source} · {r.as_of}</a>}
      spark={<Spark points={pts} color="var(--us)" />} />);
  }
  const us = rentBy("US", "H100"), cnr = rentBy("CN", "H100");
  if (us && cnr && FX) {
    const c = cnr.price / FX, sp = c / us.price - 1;
    out.push(<Kpi key="cnus" label="H100 中国 vs 美国" value={usd(c)} unit="/卡时" delta={null}
      deltaTxt={`${sp < 0 ? "中国便宜" : "中国贵"} ${f2(Math.abs(sp) * 100, 1)}%（美国 ${usd(us.price)}）`}
      src={`${cnr.source} · ¥${f2(cnr.price)} · ${cnr.as_of}`} />);
  }
  const pb = paybackRows(M, 0.7, 0.3, "spot").filter((x) => isFinite(x.months)).sort((a, b) => a.months - b.months)[0];
  if (pb) out.push(<Kpi key="pb" label="最快回本（默认假设）" value={f2(pb.months, 1)} unit="个月" delta={null} deltaTxt={pb.label} src="现货租金 · 利用率 70% · 运营成本 $0.30/卡时" />);
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{out}</div>;
}
