import { create } from "zustand";
import { auth, db, googleProvider } from "../firebase/firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const useAuthStore = create((set) => ({
    // 사용자 정보를 저장할 변수
    user: null,
    // 사용자 안에는 아빠, 엄마, 아들, 딸 멤버에 대한 정보를 저장할 변수
    currentMember: null,
    // 사용자정보 초기화작업 메서드
    // 멤버를 변경할 메서드
    onSetMember: (mem) => {
        console.log(mem);
        set({ currentMember: mem });
    },
    // 구글 로그인
    onGoogleLogin: async () => {
        try {
            // 구글 팝업 로그인
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            // firestore에 사용자 문서 확인
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);
            // 신규 사용자이면 firestore에 저장
            if (!userDoc.exists()) {
                const userInfo = {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName,
                    photoURL: user.photoURL,
                    phone: user.phoneNumber,
                    familyMembers: {
                        아빠: { likes: [], watchHistory: [] },
                        엄마: { likes: [], watchHistory: [] },
                        딸: { likes: [], watchHistory: [] },
                        아들: { likes: [], watchHistory: [] }
                    }
                }
                await setDoc(userRef, userInfo);
                set({ user: userInfo })
            }
            else {
                set({ user: userDoc.data() })
            }
            return user;
        }
        catch (err) {
            console.error("구글 로그인 에러:", err.code || "auth/unknown")
        }
    },
    // 로그아웃 메서드
    onLogout: async () => {
        try {
            await signOut(auth);
            set({ user: null, currentMember: null })
        }
        catch (err) {
            console.error("로그아웃 에러", err.code || "auth/unknown")
        }
    }
}));