// Display placeholders only. Real schedules and streams are supplied by sportsGames.
export const sampleGames = [
  ["lg-doosan", "LG", "두산", "잠실"],
  ["kia-samsung", "KIA", "삼성", "광주"],
  ["lotte-hanwha", "롯데", "한화", "사직"],
  ["ssg-kt", "SSG", "KT", "문학"],
  ["nc-kiwoom", "NC", "키움", "창원"],
  ["international", "대한민국", "일본", "국제 경기"],
].map(([id, away, home, venue]) => ({
  id: `sample-${id}`,
  away,
  home,
  venue,
  league: "예시 경기",
  status: "sample",
}));

export function streamSource(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (["www.youtube.com", "youtube.com", "youtu.be"].includes(url.hostname)) {
      const id =
        url.hostname === "youtu.be"
          ? url.pathname.slice(1)
          : url.pathname.startsWith("/embed/")
            ? url.pathname.split("/")[2]
            : url.searchParams.get("v");
      if (!/^[\w-]{11}$/.test(id || "")) return null;
      return {
        type: "embed",
        url: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
    // Native HTML5 video; arbitrary external websites are never embedded.
    if (/\.(mp4|webm|m3u8)$/i.test(url.pathname))
      return { type: "video", url: url.href };
  } catch {
    /* Unconfigured/invalid sources are shown as unavailable. */
  }
  return null;
}

export function normalizeGame(id, data) {
  if (typeof data.home !== "string" || typeof data.away !== "string")
    return null;
  if (!["live", "scheduled", "ended"].includes(data.status)) return null;
  return {
    id,
    home: data.home.slice(0, 40),
    away: data.away.slice(0, 40),
    status: data.status,
    league: typeof data.league === "string" ? data.league.slice(0, 40) : "야구",
    venue: typeof data.venue === "string" ? data.venue.slice(0, 80) : "",
    inning: typeof data.inning === "string" ? data.inning.slice(0, 30) : "",
    homeScore:
      Number.isInteger(data.homeScore) && data.homeScore >= 0
        ? data.homeScore
        : "–",
    awayScore:
      Number.isInteger(data.awayScore) && data.awayScore >= 0
        ? data.awayScore
        : "–",
    streamUrl: typeof data.streamUrl === "string" ? data.streamUrl : "",
  };
}
