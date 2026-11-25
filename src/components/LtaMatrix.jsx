import { useMemo } from "react";
import { Layers } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { RegionBadge } from "@/components/ui/badge";
import { Tip } from "@/components/ui/tooltip";
import { BasisMark, RangeBar, ConfidenceLegend } from "@/components/Confidence";
import { ltaGrid, TERMS, TERM, REGION, BASIS, CONF } from "@/lib/data";
import { f2, usd } from "@/lib/utils";

function Cell({ v, t, spot, region, gpu, FX }) {
  if (!v) return <td className="px-3 py-3 text-right text-muted">—</td>;
  const c = CONF[v.conf];
  const ranged = v.hi > v.lo;
  const disc = t !== "spot" && spot ? v.usd / spot - 1 : null;
  const tip = (
    <div className="space-y-1">
      <div className="font-semibold">{gpu} · {REGION[region]} · {t === "spot" ? "现货" : TERM[t] + " LTA"}</div>
      <div className="num">
        中值 <b>{usd(v.usd)}</b>{ranged && <> · 区间 {usd(v.lo)}–{usd(v.hi)}</>}
        {region === "CN" && FX && <> · ¥{f2(v.usd * FX)}</>}
      </div>
      <div><span style={{ color: c.color }} className="font-medium">置信度{c.label}</span> · {BASIS[v.basis]}</div>
      {v.method && <div className="text-ink-2">{v.method}</div>}
      {v.how && <div className="text-ink-2">没有直接数据。{v.how}</div>}
      {v.note && t === "spot" && <div className="text-ink-2">{v.note}</div>}
      {v.source && <div className="text-muted">{v.source} · {v.as_of}{v.confidence ? ` · 来源置信度 ${v.confidence}` : ""}</div>}
    </div>
  );
  return (
    <Tip content={tip}>
      <td className="cursor-default px-3 py-2.5 text-right align-top" tabIndex={0}>
        <div className="num whitespace-nowrap text-[15px] font-semibold" style={{ color: c.color }}>
          {ranged ? <>{usd(v.lo)}<span className="mx-0.5 opacity-60">–</span>{f2(v.hi)}</> : usd(v.usd)}
          <BasisMark basis={v.basis} conf={v.conf} />
        </div>
        <div className="num mt-1 text-[11px] whitespace-nowrap text-muted">
          {[region === "CN" && FX ? `¥${f2(v.usd * FX, 1)}` : null, ranged ? `中值 ${usd(v.usd)}` : t === "spot" ? "现货" : null,
            disc != null ? `${disc <= 0 ? "低" : "高"} ${f2(Math.abs(disc) * 100, 0)}%` : null].filter(Boolean).join(" · ")}
        </div>
        <div className="mt-1 flex justify-end"><RangeBar lo={v.lo} hi={v.hi} mid={v.usd} conf={v.conf} /></div>
      </td>
    </Tip>
  );
}

export function LtaMatrix({ M }) {
  const { keys, res } = useMemo(() => ltaGrid(M), [M]);
  const hs = (M.D.contracts || []).filter((c) => c.channel === "hyperscaler");
  const rTxt = ["US", "CN"].map((rg) => REGION[rg] + " " + ["1y", "3y", "5y"].map((t, i) => { const r = res[rg].R[t]; return r.r ? `${TERM[TERMS[i]]}→${TERM[t]} ×${f2(r.r)}` : null; }).filter(Boolean).join("，")).join("；");
  return (
    <Card>
      <CardHeader icon={Layers} title="现货 vs 长协（LTA）"
        desc="USD / GPU·小时，人民币按中间价折算。颜色表示置信度，区间条表示区间宽度。悬停看来源和推导。小字百分比为相对现货的折扣。" />
      <ConfidenceLegend className="mb-4 rounded-lg bg-panel-2 px-3 py-2.5" />
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] font-medium text-muted">
              <th className="px-3 py-2 text-left font-medium">型号</th>
              <th className="px-3 py-2 text-left font-medium">地区</th>
              {TERMS.map((t) => <th key={t} className="px-3 py-2 text-right font-medium">{t === "spot" ? "现货" : `${TERM[t]} LTA`}</th>)}
            </tr>
          </thead>
          <tbody>
            {keys.flatMap((key) => {
              const regions = ["US", "CN"].filter((r) => res[r].grid[key]);
              return regions.map((region, i) => {
                const g = res[region].grid[key];
                return (
                  <tr key={key + region} className={i === 0 ? "border-t border-line" : ""}>
                    <td className="px-3 py-2.5 align-top font-semibold">{i === 0 ? key : ""}</td>
                    <td className="px-3 py-2.5 align-top"><RegionBadge region={region} label={REGION[region]} /></td>
                    {TERMS.map((t) => <Cell key={t} v={g[t]} t={t} spot={g.spot?.usd} region={region} gpu={key} FX={M.FX} />)}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        推算规则：同系列新一代有实测长协时，用「新一代长协 × 两者现货比」；否则用同地区其他型号的期限比值（中位数：{rTxt}），区间取样本中的最小和最大比值。调研估算没有给区间时按 ±15% 显示。
        {hs.length > 0 && <><br />超大云承诺价（参照，不计入上表）：{hs.map((c) => `${c.gpu_key} ${TERM[c.term]} ${c.unit.startsWith("CNY") ? "¥" : "$"}${f2(c.price)}`).join("；")}</>}
      </p>
    </Card>
  );
}
