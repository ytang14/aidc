# 算力行情台

中美 GPU 租赁、采购、长协（LTA）价格与监管动态的私有看板。

## 结构

- 前端：Vite + React + Tailwind CSS v4，组件用 Radix UI 原语（shadcn/ui 同款写法），图标 lucide-react，图表为手写 SVG。
- 数据：`public/data/latest.json`（当天）、`public/data/history/`（每日存档）、`public/data/backfill.json`（历史走势回填）。
- 刷新：GitHub Actions 每天北京时间 07:30 运行 `refresh.py`（Claude + 联网检索 → 结构化 JSON），提交 `public/data/`，Vercel 自动重新构建部署。
- 访问控制：`middleware.js`（Vercel Routing Middleware）对整站做 Basic Auth，凭据来自 Vercel 环境变量 `DASH_USER` / `DASH_PASS`。页面带 noindex。

```
src/
  lib/data.js          数据加载、换算、长协推算、置信度、回本计算
  components/          KPI、长协矩阵、走势、价差梯、期限曲线、回本、明细
  components/ui/       Card / Tabs / Tooltip / Slider 等基础组件
```

## 置信度

每个价格按「高 / 中 / 低」上色，区间条表示不确定性范围：

- 高：公开报价或合同折算，来源置信度 high，区间不宽
- 中：来源置信度 medium，或区间不宽的调研估算
- 低：推算、来源置信度 low，或区间宽度超过中值 60%

标记：实 = 公开报价 / 合同折算，估 = 调研估算，推 = 没有直接数据时按同系列比价或期限比值推算。

## 本地开发

```
npm ci
npm run dev        # http://localhost:5173
npm run build      # 输出到 dist/
```

## 部署（Vercel）

`vercel.json` 指定了 Vite 构建（`npm run build` → `dist/`），不依赖项目设置里的 Framework 选项。环境变量：`DASH_USER`、`DASH_PASS`。GitHub 仓库 Secrets 需要 `ANTHROPIC_API_KEY`。
