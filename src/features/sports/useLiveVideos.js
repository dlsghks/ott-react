import { useEffect, useState } from "react";
import { CACHE_MS, createYoutubeClient } from "./youtube";

export const youtube = createYoutubeClient({
  apiKey: import.meta.env.VITE_YOUTUBE_API_KEY,
});
export function useLiveVideos(scope) {
  const [state, setState] = useState({
    scope,
    videos: [],
    loading: true,
    error: "",
    checkedAt: null,
  });
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await youtube.list(scope);
        if (active) setState({ ...data, scope, loading: false, error: "" });
      } catch (error) {
        if (active)
          setState({
            scope,
            videos: [],
            loading: false,
            error: error.code || "network",
            checkedAt: null,
          });
      }
    };
    load();
    const timer = setInterval(load, CACHE_MS);
    const resume = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [scope]);
  return state.scope === scope
    ? state
    : { scope, videos: [], loading: true, error: "", checkedAt: null };
}
