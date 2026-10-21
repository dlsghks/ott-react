import { useEffect, useRef, useState } from "react";
import { signInWithPopup } from "firebase/auth";
import {
  auth,
  googleProvider,
  isFirebaseConfigured,
} from "../firebase/firebase";
import { sampleGames, streamSource } from "../features/sports/games";
import {
  useGameRoom,
  useSportsGames,
  useSportsUser,
} from "../features/sports/useSports";
import "./Sports.css";

const statusLabel = {
  live: "LIVE",
  scheduled: "예정",
  ended: "종료",
  sample: "예시",
};

function GameRoom({ game, user }) {
  const isSample = game.status === "sample";
  const { messages, viewerCount, error, connected, send } = useGameRoom(
    game.id,
    user,
    !isSample,
  );
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [failedVideo, setFailedVideo] = useState(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const list = useRef(null);
  const shouldScroll = useRef(true);
  const source = streamSource(game.streamUrl);
  const videoError = failedVideo === game.streamUrl;

  useEffect(() => {
    if (shouldScroll.current && list.current)
      list.current.scrollTop = list.current.scrollHeight;
  }, [messages]);

  const login = async () => {
    setActionError("");
    setLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
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
  const canChat = !isSample && Boolean(user) && connected;

  return (
    <div className="sports-room">
      <section className="sports-watch" aria-label="선택한 경기 중계">
        <div className="sports-player" key={game.streamUrl}>
          {source && !videoError && !isSample ? (
            source.type === "embed" ? (
              <iframe
                title={`${game.away} 대 ${game.home} 야구 중계`}
                src={source.url}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <video
                controls
                playsInline
                src={source.url}
                onError={() => setFailedVideo(game.streamUrl)}
                aria-label="야구 경기 중계 영상"
              />
            )
          ) : (
            <div className="sports-player-empty">
              <span className="sports-baseball" aria-hidden="true">
                ⚾
              </span>
              <h3>
                {isSample
                  ? "함께 보는 야구, 함께 나누는 응원"
                  : game.status === "scheduled"
                    ? "경기 시작을 기다리고 있어요"
                    : "중계 영상을 준비하고 있어요"}
              </h3>
              <p>
                {isSample
                  ? "예시 경기입니다. 실제 경기와 공식 중계가 등록되면 이곳에서 시청할 수 있어요."
                  : videoError
                    ? "이 영상을 재생할 수 없습니다. 제공되는 형식과 중계 상태를 확인해 주세요."
                    : "아직 시청 가능한 중계 영상이 등록되지 않았습니다."}
              </p>
            </div>
          )}
        </div>
        <div className="sports-match-info">
          <div>
            <span className={`sports-badge ${game.status}`}>
              {statusLabel[game.status]}
            </span>
            <span className="sports-muted">
              {" "}
              {game.league} · {game.venue}
            </span>
          </div>
          <h2>
            {game.away} <span>vs</span> {game.home}
          </h2>
          <p>
            {isSample
              ? "실제 경기 일정·점수·중계가 아닌 화면 예시입니다."
              : `${game.awayScore} : ${game.homeScore}${game.inning ? ` · ${game.inning}` : ""}`}
          </p>
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
                {isSample
                  ? "실제 경기 등록 후 채팅이 열립니다."
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
                  {message.createdAt
                    ?.toDate()
                    .toLocaleTimeString("ko-KR", {
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
        {!user && isFirebaseConfigured && !isSample && (
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

export function Sports() {
  const { games, loading, error } = useSportsGames();
  const user = useSportsUser();
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const shownGames = games.length ? games : sampleGames;
  const filtered =
    filter === "live"
      ? shownGames.filter((game) => game.status === "live")
      : shownGames;
  const selected =
    filtered.find((game) => game.id === selectedId) || filtered[0];
  const liveCount = games.filter((game) => game.status === "live").length;

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
              경기의 모든 순간, 함께 응원하는 즐거움
            </p>
          </div>
          <span className="sports-live-count">
            <span /> 실시간 {liveCount}경기
          </span>
        </div>
        {(error || !isFirebaseConfigured) && (
          <p className="sports-setup-notice" role="status">
            {error ||
              "아직 실시간 서비스가 연결되지 않았습니다. 아래는 예시 경기이며 중계·채팅은 제공되지 않습니다."}
          </p>
        )}
        {loading ? (
          <p className="sports-loading" role="status">
            경기 목록을 불러오고 있습니다…
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
            <section className="sports-schedule" aria-label="야구 경기 목록">
              <div className="sports-schedule-heading">
                <h2>
                  야구 경기 <span>{filtered.length}</span>
                </h2>
                <div className="sports-filters">
                  <button
                    aria-pressed={filter === "all"}
                    onClick={() => setFilter("all")}
                  >
                    전체
                  </button>
                  <button
                    aria-pressed={filter === "live"}
                    onClick={() => setFilter("live")}
                  >
                    LIVE
                  </button>
                </div>
              </div>
              {!games.length && (
                <p className="sports-muted sports-sample-note">
                  아래 6개 경기는 화면 예시입니다. 실제 일정이나 생중계 여부를
                  나타내지 않습니다.
                </p>
              )}
              {filtered.length ? (
                <div className="sports-game-grid">
                  {filtered.map((game) => (
                    <button
                      key={game.id}
                      className={`sports-game-card ${selected?.id === game.id ? "selected" : ""}`}
                      aria-pressed={selected?.id === game.id}
                      onClick={() => setSelectedId(game.id)}
                    >
                      <div className="sports-card-top">
                        <span className={`sports-badge ${game.status}`}>
                          {statusLabel[game.status]}
                        </span>
                        <span>{game.league}</span>
                      </div>
                      <div className="sports-teams">
                        <strong>{game.away}</strong>
                        <span>
                          {game.status === "sample"
                            ? "VS"
                            : `${game.awayScore} : ${game.homeScore}`}
                        </span>
                        <strong>{game.home}</strong>
                      </div>
                      <div className="sports-card-bottom">
                        <span>
                          {game.venue}
                          {game.inning ? ` · ${game.inning}` : ""}
                        </span>
                        <span>
                          {selected?.id === game.id ? "선택됨" : "경기 보기 →"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="sports-loading">
                  현재 진행 중인 경기가 없습니다. 전체 경기 목록을 확인해
                  주세요.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
