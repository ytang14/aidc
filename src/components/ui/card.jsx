import { cn } from "@/lib/utils";
export function Card({ className, ...p }) {
  return <section className={cn("rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow)] min-w-0", className)} {...p} />;
}
export function CardHeader({ title, desc, right, icon: Icon, className }) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
          {Icon && <Icon className="size-4 text-muted" aria-hidden />}{title}
        </h2>
        {desc && <p className="mt-1 max-w-[75ch] text-xs leading-relaxed text-ink-2">{desc}</p>}
      </div>
      {right}
    </div>
  );
}
