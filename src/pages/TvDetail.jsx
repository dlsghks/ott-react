import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMovieStore } from '../store/useMovieStore';

export const TvDetail = () => {
  const { id } = useParams();
  const tvId = Number(id);

  const {
    tvs,
    tvDetails,
    tvVideo,
    seasons,
    episodes,
    onFetchSeason,
    onFetchEpisode,
    onFetchVideo,
    onFetchEpisodeVideo,
    onSearchYoutube
  } = useMovieStore();

  const [showPopup, setShowPopup] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [popupType, setPopupType] = useState(null);

  // TV 상세 정보와 시즌 목록 불러오기
  useEffect(() => {
    if (tvId) {
      onFetchSeason(tvId);
      onFetchVideo(tvId, 'tv');
    }
  }, [tvId, onFetchSeason, onFetchVideo]);

  // TV 상세 정보
  const tv = tvDetails?.[tvId] ?? tvs.find((t) => t.id === tvId);

  // 시즌 목록
  const seasonList = seasons?.[tvId] || [];

  // 첫 번째 시즌을 기본 선택
  const currentSeason =
    selectedSeason ?? seasonList[0]?.season_number;

  // 선택한 시즌의 에피소드 불러오기
  useEffect(() => {
    if (tvId && currentSeason !== undefined) {
      onFetchEpisode(tvId, currentSeason);
    }
  }, [tvId, currentSeason, onFetchEpisode]);

  // 현재 시즌의 에피소드
  const episodeList =
    currentSeason !== undefined
      ? episodes?.[`${tvId}-${currentSeason}`]
      : undefined;

  // TV 예고편 찾기
  const trailer = tvVideo?.[tvId]?.find(
    (v) =>
      v.site === 'YouTube' &&
      (v.type === 'Trailer' || v.type === 'Teaser')
  );

  // TV 전체 예고편 재생
  const handlePlayTrailer = () => {
    if (trailer) {
      setSelectedVideo(trailer.key);
      setPopupType('trailer');
      setShowPopup(true);
    } else {
      alert('등록된 예고편이 없습니다.');
    }
  };

  // 에피소드별 영상 재생
  const handlePlayEpisode = async (seasonNumber, episodeNumber) => {
    // 1. 먼저 TMDB에서 영상 조회
    const videos = await onFetchEpisodeVideo(
      tvId,
      seasonNumber,
      episodeNumber
    );

    const video = videos.find(
      (item) => item.site === 'YouTube'
    );

    if (video) {
      // 2. TMDB에 영상이 있으면 기존 팝업 재생
      setSelectedVideo(video.key);
      setPopupType('episode');
      setShowPopup(true);
      return;
    }

    // 3. TMDB에 영상이 없으면 YouTube API로 검색
    const searchText =
      `${tv?.name || 'TV 프로그램'} 시즌 ${seasonNumber} 에피소드 ${episodeNumber}`;

    const results = await onSearchYoutube(searchText);

    if (results.length > 0) {
      // 검색 결과 첫 번째 영상 재생
      setSelectedVideo(results[0].id.videoId);
      setPopupType('episode');
      setShowPopup(true);
    } else {
      alert('재생할 수 있는 영상을 찾지 못했습니다.');
    }
  };

  // 팝업 닫기
  const handleClosePopup = () => {
    setShowPopup(false);
    setSelectedVideo(null);
    setPopupType(null);
  };

  return (
    <section className="sub-page pt-30">
      {/* TV 기본 정보 */}
      <div className="inner flex gap-15">
        <div className="w-2/6">
          {tv?.poster_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w500${tv.poster_path}`}
              alt={tv.name || 'TV 프로그램 포스터'}
            />
          ) : (
            <div className="no-image">이미지 없음</div>
          )}
        </div>

        <div className="w-4/6">
          <h2 className="text-5xl font-bold">
            {tv?.name || 'TV 프로그램'}
          </h2>

          <p className="mt-5">
            평점 {tv?.vote_average?.toFixed(1) ?? '-'}
          </p>

          <p className="my-10">
            {tv?.overview || '프로그램 소개가 없습니다.'}
          </p>

          <div className="flex gap-5">
            <button
              type="button"
              className="bg-black p-4 text-white"
              onClick={handlePlayTrailer}
            >
              예고편 재생하기
            </button>

            <button type="button" className="border p-4">
              찜하기
            </button>
          </div>
        </div>
      </div>

      {/* 시즌별 에피소드 */}
      <div className="inner mt-20">
        <h3 className="mb-6 text-3xl font-bold">
          시즌별 에피소드
        </h3>

        {/* 시즌 탭 */}
        <div className="mb-8 flex flex-wrap gap-3">
          {seasonList.map((season) => (
            <button
              type="button"
              key={season.id}
              className={`rounded-lg border px-5 py-3 ${currentSeason === season.season_number
                ? 'bg-black text-white'
                : 'bg-white text-black'
                }`}
              onClick={() =>
                setSelectedSeason(season.season_number)
              }
            >
              {season.name}
            </button>
          ))}
        </div>

        {/* 에피소드 목록 */}
        <ul className="flex flex-col gap-6">
          {episodeList?.map((episode) => (
            <li
              key={episode.id}
              className="flex gap-5 border-b pb-6"
            >
              <div className="w-1/4 shrink-0">
                {episode.still_path || tv?.poster_path ? (
                  <img
                    className="w-full rounded-lg"
                    src={`https://image.tmdb.org/t/p/w500${episode.still_path || tv.poster_path
                      }`}
                    alt={episode.name || '에피소드 이미지'}
                  />
                ) : (
                  <div className="no-image">
                    이미지 없음
                  </div>
                )}


              </div>

              <div className="flex-1">
                <p className="mb-2 text-sm text-gray-500">
                  {episode.episode_number}화
                </p>

                <h4 className="mb-3 text-xl font-bold">
                  {episode.name}
                </h4>

                <p className="break-keep text-gray-600">
                  {episode.overview || '에피소드 소개가 없습니다.'}
                </p>

                {episode.runtime && (
                  <p className="mt-3 text-sm text-gray-500">
                    {episode.runtime}분
                  </p>
                )}

                {/* 에피소드 재생 버튼 */}
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
                  onClick={() =>
                    handlePlayEpisode(
                      currentSeason,
                      episode.episode_number
                    )
                  }
                >
                  <span aria-hidden="true">▶</span>
                  <span>재생하기</span>
                </button>

              </div>
            </li>
          ))}
        </ul>

        {episodeList && episodeList.length === 0 && (
          <p>이 시즌에는 등록된 에피소드가 없습니다.</p>
        )}

        {!episodeList && (
          <p>에피소드를 불러오는 중입니다.</p>
        )}
      </div>

      {/* 영상 팝업 */}
      {showPopup && selectedVideo && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-5"
          onClick={handleClosePopup}
        >
          <div
            className="relative w-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="mb-3 ml-auto block bg-gray-600 px-4 py-2 text-white"
              onClick={handleClosePopup}
            >
              닫기 ✕
            </button>

            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1`}
              title={
                popupType === 'episode'
                  ? '에피소드 영상'
                  : `${tv?.name || 'TV 프로그램'} 예고편`
              }
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </section>
  );
};
