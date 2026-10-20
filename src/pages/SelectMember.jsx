import React, { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const familys = ["아빠", "엄마", "딸", "아들"];
export const SelectMember = () => {
    const navigate = useNavigate();
    // zustand
    const { onSetMember } = useAuthStore();
    const [selectMember, setSelectMember] = useState(null);
    // 확인 버튼 클릭 시 실행할 메서드
    const handleConfirm = () => {
        if (!selectMember) return
        onSetMember(selectMember);
        navigate("/");
    }

    return (
        <section className='sub-page pt-25 flex item-center justify-center'>
            <div className="inner border p-10">
                <h2 className="section-title text-3xl font-bold">멤버선택</h2>
                <p>상용할 사용자를 선택하세요</p>
                <div>
                    {familys.map((mem) => (

                        <button onClick={() => setSelectMember(mem)} className={`w-full p-4 border mb-2 ${selectMember === mem ? "border-blue-500 bg-blue-50" : ""}`}>{mem}</button>
                    ))}
                </div>
                <div className='flex gap-4'>
                    <button onClick={handleConfirm} className='bg-blue-600 text-white p-3 flex-1'>확인</button>
                    <button className='bg-blue-600 text-white p-3 flex-1'>건너뛰기</button>
                </div>
            </div>
        </section>
    )
}