import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { RegionBadge } from "@/components/ui/badge";
import { Tip } from "@/components/ui/tooltip";
import { BasisMark, RangeBar, ConfidenceLegend } from "@/components/Confidence";
import { ltaGrid, TERMS, TERM, REGION, BASIS, CONF, holdingCost, COST_DEFAULTS } from "@/lib/data";
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

function Num({ label, value, onChange, step, min, max, suffix, w = "w-14" }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      {label}
      <input type="number" inputMode="decimal" value={value} step={step} min={min} max={max}
        onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v)) onChange(Math.min(max, Math.max(min, v))); }}
        className={`num ${w} rounded-md border border-line bg-panel px-1.5 py-0.5 text-right text-xs text-ink`} />
      {suffix && <span className="text-muted">{suffix}</span>}
    </label>
  );
}

const TIER = { newc: "新购全成本", vint: "存量成本", cash: "现金成本底线" };
function CostCell({ hc, tier, spot, region, gpu, FX, a, sofr, first }) {
  const v = hc?.[tier];
  const cls = "px-3 py-2.5 text-right align-top bg-panel-2/60" + (first ? " border-l border-line" : "");
  if (!v) return <td className={cls + " text-muted"}>—</td>;
  const c = CONF[v.conf];
  const margin = spot ? spot / v.usd - 1 : null;
  const rc = region === "CN" ? a.cn : a;
  const o = (tier === "cash" ? v.o : hc.newc?.mid?.o) || hc.cash?.o;
  const tip = (
    <div className="space-y-1">
      <div className="font-semibold">{gpu} · {REGION[region]} · {TIER[tier]}</div>
      <div className="num">中值 <b>{usd(v.usd)}</b>/卡时 · 区间 {usd(v.lo)}–{usd(v.hi)}</div>
      {tier === "newc" && <>
        <div className="text-ink-2">按今天的采购价新建。每卡 {usd(v.cap.low, 0)} / {usd(v.cap.mid, 0)} / {usd(v.cap.high, 0)}（低/中/高）{v.cap.nvl ? "，整柜价已含 NVLink" : ""}，加网络与安装 {f2(hc.ovh * 100, 0)}%。</div>
        <div className="text-ink-2">资金 {f2(hc.r * 100)}%（SOFR {f2(sofr)}% + {f2(a.spread * 100, 0)}bps），{100 - a.down}% 贷款、{a.down}% 定金，{a.years} 年等额本息，折旧到零。</div>
        {v.cap.src?.sources && <div className="space-y-0.5 border-t border-line pt-1">{v.cap.src.sources.map((x, i) => <div key={i} className="text-[11px]">{x.name}（{x.date}）：{x.quote}</div>)}
          {v.cap.src.disagree && <div className="text-[11px] text-muted">分歧：{v.cap.src.disagree}</div>}</div>}
        {v.cap.rows && <div className="space-y-0.5 border-t border-line pt-1">{v.cap.rows.map((x, i) => <div key={i} className="text-[11px]">{x.p.item} · {x.p.channel}：每卡 {usd(x.card, 0)}{x.single ? "（单卡 +30% 主机）" : ""}（{x.p.source} · {x.p.as_of}）</div>)}</div>}
      </>}
      {tier === "vint" && <>
        <div className="text-ink-2">按当年采购价：{v.vin.label}，每卡 {usd(v.vin.low, 0)}–{usd(v.vin.high, 0)}。已用 {f2(v.age, 1)} 年，{v.left > 0 ? `还剩 ${f2(v.left, 1)} 年折旧和还款` : "已折旧完、贷款还清，只剩运营成本"}。</div>
        {v.vin.deploy && <div className="text-[11px] text-muted">{v.vin.deploy}</div>}
        <div className="space-y-0.5 border-t border-line pt-1">{v.vin.sources.map((x, i) => <div key={i} className="text-[11px]">{x.name}（{x.date}）：{x.quote}</div>)}</div>
      </>}
      {tier === "cash" && <div className="text-ink-2">资本已沉没，只算现金支出。低于这个价出租不如关机。</div>}
      {o && <div className="num border-t border-line pt-1 text-[11px] text-ink-2">运营 / 年：电费 {usd(o.power, 0)}（{f2(hc.kW, 2)} kW × PUE {rc.pue} × ${rc.power}/kWh）· 托管 {usd(o.colo, 0)}（${rc.colo}/kW·月）· 维护 {usd(o.maint, 0)}（{rc.maint}%）</div>}
      <div className="text-[11px] text-muted">利用率 {a.util}%。置信度{c.label}。</div>
    </div>
  );
  return (
    <Tip content={tip}>
      <td className={cls + " cursor-default"} tabIndex={0}>
        <div className="num whitespace-nowrap text-[14px] font-semibold" style={{ color: c.color }}>
          {usd(v.lo)}<span className="mx-0.5 opacity-60">–</span>{f2(v.hi)}
        </div>
        <div className="num mt-1 text-[11px] whitespace-nowrap text-muted">
          {[region === "CN" && FX ? `¥${f2(v.usd * FX, 1)}` : null, `中值 ${usd(v.usd)}`].filter(Boolean).join(" · ")}
        </div>
        <div className="num text-[11px] whitespace-nowrap">
          {tier === "vint" && <span className="text-muted">{v.left > 0 ? `剩 ${f2(v.left, 1)} 年 · ` : "已折旧完 · "}</span>}
          {margin != null && <span className={margin >= 0 ? "text-good" : "text-bad"}>现货{margin >= 0 ? "高" : "低"} {f2(Math.abs(margin) * 100, 0)}%</span>}
        </div>
        <div className="mt-1 flex justify-end"><RangeBar lo={v.lo} hi={v.hi} mid={v.usd} conf={v.conf} /></div>
      </td>
    </Tip>
  );
}

export function LtaMatrix({ M }) {
  const { keys, res } = useMemo(() => ltaGrid(M), [M]);
  const [a, setA] = useState(COST_DEFAULTS);
  const set = (k) => (v) => setA((x) => ({ ...x, [k]: v }));
  const sofr = M.D.sofr ?? 4;
  const hs = (M.D.contracts || []).filter((c) => c.channel === "hyperscaler");
  const rTxt = ["US", "CN"].map((rg) => REGION[rg] + " " + ["1y", "3y", "5y"].map((t, i) => { const r = res[rg].R[t]; return r.r ? `${TERM[TERMS[i]]}→${TERM[t]} ×${f2(r.r)}` : null; }).filter(Boolean).join("，")).join("；");
  return (
    <Card>
      <CardHeader icon={Layers} title="现货 vs 长协（LTA）"
        desc="USD / GPU·小时，人民币按中间价折算。颜色表示置信度，区间条表示区间宽度。悬停看来源和推导。小字百分比为相对现货的折扣。" />
      <ConfidenceLegend className="mb-3 rounded-lg bg-panel-2 px-3 py-2.5" />
      <div className="mb-4 rounded-lg border border-line px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-xs font-medium text-ink">持有成本假设</span>
          <span className="num text-xs text-ink-2">SOFR {f2(sofr)}%<span className="text-muted">（{M.D.sofr_as_of || "默认"}）</span></span>
          <Num label="+ 利差" value={a.spread * 100} onChange={(v) => set("spread")(v / 100)} step={25} min={0} max={3000} suffix="bps" />
          <Num label="定金" value={a.down} onChange={set("down")} step={5} min={0} max={100} suffix="%" w="w-12" />
          <Num label="折旧" value={a.years} onChange={set("years")} step={1} min={1} max={10} suffix="年" w="w-10" />
          <Num label="利用率" value={a.util} onChange={set("util")} step={5} min={10} max={100} suffix="%" w="w-12" />
          <Num label="股权回报" value={a.equity} onChange={set("equity")} step={1} min={0} max={50} suffix="%" w="w-12" />
          <Num label="网络与安装 +" value={a.overhead ?? ""} onChange={set("overhead")} step={1} min={0} max={100} suffix="%（空 = 自动）" w="w-12" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-xs font-medium text-ink">运营 · 美国</span>
          <Num label="电价 $" value={a.power} onChange={set("power")} step={0.005} min={0} max={1} suffix="/kWh" w="w-16" />
          <Num label="PUE" value={a.pue} onChange={set("pue")} step={0.05} min={1} max={2} w="w-12" />
          <Num label="托管 $" value={a.colo} onChange={set("colo")} step={10} min={0} max={500} suffix="/kW·月" />
          <Num label="维护" value={a.maint} onChange={set("maint")} step={0.5} min={0} max={20} suffix="%/年" w="w-12" />
          <span className="text-xs font-medium text-ink">中国</span>
          <Num label="电价 $" value={a.cn.power} onChange={(v) => setA((x) => ({ ...x, cn: { ...x.cn, power: v } }))} step={0.005} min={0} max={1} suffix="/kWh" w="w-16" />
          <Num label="托管 $" value={a.cn.colo} onChange={(v) => setA((x) => ({ ...x, cn: { ...x.cn, colo: v } }))} step={10} min={0} max={500} suffix="/kW·月" />
          <button type="button" onClick={() => setA(COST_DEFAULTS)} className="text-xs text-us hover:underline">恢复默认</button>
        </div>
        <p className="num mt-2 text-[11px] leading-relaxed text-muted">
          每卡时成本 = [ 贷款等额本息 PMT(C×{100 - a.down}%, {f2(sofr + a.spread)}%, {a.years}年) + 定金回收 PMT(C×{a.down}%, {a.equity}%, {a.years}年) + 电费 + 托管 + 维护 ] ÷ (8760 × {a.util}%)。C = 每卡采购价 × (1 + 网络与安装，HGX 15% / NVL72 12%)。电费 = 每卡功耗 kW × PUE × 8760 × 电价，托管 = kW × $/kW·月 × 12。残值按 0。存量成本按当年采购价，过了折旧期资本成本为 0；现金底线只算运营支出。
          {M.CI?.ops?.US?.build_check && <><br />交叉核对：{M.CI.ops.US.build_check} {M.CI.ops.CN?.build_check}</>}
          {M.CI?.benchmarks && <><br />外部对照：{M.CI.benchmarks.name}，每卡时 {Object.entries(M.CI.benchmarks.values).map(([k, v]) => `${k} $${v}`).join("、")}。{M.CI.benchmarks.note}</>}
        </p>
      </div>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] font-medium text-muted">
              <th className="px-3 py-2 text-left font-medium">型号</th>
              <th className="px-3 py-2 text-left font-medium">地区</th>
              {TERMS.map((t) => <th key={t} className="px-3 py-2 text-right font-medium">{t === "spot" ? "现货" : `${TERM[t]} LTA`}</th>)}
              <th className="border-l border-line bg-panel-2/60 px-3 py-2 text-right font-medium text-ink-2">新购全成本</th>
              <th className="bg-panel-2/60 px-3 py-2 text-right font-medium text-ink-2">存量成本</th>
              <th className="bg-panel-2/60 px-3 py-2 text-right font-medium text-ink-2">现金底线</th>
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
                    {(() => { const hc = holdingCost(M, key, region, a); return ["newc", "vint", "cash"].map((t, j) => <CostCell key={t} hc={hc} tier={t} first={j === 0} spot={g.spot?.usd} region={region} gpu={key} FX={M.FX} a={a} sofr={sofr} />); })()}
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
