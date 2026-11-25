import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...a) => twMerge(clsx(a));
export const f2 = (v, d = 2) => Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const usd = (v, d = 2) => (v == null || !isFinite(v) ? "—" : "$" + f2(v, d));
export const pct = (v, d = 1) => (v > 0 ? "+" : "") + f2(v * 100, d) + "%";
export const niceStep = (raw) => { const p = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p; return 10 * p; };
