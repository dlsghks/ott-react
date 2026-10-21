
import { create } from "zustand";
import { auth, db } from "../firebase/firebase";
import { useAuthStore } from "./useAuthStore";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export const useHeartStore = create((set, get) => ({
    hearts: [],

    // 찜 목록 불러오기
    // onFetchHearts: async () => {
    //     const user = auth.currentUser;
    //     const currentMember = useAuthStore.getState().currentMember;

    //     if (!user || !currentMember) return;

    //     try {
    //         const userDocRef = doc(db, "users", user.uid);
    //         const userDoc = await getDoc(userDocRef);

    //         if (userDoc.exists()) {
    //             const hearts =
    //                 userDoc.data()?.familyMembers?.[currentMember]?.likes || [];

    //             set({ hearts });
    //         }
    //     } catch (err) {
    //         console.error("찜 목록 조회 오류:", err.code, err.message);
    //     }
    // }, GPT한테 물어본.ver

    onFetchHearts: async () => {
        const user = auth?.currentUser;
        const currentMember = useAuthStore.getState().currentMember;

        if (!user || !currentMember) return;
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const hearts = userDoc.data()?.familyMembers?.[currentMember]?.likes || [];
                set({ hearts });
            }
        } catch (err) {
            console.error("찜 목록 조회 오류:", err.code, err.message);
        }
    },


    // 찜 추가
    onAddHearts: async (item) => {
        const user = auth?.currentUser;
        const currentMember = useAuthStore.getState().currentMember;

        if (!user || !currentMember) return;

        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) return;

            const prevHeart =
                userDoc.data()?.familyMembers?.[currentMember]?.likes || [];

            const isHearted = prevHeart.some((h) => h.id === item.id);

            // 이미 찜한 항목이면 취소, 아니면 추가
            const newHeart = isHearted
                ? prevHeart.filter((h) => h.id !== item.id)
                : [
                    {
                        id: item.id,
                        title: item.title ?? item.name ?? "제목 없음",
                        poster_path: item.poster_path ?? null,
                    },
                    ...prevHeart,
                ];

            await updateDoc(userDocRef, {
                [`familyMembers.${currentMember}.likes`]: newHeart,
            });

            set({ hearts: newHeart });
        } catch (err) {
            console.error("찜 오류:", err.code, err.message);
        }
    },

    // 삭제
    onRemoveHearts: async (id) => {
        const user = auth?.currentUser;
        const currentMember = useAuthStore.getState().currentMember;

        if (!user || !currentMember) return;
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const likes = userDoc.data()?.familyMembers?.[currentMember]?.likes || []
                const filtered = likes.filter((h) => h.id !== id);

                await updateDoc(userDocRef, { [`familyMembers.${currentMember}.likes`]: filtered })
                set({ hearts: filtered })
            }
        } catch (err) {
            console.log("찜 삭제 오류: ", err)
        }
    },
}));
