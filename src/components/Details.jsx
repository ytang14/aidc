import { Route, ScrollText, Newspaper, Lightbulb, CircleCheck, CircleAlert, CircleX } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { RegionBadge, Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { REGION, TERM, BASIS } from "@/lib/data";
import { f2, usd, cn } from "@/lib/utils";

const ROUTE = {
  open: { label: "开放", Icon: CircleCheck, cls: "text-good bg-[var(--conf-hi-bg)]" },
  license: { label: "需许可", Icon: CircleAlert, cls: "text-warn bg-[var(--conf-mid-bg)]" },
  closed: { label: "关闭", Icon: CircleX, cls: "text-bad bg-[var(--conf-lo-bg)]" },
};

export function Routes({ M }) {
  const order = { closed: 0, license: 1, open: 2 };
  const rs = [...(M.D.routes || [])].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <Card>
      <CardHeader icon={Route} title="通道状态" desc="哪些买卖路线现在能走" />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {rs.map((r, i) => { const s = ROUTE[r.status]; return (
          <a key={i} href={r.url} target="_blank" rel="noopener" className="group flex items-start gap-3 rounded-lg border border-line p-3 transition-colors hover:bg-panel-2">
            <Badge className={cn("mt-0.5 shrink-0", s.cls)}><s.Icon className="size-3.5" aria-hidden />{s.label}</Badge>
            <div className="min-w-0"><div className="font-medium group-hover:underline">{r.route}</div>
              <div className="text-xs text-ink-2">{r.since ? `${r.since} 起 · ` : ""}{r.note}</div></div>
          </a>); })}
      </div>
    </Card>
  );
}

export function Headlines({ M }) {
  return (
    <Card>
      <CardHeader icon={Newspaper} title="今日要点" />
      <ul className="grid gap-2">
        {M.D.headline.map((h, i) => <li key={i} className="flex gap-3 text-sm"><span className="num mt-0.5 text-xs text-muted">{String(i + 1).padStart(2, "0")}</span><span>{h}</span></li>)}
      </ul>
    </Card>
  );
}

const Th = ({ children, r }) => <th className={cn("px-3 py-2 text-[11px] font-medium text-muted", r ? "text-right" : "text-left")}>{children}</th>;
const Td = ({ children, r, className }) => <td className={cn("px-3 py-2 align-top", r && "num text-right whitespace-nowrap", className)}>{children}</td>;
const Src = ({ x }) => <a href={x.url} target="_blank" rel="noopener" className="text-ink-2 hover:underline">{x.source}</a>;
function Table({ head, children, min = 760 }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth: min }}>
        <thead><tr className="border-b border-line">{head}</tr></thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0">{children}</tbody>
      </table>
    </div>
  );
}

export function Details({ M }) {
  const { D, FX } = M;
  const C = D.contracts || [];
  return (
    <Card>
      <CardHeader icon={ScrollText} title="明细与来源" desc="每个数字都有来源和日期。" />
      <Tabs defaultValue="reg">
        <TabsList className="mb-4">
          <TabsTrigger value="reg">监管动态 · {D.regulation.length}</TabsTrigger>
          <TabsTrigger value="ctr">长协明细 · {C.length}</TabsTrigger>
          <TabsTrigger value="buy">采购价 · {D.purchase.length}</TabsTrigger>
          <TabsTrigger value="rent">租赁价 · {D.rental.length}</TabsTrigger>
          <TabsTrigger value="opp">机会判断 · {D.opportunities.length}</TabsTrigger>
        </TabsList>
        <TabsContent value="reg">
          <div className="divide-y divide-line">
            {[...D.regulation].sort((a, b) => b.date.localeCompare(a.date)).map((r, i) => (
              <div key={i} className="grid gap-1 py-3 sm:grid-cols-[96px_1fr] sm:gap-4">
                <div className="num text-xs text-muted">{r.date}</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-medium"><RegionBadge region={r.jurisdiction} label={REGION[r.jurisdiction]} />{r.title}
                    <span className={cn("text-[11px]", r.direction === "tighten" ? "text-bad" : r.direction === "loosen" ? "text-good" : "text-muted")}>{r.direction === "tighten" ? "收紧" : r.direction === "loosen" ? "放松" : "中性"}</span></div>
                  <p className="mt-1 max-w-[80ch] text-[13px] text-ink-2">{r.summary}</p>
                  <p className="mt-1 max-w-[80ch] text-[13px] text-ink-2">影响：{r.impact} · <Src x={r} /></p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="ctr">
          <Table min={900} head={<><Th>地区</Th><Th>型号</Th><Th>期限</Th><Th r>价格</Th><Th r>区间</Th><Th>类型</Th><Th>推导</Th><Th>来源 · 日期</Th></>}>
            {C.map((c, i) => { const cur = c.unit.startsWith("CNY") ? "¥" : "$"; return (
              <tr key={i}><Td><RegionBadge region={c.region} label={REGION[c.region]} /></Td><Td className="font-medium">{c.gpu_key}</Td>
                <Td className="whitespace-nowrap">{TERM[c.term]}{c.channel === "hyperscaler" ? "（超大云）" : ""}</Td>
                <Td r>{cur}{f2(c.price)}</Td><Td r>{c.low !== c.high ? `${cur}${f2(c.low)}–${f2(c.high)}` : "—"}</Td>
                <Td className={cn("whitespace-nowrap", c.basis === "estimate" && "text-mid")}>{BASIS[c.basis]}</Td>
                <Td className="min-w-[260px] text-ink-2">{c.method}</Td><Td className="whitespace-nowrap"><Src x={c} /> · {c.as_of}</Td></tr>); })}
          </Table>
        </TabsContent>
        <TabsContent value="buy">
          <Table head={<><Th>地区</Th><Th>型号</Th><Th>渠道</Th><Th r>价格</Th><Th r>每卡（美元）</Th><Th>来源 · 日期</Th></>}>
            {D.purchase.map((p, i) => { const per = p.cards ? p.price / p.cards / (p.unit === "CNY" && FX ? FX : 1) : null; return (
              <tr key={i}><Td><RegionBadge region={p.region} label={REGION[p.region]} /></Td><Td className="font-medium">{p.item}</Td><Td className="text-ink-2">{p.channel}</Td>
                <Td r>{p.unit === "CNY" ? `¥${f2(p.price / 1e4, 0)} 万` : usd(p.price, 0)}</Td><Td r>{per ? usd(per, 0) : "—"}</Td><Td className="whitespace-nowrap"><Src x={p} /> · {p.as_of}</Td></tr>); })}
          </Table>
        </TabsContent>
        <TabsContent value="rent">
          <Table min={980} head={<><Th>地区</Th><Th>型号</Th><Th r>代表价</Th><Th r>地板</Th><Th r>最高</Th><Th>说明</Th><Th>来源 · 日期</Th></>}>
            {D.rental.map((r, i) => { const s = r.unit.startsWith("CNY") ? "¥" : "$"; return (
              <tr key={i}><Td><RegionBadge region={r.region} label={REGION[r.region]} /></Td><Td className="font-medium whitespace-nowrap">{r.gpu}</Td>
                <Td r>{s}{f2(r.price)}</Td><Td r>{s}{f2(r.low)}</Td><Td r>{s}{f2(r.high)}</Td><Td className="min-w-[300px] text-ink-2">{r.note}</Td><Td className="whitespace-nowrap"><Src x={r} /> · {r.as_of}</Td></tr>); })}
          </Table>
        </TabsContent>
        <TabsContent value="opp">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {D.opportunities.map((o, i) => (
              <div key={i} className="rounded-lg border border-line p-4">
                <h3 className="flex items-start gap-2 text-sm font-semibold"><Lightbulb className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />{o.title}</h3>
                <p className="mt-2 text-[13px] text-ink-2">{o.detail}</p>
                <p className="mt-2 text-xs text-muted">依据：{o.basis}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
