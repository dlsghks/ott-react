import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleGames, streamSource, normalizeGame } from "./games.js";

test("six distinct placeholders never claim live broadcasts", () => {
  assert.ok(sampleGames.length >= 5);
  assert.equal(
    new Set(sampleGames.map((game) => game.id)).size,
    sampleGames.length,
  );
  assert.ok(
    sampleGames.every((game) => game.status === "sample" && !game.streamUrl),
  );
});
test("only HTTPS video and validated YouTube IDs can play", () => {
  assert.deepEqual(streamSource("https://youtu.be/abcdefghijk?t=2"), {
    type: "embed",
    url: "https://www.youtube-nocookie.com/embed/abcdefghijk",
  });
  assert.equal(
    streamSource("https://www.youtube.com/watch?v=abcdefghijk").type,
    "embed",
  );
  assert.equal(
    streamSource("https://media.example/live.m3u8?token=test").type,
    "video",
  );
  for (const url of [
    "javascript:alert(1)",
    "http://media.example/live.mp4",
    "https://evil.example/embed/abc",
    "https://youtube.com.evil.example/watch?v=abcdefghijk",
    "https://user:pass@media.example/live.mp4",
    "https://youtu.be/short",
    null,
  ])
    assert.equal(streamSource(url), null);
});
test("reject malformed games and preserve actual live scores", () => {
  assert.equal(
    normalizeGame("1", { home: "A", away: "B", status: "fake" }),
    null,
  );
  assert.equal(
    normalizeGame("1", { home: 1, away: "B", status: "live" }),
    null,
  );
  const game = normalizeGame("1", {
    home: "A",
    away: "B",
    status: "live",
    homeScore: 0,
    awayScore: -2,
  });
  assert.equal(game.homeScore, 0);
  assert.equal(game.awayScore, "–");
});
