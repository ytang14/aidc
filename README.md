# 算力行情台 · Vercel 版

结构：私有 GitHub 仓库 → GitHub Actions 每天跑 `refresh.py` 更新 `data/` 并提交 → Vercel 检测到提交自动重新部署。
访问控制：`middleware.js` 对整站做用户名/密码校验（Basic Auth），`refresh.py`、研究笔记等不对外。页面带 noindex。

## 步骤
1. 在 GitHub 新建**私有**仓库，把本目录全部内容推上去。
2. 仓库 Settings → Secrets → Actions，添加 `ANTHROPIC_API_KEY`。
3. Vercel 导入该仓库（Framework 选 Other，无需构建命令），在项目环境变量里设置 `DASH_USER`、`DASH_PASS`（用长随机密码）。
4. Actions 页手动运行一次 `daily-refresh` 验证；之后每天北京时间 07:30 自动刷新。

说明：网址本身是公网可达的，靠密码挡住；不是真正的内网。需要更强隔离就用 VPS + Tailscale 方案（见上级目录 README）。
