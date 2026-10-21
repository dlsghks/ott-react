// Real deployed resources and real API responses only. Never print request headers/errors.
import process from "node:process";
import { chromium, request } from "playwright-core";
const origin = "https://ott-react-eta.vercel.app";
const configuredProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const parsed = configuredProxy ? new URL(configuredProxy) : null;
const proxy = parsed
  ? {
      server: `${parsed.protocol}//${parsed.host}`,
      ...(parsed.username
        ? {
            username: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password),
          }
        : {}),
    }
  : undefined;
const client = await request.newContext({
  proxy,
  ignoreHTTPSErrors: false,
  timeout: 20000,
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
let page;
const report = {
  transport:
    "real resources forwarded through TLS-verifying HTTP client; native Chromium TLS is not bypassed",
  api: [],
  blockedResourceHosts: [],
  runtimeErrors: 0,
};
process.on("unhandledRejection", () => {
  console.error("Production check encountered a sanitized asynchronous error.");
  process.exitCode = 1;
});
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", () => report.runtimeErrors++);
  const patterns = [
    `${origin}/**`,
    "https://www.googleapis.com/youtube/v3/**",
    "https://i.ytimg.com/**",
  ];
  for (const pattern of patterns)
    await page.route(pattern, async (route) => {
      try {
        const response = await client.fetch(route.request());
        const url = new URL(route.request().url());
        if (url.hostname === "www.googleapis.com") {
          const payload = await response.json();
          report.api.push({
            resource: url.pathname.split("/").at(-1),
            status: response.status(),
            items: payload.items?.length || 0,
            reasons: payload.error?.errors?.map((item) => item.reason) || [],
          });
        }
        if (response.status() >= 400)
          report.blockedResourceHosts.push(url.hostname);
        await route.fulfill({ response });
      } catch {
        report.blockedResourceHosts.push(
          new URL(route.request().url()).hostname,
        );
        await route.abort().catch(() => {});
      }
    });
  const loaded = await page.goto(`${origin}/sports`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  report.http = loaded.status();
  await page.getByRole("heading", { name: "스포츠 야구" }).waitFor();
  await page
    .getByText(
      "실제 라이브 방송을 검색하고 공개·임베드·방송 상태를 확인하고 있습니다…",
      { exact: true },
    )
    .waitFor({ state: "hidden", timeout: 40000 });
  const all = page.getByRole("region", { name: "전체 라이브 목록" });
  report.allCount = await all.locator(".sports-game-card").count();
  report.topCount = await page
    .getByRole("region", { name: "인기 TOP 5" })
    .locator(".sports-game-card")
    .count();
  report.feedback = await page
    .locator('[role="alert"],.sports-setup-notice,.sports-loading')
    .allTextContents();
  if (report.allCount > 1) {
    await all.locator(".sports-game-card").nth(1).click();
    report.selectionChanged = (
      await page
        .getByRole("link", { name: "YouTube 원본 영상 ↗" })
        .getAttribute("href")
    )?.startsWith("https://www.youtube.com/watch?v=");
  }
  report.playback =
    "unverified: native browser TLS blocks third-party player resources";
  await page
    .getByRole("button", { name: "WBSC 공식 야구", exact: true })
    .click();
  await page
    .getByText(
      "실제 라이브 방송을 검색하고 공개·임베드·방송 상태를 확인하고 있습니다…",
      { exact: true },
    )
    .waitFor({ state: "hidden", timeout: 40000 });
  report.wbscCount = await page
    .getByRole("region", { name: "전체 라이브 목록" })
    .locator(".sports-game-card")
    .count();
  report.wbscFeedback = await page
    .locator('[role="alert"],.sports-loading')
    .allTextContents();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "스포츠 야구" }).waitFor();
  report.reload = "sports route rendered";
  report.layout = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    report.layout.push({
      width,
      horizontalOverflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
  }
} catch {
  report.failed =
    "Production verification did not complete; sensitive request diagnostics suppressed.";
  process.exitCode = 1;
} finally {
  if (page) await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
  await browser.close().catch(() => {});
  await client.dispose().catch(() => {});
  report.blockedResourceHosts = [...new Set(report.blockedResourceHosts)];
  console.log(JSON.stringify(report, null, 2));
}
