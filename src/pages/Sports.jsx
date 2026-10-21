import { useEffect, useRef, useState } from "react";
import { isFirebaseConfigured } from "../firebase/firebase";
import { useLiveVideos, youtube } from "../features/sports/useLiveVideos";
import { YoutubePlayer } from "../features/sports/YoutubePlayer";
import { useGameRoom, useSportsUser } from "../features/sports/useSports";
import { useAuthStore } from "../store/useAuthStore";
import "./Sports.css";

const errorMessages = {
  "missing-key":
    "YouTube API 키가 설정되지 않아 실제 방송을 조회할 수 없습니다.",
  permission:
    "YouTube API 접근 권한이 없습니다. API 활성화와 키의 사이트 제한을 확인해 주세요.",
  quota:
    "YouTube API 할당량을 초과했습니다. 할당량 복구 후 자동으로 다시 조회합니다.",
  network:
    "라이브 검색 서버에 연결하지 못했습니다. 네트워크 연결을 확인해 주세요.",
  "api-error": "라이브 검색 요청을 처리하지 못했습니다.",
  "channel-unavailable":
    "WBSC 공식 채널을 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.",
};
const viewersLabel = (value) =>
  value === null
    ? "시청자 수 비공개"
    : `시청자 ${BigInt(value).toLocaleString("ko-KR")}명`;

function GameRoom({ game, user }) {
  const [broadcastStatus, setBroadcastStatus] = useState("live");
  const [verifyError, setVerifyError] = useState("");
  const { messages, viewerCount, error, connected, send } = useGameRoom(
    game.id,
    user,
    true,
  );
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const onGoogleLogin = useAuthStore((state) => state.onGoogleLogin);
  const list = useRef(null);
  const shouldScroll = useRef(true);
  useEffect(() => {
    let active = true;
    const timer = setInterval(async () => {
      try {
        const result = await youtube.verify(game.id);
        if (active) {
          setBroadcastStatus((previous) =>
            previous === "ended" && result.status === "live"
              ? previous
              : result.status,
          );
          setVerifyError("");
        }
      } catch (error) {
        if (active)
          setVerifyError(errorMessages[error.code] || errorMessages.network);
      }
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [game.id]);

  useEffect(() => {
    if (shouldScroll.current && list.current)
      list.current.scrollTop = list.current.scrollHeight;
  }, [messages]);

  const login = async () => {
    setActionError("");
    setLoggingIn(true);
    try {
      const loggedIn = await onGoogleLogin();
      if (!loggedIn) throw new Error("login-failed");
    } catch {
      setActionError("로그인을 완료하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setLoggingIn(false);
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setActionError("");
    try {
      await send(text);
      setText("");
      shouldScroll.current = true;
    } catch {
      setActionError(
        "전송하지 못했습니다. 연결을 확인한 후 다시 시도해 주세요.",
      );
    } finally {
      setSending(false);
    }
  };
  const canChat = Boolean(user) && connected;

  return (
    <div className="sports-room">
      <section className="sports-watch" aria-label="선택한 경기 중계">
        <div className="sports-player">
          {broadcastStatus === "live" ? (
            <YoutubePlayer
              key={game.id}
              videoId={game.id}
              onEnded={() => setBroadcastStatus("ended")}
            />
          ) : (
            <div className="sports-player-empty">
              <span className="sports-baseball" aria-hidden="true">
                ⚾
              </span>
              <h3>
                {broadcastStatus === "ended"
                  ? "방송이 종료되었습니다"
                  : "시청할 수 없는 방송입니다"}
              </h3>
              <p>다른 라이브 방송을 선택하거나 원본 영상에서 확인해 주세요.</p>
            </div>
          )}
        </div>
        <div className="sports-match-info">
          <div>
            <span className={`sports-badge ${broadcastStatus}`}>
              {verifyError
                ? "상태 확인 실패"
                : broadcastStatus === "live"
                  ? "LIVE"
                  : broadcastStatus === "ended"
                    ? "종료"
                    : "재생 불가"}
            </span>
            <span className="sports-muted"> {game.channel}</span>
          </div>
          <h2>{game.title}</h2>
          <p>
            {viewersLabel(game.viewers)} ·{" "}
            <a
              href={game.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sports-original"
            >
              YouTube 원본 영상 ↗
            </a>
          </p>
          {verifyError && (
            <p className="sports-error" role="status">
              {verifyError}
            </p>
          )}
        </div>
      </section>
      <aside className="sports-chat" aria-label="경기별 실시간 채팅">
        <div className="sports-chat-heading">
          <h3>응원 채팅</h3>
          <span className="sports-muted">
            {canChat ? `${viewerCount}명 접속` : "연결 대기"}
          </span>
        </div>
        <p className="sports-chat-notice">
          같은 경기를 보는 팬들과 응원해 보세요. 서로 존중하는 대화를 나눠
          주세요.
        </p>
        <div
          className="sports-messages"
          ref={list}
          role="log"
          aria-label="채팅 메시지"
          aria-live="polite"
          aria-relevant="additions"
          onScroll={() => {
            const el = list.current;
            shouldScroll.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {messages.length === 0 && (
            <div className="sports-chat-empty">
              <span aria-hidden="true">💬</span>
              <p>
                {!isFirebaseConfigured
                  ? "Firebase 설정이 없어 채팅에 연결할 수 없습니다."
                  : !user
                    ? "로그인하고 함께 응원해 보세요."
                    : connected
                      ? "첫 응원 메시지를 남겨 보세요!"
                      : "채팅방에 연결하고 있습니다."}
              </p>
            </div>
          )}
          {messages.map((message) => (
            <div
              className={`sports-message ${message.uid === user?.uid ? "mine" : ""}`}
              key={message.id}
            >
              <div>
                <strong>{message.name}</strong>
                <time>
                  {message.createdAt?.toDate().toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }) || "전송 중"}
                </time>
              </div>
              <p>{message.text}</p>
            </div>
          ))}
        </div>
        {(error || actionError) && (
          <p className="sports-error" role="alert">
            {actionError || error}
          </p>
        )}
        {!user && isFirebaseConfigured && (
          <button className="sports-login" onClick={login} disabled={loggingIn}>
            {loggingIn ? "로그인 중…" : "Google 로그인하고 채팅 참여"}
          </button>
        )}
        <form className="sports-chat-form" onSubmit={submit}>
          <label className="sports-sr-only" htmlFor="sports-message">
            응원 메시지
          </label>
          <div>
            <input
              id="sports-message"
              autoComplete="off"
              value={text}
              maxLength={300}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                canChat
                  ? "응원 메시지를 입력하세요"
                  : "채팅 연결 후 참여할 수 있어요"
              }
              disabled={!canChat || sending}
            />
            <button
              type="submit"
              disabled={!canChat || sending || !text.trim()}
            >
              {sending ? "전송 중" : "전송"}
            </button>
          </div>
          <small>
            {text.length}/300 · 로그인한 채팅 참여자 수를 표시합니다.
          </small>
        </form>
      </aside>
    </div>
  );
}

function VideoCards({ videos, selectedId, onSelect, ranked = false }) {
  return (
    <div className="sports-game-grid">
      {videos.map((video, index) => (
        <button
          type="button"
          key={video.id}
          className={`sports-game-card ${selectedId === video.id ? "selected" : ""}`}
          aria-pressed={selectedId === video.id}
          onClick={() => onSelect(video)}
        >
          <div className="sports-card-top">
            <span className="sports-badge live">
              {ranked ? `TOP ${index + 1}` : "LIVE"}
            </span>
            <span>{viewersLabel(video.viewers)}</span>
          </div>
          <img
            className="sports-thumbnail"
            src={video.thumbnail}
            alt=""
            loading="lazy"
          />
          <h3 className="sports-video-title">{video.title}</h3>
          <div className="sports-card-bottom">
            <span>{video.channel}</span>
            <span>{selectedId === video.id ? "시청 중" : "시청하기 →"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

export function Sports() {
  const [scope, setScope] = useState("all");
  const { videos, loading, error, checkedAt, truncated } = useLiveVideos(scope);
  const user = useSportsUser();
  const [selection, setSelection] = useState(null);
  const selected = selection
    ? videos.find((video) => video.id === selection.id) || selection
    : videos[0];
  const top = videos.filter((video) => video.viewers !== null).slice(0, 5);
  return (
    <main className="sports-page">
      <div className="sports-inner">
        <div className="sports-title-row">
          <div>
            <p className="sports-eyebrow">PLAY TOGETHER</p>
            <h1>
              스포츠 <span>야구</span>
            </h1>
            <p className="sports-muted">
              지금 열리는 야구 라이브, 함께 나누는 응원
            </p>
          </div>
          <span className="sports-live-count">
            <span /> 검색된 라이브 {videos.length}개
          </span>
        </div>
        <div className="sports-toolbar">
          <div className="sports-filters" aria-label="채널 필터">
            {[
              ["all", "전체 채널"],
              ["wbsc", "WBSC 공식 야구"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={scope === value}
                onClick={() => {
                  setScope(value);
                  setSelection(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="sports-muted">
            5분 캐시 · 자동 갱신
            {checkedAt
              ? ` · 확인 ${new Date(checkedAt).toLocaleTimeString("ko-KR")}`
              : ""}
          </p>
        </div>
        {!isFirebaseConfigured && (
          <p className="sports-setup-notice" role="status">
            Firebase 설정이 없어 응원 채팅을 사용할 수 없습니다. 영상 검색과
            시청은 별도로 이용할 수 있습니다.
          </p>
        )}
        {loading ? (
          <p className="sports-loading" role="status">
            실제 라이브 방송을 검색하고 공개·임베드·방송 상태를 확인하고
            있습니다…
          </p>
        ) : error ? (
          <p className="sports-setup-notice" role="alert">
            {errorMessages[error] || errorMessages["api-error"]}
          </p>
        ) : (
          <>
            {selected && (
              <GameRoom
                key={`${selected.id}:${user?.uid || "guest"}`}
                game={selected}
                user={user}
              />
            )}
            {!videos.length ? (
              <p className="sports-loading" role="status">
                현재 확인된 야구 경기 라이브가 없습니다. 예시 방송은 표시하지
                않습니다.
              </p>
            ) : (
              <>
                <section className="sports-schedule" aria-label="인기 TOP 5">
                  <div className="sports-schedule-heading">
                    <h2>
                      인기 TOP 5 <span>{top.length}개</span>
                    </h2>
                  </div>
                  <p className="sports-muted sports-sample-note">
                    검색된 방송 중 공개된 동시 시청자 수 기준입니다. 시청자 수
                    비공개 방송은 순위에서 제외합니다.
                  </p>
                  {top.length ? (
                    <VideoCards
                      videos={top}
                      selectedId={selected?.id}
                      onSelect={setSelection}
                      ranked
                    />
                  ) : (
                    <p className="sports-loading">
                      시청자 수를 공개한 방송이 없어 순위를 표시할 수 없습니다.
                    </p>
                  )}
                </section>
                <section
                  className="sports-schedule"
                  aria-label="전체 라이브 목록"
                >
                  <div className="sports-schedule-heading">
                    <h2>
                      전체 라이브 목록 <span>{videos.length}개</span>
                    </h2>
                  </div>
                  <VideoCards
                    videos={videos}
                    selectedId={selected?.id}
                    onSelect={setSelection}
                  />
                </section>
              </>
            )}
          </>
        )}
        <p className="sports-source-note">
          출처: YouTube Data API v3 · 공개/임베드 허용 및 실제 방송 시작·미종료
          조건을 확인한 검색 결과입니다. 제목·태그로 명확한
          게임·하이라이트·해설·분석 방송을 제외합니다. 영상 내용과 지역별 시청
          가능 여부까지 보장하지는 않습니다.
          {truncated
            ? " 검색 한도(150개 후보)에 도달하여 일부 방송이 누락될 수 있습니다."
            : " YouTube 검색에 노출된 결과이며 모든 야구 중계를 보장하지 않습니다."}
        </p>
      </div>
    </main>
  );
}
