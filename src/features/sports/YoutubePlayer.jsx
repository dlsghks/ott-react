import { useEffect, useRef, useState } from "react";
let apiPromise;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise)
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      const timer = setTimeout(() => reject(new Error("timeout")), 15000);
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timer);
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error("network"));
      };
      document.head.append(script);
    }).catch((error) => {
      apiPromise = null;
      throw error;
    });
  return apiPromise;
}
export function YoutubePlayer({ videoId, onEnded }) {
  const target = useRef(null);
  const ended = useRef(onEnded);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    ended.current = onEnded;
  }, [onEnded]);
  useEffect(() => {
    let active = true,
      player;
    const element = document.createElement("div");
    target.current.append(element);
    loadApi()
      .then((YT) => {
        if (!active) return;
        player = new YT.Player(element, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          playerVars: { playsinline: 1, origin: window.location.origin },
          events: {
            onStateChange: (event) => {
              if (active && event.data === 0) ended.current();
            },
            onError: (event) => {
              if (active)
                setFailure(
                  [100, 101, 150].includes(event.data)
                    ? "영상이 종료·삭제되었거나 외부 재생이 제한되었습니다."
                    : "영상을 재생할 수 없습니다. 원본 영상에서 확인해 주세요.",
                );
            },
          },
        });
      })
      .catch(() => {
        if (active)
          setFailure(
            "영상 플레이어에 연결하지 못했습니다. 원본 영상에서 확인해 주세요.",
          );
      });
    return () => {
      active = false;
      player?.destroy();
      element.remove();
    };
  }, [videoId]);
  return (
    <div className="sports-video-shell">
      <div ref={target} className="sports-yt-target" />
      {failure && (
        <p className="sports-playback-error" role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}
