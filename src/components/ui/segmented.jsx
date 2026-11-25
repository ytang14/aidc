import { cn } from "@/lib/utils";
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-panel-2 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("rounded-md px-3 py-1 text-xs font-medium text-ink-2 transition-colors hover:text-ink", value === o.value && "bg-panel text-ink shadow-sm")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
