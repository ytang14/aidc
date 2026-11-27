// Vercel Cron 每天调用一次（见 vercel.json），转发为 GitHub Actions 的手动运行。
// 需要的 Vercel 环境变量：
//   CRON_SECRET        随机字符串；Vercel 调用定时任务时会带上 Authorization: Bearer <CRON_SECRET>
//   GH_DISPATCH_TOKEN  GitHub 细粒度令牌，只授权 ytang14/aidc，权限 Actions: Read and write
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) return res.status(503).json({ ok: false, error: "GH_DISPATCH_TOKEN not set" });
  const r = await fetch("https://api.github.com/repos/ytang14/aidc/actions/workflows/refresh.yml/dispatches", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "compute-desk-cron",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  if (r.status !== 204) return res.status(502).json({ ok: false, status: r.status, body: await r.text() });
  return res.status(200).json({ ok: true, dispatched: new Date().toISOString() });
}
