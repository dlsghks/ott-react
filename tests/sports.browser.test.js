import { test } from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { chromium } from "playwright-core";

const baseUrl = process.env.SPORTS_BASE_URL || "http://127.0.0.1:5173";
const launch = () =>
  chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
const videos = Array.from({ length: 6 }, (_, i) => ({
  id: `baseball00${i}`,
  snippet: {
    title: `LIVE Baseball 경기 ${i + 1}`,
    channelId: i === 0 ? "wbsc-channel" : "other-channel",
    channelTitle: i === 0 ? "WBSC" : "Baseball TV",
    liveBroadcastContent: "live",
    description: "Baseball game",
  },
  status: { privacyStatus: "public", embeddable: true },
  liveStreamingDetails: {
    actualStartTime: "2026-10-01T10:00:00Z",
    concurrentViewers: String(600 - i * 100),
  },
}));

async function setupMock(page, mode = "success") {
  await page.route(
    "**/src/features/sports/useLiveVideos.js*",
    async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      assert.ok(
        body.includes("import.meta.env.VITE_YOUTUBE_API_KEY"),
        "Use Vite development server for mock UI tests",
      );
      await route.fulfill({
        response,
        body: body.replace(
          "import.meta.env.VITE_YOUTUBE_API_KEY",
          '"browser-fixture-only"',
        ),
      });
    },
  );
  await page.addInitScript(() => {
    // Stub only the third-party player. This is NOT a real playback test.
    window.YT = {
      Player: class {
        constructor(element, options) {
          this.element = element;
          window.__endMockVideo = () =>
            options.events.onStateChange({ data: 0 });
          const marker = document.createElement("div");
          marker.dataset.testVideoId = options.videoId;
          marker.textContent = "Mock player";
          element.append(marker);
        }
        destroy() {
          this.element.remove();
        }
      },
    };
  });
  await page.route(
    "https://www.googleapis.com/youtube/v3/**",
    async (route) => {
      const url = new URL(route.request().url());
      const resource = url.pathname.split("/").at(-1);
      let data = { items: [] },
        status = 200;
      if (mode === "quota") {
        status = 403;
        data = { error: { errors: [{ reason: "quotaExceeded" }] } };
      } else if (mode === "permission") {
        status = 403;
        data = { error: { errors: [{ reason: "forbidden" }] } };
      } else if (mode === "success") {
        if (resource === "channels")
          data = {
            items: [{ id: "wbsc-channel", snippet: { customUrl: "@WBSC" } }],
          };
        if (resource === "search")
          data = {
            items: (url.searchParams.has("channelId")
              ? videos.slice(0, 1)
              : videos
            ).map((v) => ({ id: { videoId: v.id } })),
          };
        if (resource === "videos")
          data = {
            items: videos.filter((v) =>
              url.searchParams.get("id").split(",").includes(v.id),
            ),
          };
      }
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    },
  );
  await page.route("https://i.ytimg.com/**", (route) => route.abort());
}

test("unconfigured development app: explicit missing-key state, no fake games, direct access and reload", async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/sports`);
    await page
      .getByRole("alert")
      .filter({ hasText: "YouTube API 키가 설정되지 않아" })
      .waitFor();
    assert.equal(await page.locator(".sports-game-card").count(), 0);
    assert.equal(
      (await page.locator(".header-left ul a").allTextContents()).at(-1),
      "스포츠",
    );
    await page.reload();
    await page.getByRole("heading", { name: "스포츠 야구" }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test("MOCK API: TOP 5, all six, video-room selection, original links, WBSC filter and responsive layouts", async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let searchRequests = 0;
    page.on("request", (request) => {
      if (
        request
          .url()
          .startsWith("https://www.googleapis.com/youtube/v3/search?")
      )
        searchRequests++;
    });
    await page.clock.install();
    await setupMock(page);
    await page.goto(`${baseUrl}/sports`);
    const top = page.getByRole("region", { name: "인기 TOP 5" }),
      all = page.getByRole("region", { name: "전체 라이브 목록" });
    await all.locator(".sports-game-card").last().waitFor();
    assert.equal(await top.locator(".sports-game-card").count(), 5);
    assert.equal(await all.locator(".sports-game-card").count(), 6);
    await all.locator(".sports-game-card").nth(2).click();
    await page.locator('[data-test-video-id="baseball002"]').waitFor();
    assert.equal(
      await page
        .getByRole("link", { name: "YouTube 원본 영상 ↗" })
        .getAttribute("href"),
      "https://www.youtube.com/watch?v=baseball002",
    );
    assert.ok(
      await page.getByRole("textbox", { name: "응원 메시지" }).isDisabled(),
    );
    await page
      .getByRole("button", { name: "WBSC 공식 야구", exact: true })
      .click();
    await page.getByRole("heading", { name: "전체 라이브 목록 1개" }).waitFor();
    assert.equal(await all.locator(".sports-game-card").count(), 1);
    assert.equal(await top.locator(".sports-game-card").count(), 1);
    const beforeRefresh = searchRequests;
    const refreshed = page.waitForResponse((response) =>
      response
        .url()
        .startsWith("https://www.googleapis.com/youtube/v3/search?"),
    );
    await page.clock.fastForward(300001);
    await refreshed;
    assert.equal(
      searchRequests,
      beforeRefresh + 1,
      "automatic refresh after five-minute cache expiry",
    );
    await page.evaluate(() => window.__endMockVideo());
    await page
      .getByRole("heading", { name: "방송이 종료되었습니다" })
      .waitFor();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => ({
        overflows: document.documentElement.scrollWidth > window.innerWidth,
        header: document.querySelector("header").getBoundingClientRect().bottom,
        title: document.querySelector(".sports-eyebrow").getBoundingClientRect()
          .top,
      }));
      assert.equal(layout.overflows, false, `${width}px overflow`);
      assert.ok(layout.title >= layout.header, `${width}px header overlap`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

for (const [mode, label] of [
  ["empty", "현재 확인된 야구 경기 라이브가 없습니다."],
  ["quota", "YouTube API 할당량을 초과했습니다."],
  ["permission", "YouTube API 접근 권한이 없습니다."],
]) {
  test(`MOCK API: ${mode} has distinct user feedback and no fabricated broadcasts`, async () => {
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await setupMock(page, mode);
      await page.goto(`${baseUrl}/sports`);
      await page.getByText(label, { exact: false }).waitFor();
      assert.equal(await page.locator(".sports-game-card").count(), 0);
    } finally {
      await browser.close();
    }
  });
}
