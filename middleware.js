// Vercel Routing Middleware：整站 Basic Auth，只放行带正确用户名/密码的请求。
// 在 Vercel 项目环境变量里设置 DASH_USER 和 DASH_PASS。
export const config = { matcher: "/:path*" };

const BLOCKED = [/^\/src\//, /^\/package(-lock)?\.json$/, /^\/refresh\.py$/, /^\/\.github\//, /\.notes\.md$/, /^\/requirements\.txt$/];

export default function middleware(request) {
  const url = new URL(request.url);
  // 定时接口自己校验 CRON_SECRET，不走 Basic Auth
  if (url.pathname === "/api/refresh") return;
  if (BLOCKED.some((re) => re.test(url.pathname))) {
    return new Response("Not found", { status: 404 });
  }
  const user = process.env.DASH_USER, pass = process.env.DASH_PASS;
  if (!user || !pass) return new Response("Dashboard password not configured", { status: 503 });
  const auth = request.headers.get("authorization") || "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    const [u, ...rest] = atob(encoded).split(":");
    if (u === user && rest.join(":") === pass) return; // 放行到静态文件
  }
  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="compute-dashboard", charset="UTF-8"' },
  });
}
