import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CACHE_MS,
  createYoutubeClient,
  normalizeLiveVideo,
  rankVideos,
} from "./youtube.js";
const fixture = (id = "abcdefghijk", overrides = {}) => ({
  id,
  snippet: {
    title: "LIVE Baseball Japan vs Korea",
    channelId: "official",
    channelTitle: "WBSC",
    liveBroadcastContent: "live",
    description: "Baseball tournament",
  },
  status: { privacyStatus: "public", embeddable: true },
  liveStreamingDetails: {
    actualStartTime: "2026-10-01T10:00:00Z",
    concurrentViewers: "500",
  },
  ...overrides,
});
const ok = (data) => ({ ok: true, status: 200, json: async () => data });

test("actual live criteria reject ended, upcoming, private, non-embeddable and missing videos", () => {
  const valid = fixture();
  assert.ok(normalizeLiveVideo(valid, "official").wbsc);
  for (const value of [
    {},
    fixture("short"),
    fixture(undefined, {
      status: { privacyStatus: "private", embeddable: true },
    }),
    fixture(undefined, {
      status: { privacyStatus: "public", embeddable: false },
    }),
    fixture(undefined, {
      liveStreamingDetails: {
        actualEndTime: "2026-10-01T11:00:00Z",
        actualStartTime: "2026-10-01T10:00:00Z",
      },
    }),
    fixture(undefined, { liveStreamingDetails: {} }),
    fixture(undefined, {
      snippet: { ...valid.snippet, liveBroadcastContent: "upcoming" },
    }),
  ])
    assert.equal(normalizeLiveVideo(value), null);
});
test("explicit games, highlights, commentary and non-baseball are excluded", () => {
  for (const title of [
    "Baseball Highlights Live",
    "야구 입중계",
    "MLB The Show LIVE Baseball",
    "Baseball simulation",
    "Baseball analysis live",
    "Baseball watch along",
    "Softball live",
    "Baseball radio broadcast",
    "Baseball game플레이 해설",
    "Football live",
  ]) {
    assert.equal(
      normalizeLiveVideo(
        fixture(undefined, { snippet: { ...fixture().snippet, title } }),
      ),
      null,
      title,
    );
  }
});
test("viewer counts preserve unknown and zero; ranking supports large integers without fabrication", () => {
  assert.equal(
    normalizeLiveVideo(
      fixture(undefined, {
        liveStreamingDetails: { actualStartTime: "2026-10-01T10:00:00Z" },
      }),
    ).viewers,
    null,
  );
  const videos = [
    { id: "a", viewers: null },
    { id: "b", viewers: "0" },
    { id: "c", viewers: "9999999999999999999" },
    { id: "d", viewers: "50" },
  ];
  assert.deepEqual(
    rankVideos(videos).map((v) => v.id),
    ["c", "d", "b", "a"],
  );
});
test("search uses required live parameters, deduplicates and revalidates results with videos.list", async () => {
  const calls = [];
  const client = createYoutubeClient({
    apiKey: "unit-test-only",
    fetcher: async (url, options) => {
      const u = new URL(url);
      calls.push(u);
      assert.equal(options.headers["X-Goog-Api-Key"], "unit-test-only");
      assert.equal(u.searchParams.has("key"), false);
      return ok(
        u.pathname.endsWith("/search")
          ? {
              items: [
                { id: { videoId: "abcdefghijk" } },
                { id: { videoId: "abcdefghijk" } },
                { id: { videoId: "lmnopqrstuv" } },
              ],
            }
          : {
              items: [
                fixture(),
                fixture("lmnopqrstuv", {
                  status: { privacyStatus: "private", embeddable: true },
                }),
              ],
            },
      );
    },
  });
  const result = await client.list();
  assert.equal(result.videos.length, 1);
  const params = calls[0].searchParams;
  for (const [key, value] of Object.entries({
    q: "야구|baseball",
    type: "video",
    eventType: "live",
    videoEmbeddable: "true",
  }))
    assert.equal(params.get(key), value);
  assert.equal(
    calls[1].searchParams.get("part"),
    "snippet,status,liveStreamingDetails",
  );
  assert.equal(calls[1].searchParams.get("id"), "abcdefghijk,lmnopqrstuv");
});
test("5-minute cache and concurrent request coalescing avoid repeated search", async () => {
  let clock = 0,
    calls = 0;
  const client = createYoutubeClient({
    apiKey: "unit-test-only",
    now: () => clock,
    fetcher: async () => {
      calls++;
      return ok({ items: [] });
    },
  });
  await Promise.all([client.list(), client.list()]);
  assert.equal(calls, 1);
  clock = CACHE_MS - 1;
  await client.list();
  assert.equal(calls, 1);
  clock = CACHE_MS;
  await client.list();
  assert.equal(calls, 2);
});
test("WBSC filter resolves exact handle and enforces returned channel ID", async () => {
  const calls = [];
  const client = createYoutubeClient({
    apiKey: "unit-test-only",
    fetcher: async (url) => {
      const u = new URL(url);
      calls.push(u);
      if (u.pathname.endsWith("/channels"))
        return ok({
          items: [{ id: "official", snippet: { customUrl: "@WBSC" } }],
        });
      if (u.pathname.endsWith("/search"))
        return ok({
          items: [
            { id: { videoId: "abcdefghijk" } },
            { id: { videoId: "lmnopqrstuv" } },
          ],
        });
      return ok({
        items: [
          fixture(),
          fixture("lmnopqrstuv", {
            snippet: { ...fixture().snippet, channelId: "impersonator" },
          }),
        ],
      });
    },
  });
  const result = await client.list("wbsc");
  assert.equal(result.videos.length, 1);
  assert.ok(result.videos[0].wbsc);
  assert.equal(calls[0].searchParams.get("forHandle"), "@WBSC");
  assert.equal(calls[1].searchParams.get("channelId"), "official");
});
test("error states distinguish missing key, quota, permission, API and network; never leak raw errors", async () => {
  await assert.rejects(createYoutubeClient({}).list(), { code: "missing-key" });
  for (const [status, reason, code] of [
    [403, "quotaExceeded", "quota"],
    [403, "forbidden", "permission"],
    [400, "keyInvalid", "permission"],
    [500, "backendError", "api-error"],
    [429, "rateLimitExceeded", "quota"],
  ]) {
    const client = createYoutubeClient({
      apiKey: "unit-test-only",
      fetcher: async () => ({
        ok: false,
        status,
        json: async () => ({
          error: { message: "sensitive", errors: [{ reason }] },
        }),
      }),
    });
    await assert.rejects(
      client.list(),
      (e) => e.code === code && !e.message.includes("sensitive"),
    );
  }
  await assert.rejects(
    createYoutubeClient({
      apiKey: "unit-test-only",
      fetcher: async () => {
        throw new Error("sensitive");
      },
    }).list(),
    { code: "network" },
  );
});
test("pagination is bounded and explicitly reports incomplete discovery", async () => {
  let calls = 0;
  const client = createYoutubeClient({
    apiKey: "unit-test-only",
    maxPages: 2,
    fetcher: async () => {
      calls++;
      return ok({ items: [], nextPageToken: "next" });
    },
  });
  const result = await client.list();
  assert.equal(calls, 2);
  assert.equal(result.truncated, true);
});
test("selected broadcasts distinguish ended from unavailable", async () => {
  const ended = createYoutubeClient({
    apiKey: "unit-test-only",
    fetcher: async () =>
      ok({
        items: [
          fixture(undefined, {
            liveStreamingDetails: { actualEndTime: "2026-10-01T11:00:00Z" },
          }),
        ],
      }),
  });
  assert.equal((await ended.verify("abcdefghijk")).status, "ended");
  const removed = createYoutubeClient({
    apiKey: "unit-test-only",
    fetcher: async () => ok({ items: [] }),
  });
  assert.equal((await removed.verify("abcdefghijk")).status, "unavailable");
});
