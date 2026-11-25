import { cn } from "@/lib/utils";
export function RegionBadge({ region, label }) {
  const c = region === "US" ? "text-us border-us/40 bg-us/8" : region === "CN" ? "text-cn border-cn/40 bg-cn/8" : "text-muted border-line";
  return <span className={cn("inline-flex items-center rounded-md border px-1.5 py-px text-[11px] font-medium whitespace-nowrap", c)}>{label}</span>;
}
export function Badge({ className, ...p }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)} {...p} />;
}
