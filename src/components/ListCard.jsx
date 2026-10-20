import React, { useState } from 'react';
import { SectionTitle } from './SectionTitle';
import { useMovieStore } from '../store/useMovieStore';
import { Link } from 'react-router-dom';
import { useHeartStore } from '../store/useHeartStore';
import { useAuthStore } from '../store/useAuthStore';

export const ListCard = ({ title, subTitle, items, videos, mediaType }) => {
    const { onFetchVideo } = useMovieStore();
    const { onAddHearts } = useHeartStore();
    const hearts = useHeartStore((state) => state.hearts);
    const { user } = useAuthStore();
    const [hover, setHover] = useState(null);

    // 마우스 호버 시 영상 불러오기
    const handleMouseEnter = async (id) => {
        setHover(id);
        await onFetchVideo(id, mediaType);
    };

    // 찜
    const handleHeart = async (item) => {
        if (!user) {
            alert("로그인이 필요합니다")
            return
        }
        await onAddHearts(item)
    }



    return (
        <section>
            <div className="inner">
                <SectionTitle title={title} subTitle={subTitle} />

                <ul className="grid grid-cols-4 gap-5">
                    {items.map((item) => {
                        const hearted = hearts.some((h) => h.id === item.id);

                        const video = videos[item.id];
                        const trailer = video?.find(
                            (v) =>
                                v.site === 'YouTube' &&
                                (v.type === 'Trailer' || v.type === 'Teaser')
                        );

                        return (
                            <li
                                key={item.id}
                                onMouseEnter={() => handleMouseEnter(item.id)}
                                onMouseLeave={() => setHover(null)}
                            >
                                <div className="relative">
                                    <img
                                        className="w-full"
                                        src={`https://image.tmdb.org/t/p/original${item.backdrop_path}`}
                                        alt={item.title || item.name}
                                    />

                                    {hover === item.id && (
                                        <div className="absolute left-0 top-0 z-10 w-full">
                                            {trailer && (
                                                <iframe
                                                    title={`${item.title || item.name} 예고편`}
                                                    className="w-full aspect-video"
                                                    src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1`}
                                                    allow="autoplay; encrypted-media"
                                                />
                                            )}

                                            <div className="bg-black p-4 text-white">
                                                <h3>{item.title || item.name}</h3>

                                                <div className="mt-5 flex gap-2">
                                                    <button>
                                                        <img src="/icons/icon-play-sm.svg" alt="재생" />
                                                    </button>

                                                    <button onClick={() => handleHeart(item)}>
                                                        <img src={hearted ? "/icons/icon-heart-active.svg" : "/icons/icon-heart-sm.svg"} alt="찜하기" />
                                                    </button>

                                                    <Link to={`/${mediaType === "tv" ? "tvDetail" : "movieDetail"}/${item.id}`}>
                                                        <img
                                                            className="w-14 rounded-4xl bg-white"
                                                            src="/icons/arrow-circle.svg"
                                                            alt="상세보기"
                                                        />
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <Link to={`/${mediaType === "tv" ? "tvDetail" : "movieDetail"}/${item.id}`}>
                                        <h3>{item.title || item.name}</h3>
                                        <p>{item.vote_average}</p>
                                    </Link>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
};
