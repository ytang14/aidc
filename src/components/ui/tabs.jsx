import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
export const Tabs = T.Root;
export const TabsContent = ({ className, ...p }) => <T.Content className={cn("outline-none", className)} {...p} />;
export function TabsList({ className, ...p }) {
  return <T.List className={cn("inline-flex flex-wrap items-center gap-1 rounded-lg bg-panel-2 p-1", className)} {...p} />;
}
export function TabsTrigger({ className, ...p }) {
  return <T.Trigger className={cn("rounded-md px-3 py-1 text-xs font-medium text-ink-2 transition-colors hover:text-ink data-[state=active]:bg-panel data-[state=active]:text-ink data-[state=active]:shadow-sm", className)} {...p} />;
}
