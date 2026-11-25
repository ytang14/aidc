import * as T from "@radix-ui/react-tooltip";
export const TooltipProvider = ({ children }) => <T.Provider delayDuration={80} skipDelayDuration={200}>{children}</T.Provider>;
export function Tip({ content, children, side = "top" }) {
  if (!content) return children;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} collisionPadding={12}
          className="z-50 max-w-[320px] rounded-lg border border-line bg-panel px-3 py-2 text-xs leading-relaxed text-ink shadow-lg data-[state=delayed-open]:animate-in">
          {content}
          <T.Arrow className="fill-[var(--panel)]" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
