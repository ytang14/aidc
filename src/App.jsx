import { useEffect, useState } from "react";
import { Moon, Sun, Activity, RefreshCw } from "lucide-react";
import { loadAll } from "@/lib/data";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Kpis } from "@/components/Kpis";
import { LtaMatrix } from "@/components/LtaMatrix";
import { Trend, Spread, TermCurves } from "@/components/Charts";
import { Payback } from "@/components/Payback";
import { Routes, Headlines, Details } from "@/components/Details";

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches));
  const toggle = () => {
    const t = dark ? "light" : "dark";
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("theme", t); } catch (e) {}
    setDark(!dark);
  };
  return (
    <button type="button" onClick={toggle} aria-label={dark ? "切换到亮色" : "切换到暗色"}
      className="inline-flex size-8 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink">
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export default function App() {
  const [M, setM] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { loadAll().then((m) => (m.D ? setM(m) : setErr("找不到 data/latest.json"))).catch((e) => setErr(String(e))); }, []);
  const t = M && new Date(M.D.updated_at);
  return (
    <TooltipProvider>
      <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-ink text-panel"><Activity className="size-4" aria-hidden /></span>
            <div className="leading-tight">
              <h1 className="text-[15px] font-semibold tracking-tight">算力行情台</h1>
              <p className="text-[11px] text-muted">中美 GPU 租赁 · 采购 · 长协 · 监管</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {M && (
              <div className="hidden items-center gap-2 text-xs text-ink-2 sm:flex">
                <RefreshCw className="size-3.5 text-muted" aria-hidden />
                <span className="num">{t.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })} 北京</span>
                {M.FX && <span className="num rounded-md bg-panel-2 px-2 py-0.5">USD/CNY {M.FX}</span>}
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-[1480px] gap-5 px-4 pt-5 pb-16 sm:px-6">
        {err && <p className="text-bad">数据加载失败：{err}</p>}
        {!M && !err && <p className="text-muted">加载中…</p>}
        {M && <>
          <Kpis M={M} />
          <LtaMatrix M={M} />
          <div className="grid gap-5 lg:grid-cols-2"><Trend M={M} /><Spread M={M} /></div>
          <TermCurves M={M} />
          <Payback M={M} />
          <div className="grid gap-5 lg:grid-cols-2"><Routes M={M} /><Headlines M={M} /></div>
          <Details M={M} />
          <footer className="pt-2 text-center text-xs text-muted">每个数字都标注了来源和日期 · 每天北京时间 07:30 自动刷新</footer>
        </>}
      </main>
    </TooltipProvider>
  );
}
