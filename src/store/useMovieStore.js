import { create } from "zustand";

// TMDB API 키
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const YOUTUBE_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

// TMDB API 공통 호출 함수
const fetchTMDB = async (url) => {
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`TMDB API 오류: ${res.status}`);
    }

    return await res.json();
};

export const useMovieStore = create((set, get) => ({
    // 인기 영화
    popMovies: [],

    // 인기 영화 불러오기
    onFetchPopular: async () => {
        try {
            const data = await fetchTMDB(
                `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=ko-KR&page=1`
            );

            set({ popMovies: data.results });
        } catch (error) {
            console.error("인기 영화 불러오기 실패:", error);
        }
    },

    // 인기 TV 프로그램
    tvs: [],

    // 인기 TV 프로그램 불러오기
    onFetchTv: async () => {
        try {
            const data = await fetchTMDB(
                `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=ko-KR&page=1`
            );

            set({ tvs: data.results });
        } catch (error) {
            console.error("인기 TV 불러오기 실패:", error);
        }
    },

    // 영화 예고편
    popVideo: {},

    // TV 예고편
    tvVideo: {},

    // 영화 및 TV 예고편 공통 호출 함수
    onFetchVideo: async (id, mediaType = "movie") => {
        const isTV = mediaType === "tv";
        const state = get();
        const videos = isTV ? state.tvVideo : state.popVideo;

        // 이미 불러온 데이터가 있으면 재호출하지 않음
        if (videos[id]) return;

        try {
            const data = await fetchTMDB(
                `https://api.themoviedb.org/3/${mediaType}/${id}/videos?api_key=${TMDB_KEY}&language=en-US`
            );

            set((state) => ({
                [isTV ? "tvVideo" : "popVideo"]: {
                    ...(isTV ? state.tvVideo : state.popVideo),
                    [id]: data.results
                }
            }));
        } catch (error) {
            console.error("예고편 불러오기 실패:", error);
        }
    },

    tvDetails: {},
    // TV 시즌 목록
    seasons: {},

    // 시즌 목록 불러오기
    onFetchSeason: async (id) => {
        const { tvDetails } = get();

        if (tvDetails[id]) return;

        try {
            const data = await fetchTMDB(
                `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_KEY}&language=ko-KR`
            );

            set((state) => ({
                tvDetails: {
                    ...state.tvDetails,
                    [id]: data
                },
                seasons: {
                    ...state.seasons,
                    [id]: data.seasons || []
                }
            }));
        } catch (error) {
            console.error("시즌 목록 불러오기 실패:", error);
        }
    },

    // 시즌별 에피소드
    episodes: {},

    onFetchEpisode: async (id, seasonNumber) => {
        const key = `${id}-${seasonNumber}`;

        try {
            const data = await fetchTMDB(
                `https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}?api_key=${TMDB_KEY}&language=ko-KR`
            );

            set((state) => ({
                episodes: {
                    ...state.episodes,
                    [key]: data.episodes || [],
                },
            }));
        } catch (error) {
            console.error("에피소드 불러오기 실패:", error);
        }
    },

    episodeVideos: {},

    onFetchEpisodeVideo: async (id, seasonNumber, episodeNumber) => {
        const key = `${id}-${seasonNumber}-${episodeNumber}`;

        try {
            const data = await fetchTMDB(
                `https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}/videos?api_key=${TMDB_KEY}&language=en-US`
            );

            set((state) => ({
                episodeVideos: {
                    ...state.episodeVideos,
                    [key]: data.results || [],
                },
            }));

            return data.results || [];
        } catch (error) {
            console.error("에피소드 영상 불러오기 실패:", error);
            return [];
        }
    },
    youtubeResults: [],

    onSearchYoutube: async (searchText) => {
        try {
            const res = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&regionCode=KR&relevanceLanguage=ko&q=${encodeURIComponent(searchText)}&key=${YOUTUBE_KEY}`
            );

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(
                    errorData.error?.message || `YouTube API 오류: ${res.status}`
                );
            }

            const data = await res.json();

            set({ youtubeResults: data.items || [] });

            return data.items || [];
        } catch (error) {
            console.error('유튜브 검색 실패:', error);
            return [];
        }
    },
}));
