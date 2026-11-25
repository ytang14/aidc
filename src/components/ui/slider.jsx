import * as S from "@radix-ui/react-slider";
export function Slider({ label, value, onChange, min, max, step, format }) {
  return (
    <div className="flex min-w-[220px] flex-1 items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-ink-2">{label}</span>
      <S.Root className="relative flex h-5 flex-1 touch-none items-center select-none" value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} aria-label={label}>
        <S.Track className="relative h-1.5 grow rounded-full bg-panel-2"><S.Range className="absolute h-full rounded-full bg-us" /></S.Track>
        <S.Thumb className="block size-4 rounded-full border-2 border-us bg-panel shadow focus-visible:outline-2" />
      </S.Root>
      <output className="num w-14 text-right text-sm text-ink">{format(value)}</output>
    </div>
  );
}
