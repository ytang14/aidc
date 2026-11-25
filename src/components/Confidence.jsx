import { CONF, BASIS } from "@/lib/data";
import { cn } from "@/lib/utils";

const BASIS_MARK = { published: "实", deal: "实", spot: "实", estimate: "估", inferred: "推" };

export function BasisMark({ basis, conf }) {
  const c = CONF[conf];
  return (
    <span className="ml-1 inline-flex size-4 items-center justify-center rounded text-[10px] font-semibold leading-none align-[2px]"
      style={{ color: c?.color, background: c?.bg }} title={BASIS[basis]}>
      {BASIS_MARK[basis] || "实"}
    </span>
  );
}

/* 区间条：以中值为中心的对数刻度，左右各到 ×½ 与 ×2。条越长 = 不确定性越大 */
export function RangeBar({ lo, hi, mid, conf, className }) {
  const c = CONF[conf];
  const W = 64, H = 8, X = (v) => W / 2 + Math.max(-1, Math.min(1, Math.log2(v / mid))) * (W / 2 - 3);
  const point = !(hi > lo);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={cn("inline-block overflow-visible", className)} aria-hidden>
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--grid)" strokeWidth="2" strokeLinecap="round" />
      {!point && <rect x={X(lo)} y={1} width={Math.max(2, X(hi) - X(lo))} height={H - 2} rx={3} fill={c.color} opacity=".3" />}
      <circle cx={X(mid)} cy={H / 2} r="3" fill={c.color} />
    </svg>
  );
}

export function ConfidenceLegend({ className }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-2", className)}>
      <span className="font-medium text-ink">置信度</span>
      {Object.entries(CONF).map(([k, c]) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: c.color }} />
          <b className="font-medium" style={{ color: c.color }}>{c.label}</b>
          <span className="text-muted">{c.desc}</span>
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <RangeBar lo={0.7} hi={1.4} mid={1} conf="mid" />
        <span className="text-muted">区间条越长，不确定性越大</span>
      </span>
      <span className="inline-flex items-center gap-2 text-muted">
        <span><BasisMark basis="published" conf="hi" /> 实测</span>
        <span><BasisMark basis="estimate" conf="mid" /> 调研估算</span>
        <span><BasisMark basis="inferred" conf="lo" /> 推算</span>
      </span>
    </div>
  );
}
