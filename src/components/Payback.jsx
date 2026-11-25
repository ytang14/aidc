import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Segmented } from "@/components/ui/segmented";
import { Tip } from "@/components/ui/tooltip";
import { paybackRows } from "@/lib/data";
import { f2, usd } from "@/lib/utils";

export function Payback({ M }) {
  const [util, setUtil] = useState(70);
  const [opex, setOpex] = useState(0.3);
  const [mode, setMode] = useState("spot");
  const rows = useMemo(() => paybackRows(M, util / 100, opex, mode).sort((a, b) => a.months - b.months), [M, util, opex, mode]);
  const W = 1100, L = 330, R = 70, rowH = 30, T = 8, H = T + rows.length * rowH + 20;
  const fin = rows.filter((r) => isFinite(r.months)).map((r) => r.months);
  const top = Math.max(48, Math.ceil(Math.max(...fin, 36) / 12) * 12);
  const X = (v) => L + (Math.min(v, top) / top) * (W - L - R);
  const ticks = []; for (let m = 0; m <= top; m += 12) ticks.push(m);
  return (
    <Card>
      <CardHeader icon={Calculator} title="买卡出租，多久回本" desc="拖动假设，柱子实时更新。虚线为 36 个月（常见折旧年限）。租金口径没有该期限数据时退回现货价，柱子变浅。" />
      <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg bg-panel-2 px-4 py-3">
        <Slider label="利用率" value={util} onChange={setUtil} min={30} max={100} step={5} format={(v) => v + "%"} />
        <Slider label="运营成本" value={opex} onChange={setOpex} min={0} max={1} step={0.05} format={(v) => usd(v)} />
        <div className="flex items-center gap-3"><span className="text-xs text-ink-2">租金口径</span>
          <Segmented label="租金口径" value={mode} onChange={setMode} options={[{ value: "spot", label: "现货" }, { value: "1y", label: "1 年" }, { value: "3y", label: "3 年" }, { value: "5y", label: "5 年" }]} /></div>
      </div>
      <p className="num mb-3 overflow-x-auto rounded-md border border-line px-3 py-2 text-xs whitespace-nowrap text-ink-2">回本月数 = 每卡价格 ÷ [ (租金 − 运营成本) × 730 小时 × 利用率 ]</p>
      {rows.length ? (
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[640px] overflow-visible" role="img" aria-label="回本月数">
            {ticks.map((m) => <g key={m}><line className="gl" x1={X(m)} x2={X(m)} y1={T} y2={H - 20} /><text x={X(m)} y={H - 6} textAnchor="middle">{m}月</text></g>)}
            {rows.map((r, i) => {
              const y = T + i * rowH, c = r.region === "CN" ? "var(--cn)" : "var(--us)", cur = r.cny ? "¥" : "$";
              const tip = <><b>{r.label}</b>（{r.channel}）<br /><span className="num">每卡 {cur}{f2(r.card, 0)} · 租金 {cur}{f2(r.rent)}/卡时</span><br />租金口径：{r.r.source}{r.fallback ? "（无该期限数据，用现货）" : ""}<br />回本 <b>{isFinite(r.months) ? f2(r.months, 1) + " 个月" : "租金低于成本，回不了本"}</b><br /><span className="text-muted">{r.p.source} · {r.p.as_of}</span></>;
              return (
                <Tip key={i} content={tip}>
                  <g>
                    <rect x="0" y={y} width={W} height={rowH} fill="transparent" />
                    <text className="lbl" x={L - 10} y={y + rowH / 2 + 4} textAnchor="end">{r.region === "CN" ? "中国" : "美国"} {r.p.item.replace(/（.*?）/g, "")} · {r.p.channel.replace(/（.*?）/g, "").slice(0, 8)}</text>
                    {isFinite(r.months)
                      ? <><rect x={L} y={y + 6} width={Math.max(3, X(r.months) - L)} height={rowH - 12} rx="4" fill={c} opacity={r.fallback ? 0.4 : 1} />
                          <text className="val" x={X(r.months) + 6} y={y + rowH / 2 + 4}>{r.months > top ? "＞" : ""}{f2(Math.min(r.months, 999), 1)}</text></>
                      : <text x={L + 6} y={y + rowH / 2 + 4}>租金 ≤ 成本</text>}
                  </g>
                </Tip>
              );
            })}
            <line x1={X(36)} x2={X(36)} y1={T} y2={H - 20} stroke="var(--ink-2)" strokeDasharray="4 3" />
          </svg>
        </div>
      ) : <p className="text-xs text-muted">暂无可配对的采购价与租金。</p>}
      <p className="mt-2 text-xs text-muted">未含资金成本、残值和网络设备；整机价按卡数平摊。运营成本含电力、机房、运维，中国按汇率折算。</p>
    </Card>
  );
}
