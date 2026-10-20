import React from 'react';
import { useMovieStore } from '../store/useMovieStore';
import { ListCard } from './ListCard';

export const MovieList = () => {
    const { popMovies, popVideo } = useMovieStore();

    return (
        <ListCard
            title="인기영화"
            subTitle="최신 인기 영화를 즐겨보세요"
            items={popMovies}
            videos={popVideo}
            mediaType="movie"
        />
    );
};