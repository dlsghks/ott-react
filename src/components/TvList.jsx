import React from 'react';
import { useMovieStore } from '../store/useMovieStore';
import { ListCard } from './ListCard';

export const TvList = () => {
    const { tvs, tvVideo } = useMovieStore();

    return (
        <ListCard
            title="인기TV"
            subTitle="현재 TV에서 방영 중인 인기 프로그램을 즐겨보세요"
            items={tvs}
            videos={tvVideo}
            mediaType="tv"
        />
    );
};