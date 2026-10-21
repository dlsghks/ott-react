export const CACHE_MS = 5 * 60 * 1000;
export const WBSC_HANDLE = "@WBSC";
export const YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3/";
const VIDEO_ID = /^[\w-]{11}$/;
const EXCLUDED =
  /하이라이트|다시\s?보기|재방송|시뮬레이션|게임\s?중계|게임플레이|해설|분석|입중계|문자\s?중계|컴투스|컴프야|프로야구\s*스피리츠|파워풀\s*프로야구|パワプロ|プロスピ|실시간\s*스코어|라이브\s*스코어|live\s*score|scoreboard|preview|predictions|recap|betting|리액션|중계석|실황\s?게임|highlight|replay|simulation|simulator|gameplay|mlb\s*the\s*show|\be[ -]?baseball\b|pro\s*spirits|watch\s*along|watch\s*party|reaction|commentary|analysis|play[ -]?by[ -]?play|no\s*(?:video|footage)|audio\s*only|radio\s*broadcast|softball|소프트볼/i;
const BASEBALL = /baseball|야구|\bKBO\b|\bMLB\b|\bNPB\b|\bCPBL\b|\bWBSC\b/i;

export class LiveError extends Error {
  constructor(code) {
    super(code);
    this.name = "LiveError";
    this.code = code;
  }
}
export function classifyError(status, payload) {
  const reasons = [
    ...(payload?.error?.errors || []).map((item) => item.reason),
    ...(payload?.error?.details || []).map((item) => item.reason),
  ].filter(Boolean);
  if (
    status === 429 ||
    reasons.some((r) => /quota|dailyLimit|rateLimit/i.test(r))
  )
    return "quota";
  if (
    status === 401 ||
    status === 403 ||
    reasons.some((r) =>
      /keyInvalid|API_KEY|SERVICE_DISABLED|accessNotConfigured|forbidden|ipRefererBlocked/i.test(
        r,
      ),
    )
  )
    return "permission";
  return "api-error";
}
export function normalizeLiveVideo(video, officialChannelId) {
  const { snippet, status, liveStreamingDetails: live } = video;
  if (!VIDEO_ID.test(video.id || "") || !snippet || !status || !live)
    return null;
  if (
    status.privacyStatus !== "public" ||
    status.embeddable !== true ||
    snippet.liveBroadcastContent !== "live" ||
    !live.actualStartTime ||
    !Number.isFinite(Date.parse(live.actualStartTime)) ||
    live.actualEndTime
  )
    return null;
  const title = snippet.title || "";
  if (EXCLUDED.test([title, ...(snippet.tags || [])].join(" "))) return null;
  if (
    !BASEBALL.test(title) &&
    !(
      /\bvs\.?\b| versus | 대 /i.test(title) &&
      BASEBALL.test(snippet.description || "")
    )
  )
    return null;
  const concurrent = /^\d+$/.test(live.concurrentViewers || "")
    ? live.concurrentViewers
    : null;
  return {
    id: video.id,
    title,
    channel: snippet.channelTitle || "",
    channelId: snippet.channelId,
    wbsc: Boolean(officialChannelId && snippet.channelId === officialChannelId),
    viewers: concurrent,
    startedAt: live.actualStartTime,
    watchUrl: `https://www.youtube.com/watch?v=${video.id}`,
    thumbnail: `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
    status: "live",
  };
}
export function rankVideos(videos) {
  return [...videos].sort((a, b) => {
    if (a.viewers === null && b.viewers !== null) return 1;
    if (b.viewers === null && a.viewers !== null) return -1;
    const left = BigInt(a.viewers || "0"),
      right = BigInt(b.viewers || "0");
    return left === right ? a.id.localeCompare(b.id) : left > right ? -1 : 1;
  });
}
export function createYoutubeClient({
  apiKey,
  fetcher = globalThis.fetch,
  now = Date.now,
  maxPages = 3,
}) {
  const cache = new Map(),
    inflight = new Map();
  let officialChannelId;
  async function request(resource, params) {
    if (!apiKey) throw new LiveError("missing-key");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetcher(
        `${YOUTUBE_BASE}${resource}?${new URLSearchParams(params)}`,
        {
          headers: { "X-Goog-Api-Key": apiKey },
          signal: controller.signal,
        },
      );
      let data;
      try {
        data = await response.json();
      } catch {
        throw new LiveError("api-error");
      }
      if (!response.ok)
        throw new LiveError(classifyError(response.status, data));
      return data;
    } catch (error) {
      // Never expose URLs, request headers, raw API messages or API keys.
      throw error instanceof LiveError ? error : new LiveError("network");
    } finally {
      clearTimeout(timer);
    }
  }
  async function resolveOfficialChannel() {
    if (officialChannelId) return officialChannelId;
    const data = await request("channels", {
      part: "id,snippet",
      forHandle: WBSC_HANDLE,
    });
    const channel = data.items?.find(
      (item) =>
        item.snippet?.customUrl?.toLowerCase() === WBSC_HANDLE.toLowerCase(),
    );
    if (!channel?.id) throw new LiveError("channel-unavailable");
    officialChannelId = channel.id;
    return channel.id;
  }
  async function discover(scope) {
    const channelId =
      scope === "wbsc" ? await resolveOfficialChannel() : undefined;
    const ids = new Set();
    let pageToken,
      truncated = false;
    for (let page = 0; page < maxPages; page++) {
      const params = {
        part: "id",
        q: "야구|baseball",
        type: "video",
        eventType: "live",
        videoEmbeddable: "true",
        maxResults: "50",
        order: "viewCount",
        ...(channelId ? { channelId } : {}),
        ...(pageToken ? { pageToken } : {}),
      };
      const data = await request("search", params);
      for (const item of data.items || [])
        if (VIDEO_ID.test(item.id?.videoId || "")) ids.add(item.id.videoId);
      pageToken = data.nextPageToken;
      if (!pageToken) break;
      if (page === maxPages - 1) truncated = true;
    }
    const videos = [];
    const list = [...ids];
    for (let i = 0; i < list.length; i += 50) {
      const data = await request("videos", {
        part: "snippet,status,liveStreamingDetails",
        id: list.slice(i, i + 50).join(","),
        maxResults: "50",
      });
      for (const item of data.items || []) {
        const video = normalizeLiveVideo(item, officialChannelId);
        if (video && (!channelId || video.channelId === channelId))
          videos.push(video);
      }
    }
    return { videos: rankVideos(videos), checkedAt: now(), truncated };
  }
  return {
    async list(scope = "all") {
      if (!apiKey) throw new LiveError("missing-key");
      const previous = cache.get(scope);
      if (previous && now() - previous.checkedAt < CACHE_MS) return previous;
      if (!inflight.has(scope))
        inflight.set(
          scope,
          discover(scope)
            .then((data) => {
              cache.set(scope, data);
              return data;
            })
            .finally(() => inflight.delete(scope)),
        );
      return inflight.get(scope);
    },
    async verify(id) {
      if (!VIDEO_ID.test(id)) throw new LiveError("unavailable");
      const data = await request("videos", {
        part: "snippet,status,liveStreamingDetails",
        id,
      });
      const item = data.items?.[0];
      if (item?.liveStreamingDetails?.actualEndTime) return { status: "ended" };
      return (
        normalizeLiveVideo(item || {}, officialChannelId) || {
          status: "unavailable",
        }
      );
    },
  };
}
