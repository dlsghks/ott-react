import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";

export function useSportsUser() {
  const [user, setUser] = useState(() => auth?.currentUser ?? null);
  useEffect(() => {
    if (auth) return onAuthStateChanged(auth, setUser);
  }, []);
  return user;
}

// This component's key is the game ID: changing games tears down every listener.
export function useGameRoom(gameId, user, enabled) {
  const [messages, setMessages] = useState([]);
  const [viewers, setViewers] = useState([]);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now);
  const uid = user?.uid;

  useEffect(() => {
    if (!db || !enabled || !uid) return;
    const root = ["sportsRooms", gameId];
    const stopMessages = onSnapshot(
      query(
        collection(db, ...root, "messages"),
        orderBy("createdAt", "desc"),
        limit(100),
      ),
      { includeMetadataChanges: true },
      (snapshot) => {
        setMessages(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .reverse(),
        );
        setConnected(!snapshot.metadata.fromCache);
        setError("");
      },
      () => {
        setError("채팅에 연결할 수 없습니다. 연결 상태를 확인해 주세요.");
        setConnected(false);
      },
    );
    const stopViewers = onSnapshot(
      collection(db, ...root, "viewers"),
      (snapshot) => {
        setViewers(snapshot.docs.map((item) => item.data()));
      },
      () => setError("접속자 목록을 불러오지 못했습니다."),
    );
    return () => {
      stopMessages();
      stopViewers();
    };
  }, [gameId, uid, enabled]);

  useEffect(() => {
    if (!db || !enabled || !uid) return;
    // Each tab has its own record, so closing one tab cannot disconnect another.
    const viewer = doc(collection(db, "sportsRooms", gameId, "viewers"));
    let active = true;
    const heartbeat = () => {
      setNow(Date.now());
      setDoc(viewer, { uid, lastSeen: serverTimestamp() }).catch(() => {
        if (active) setError("접속 상태를 갱신하지 못했습니다.");
      });
    };
    heartbeat();
    const timer = setInterval(heartbeat, 30000);
    return () => {
      active = false;
      clearInterval(timer);
      deleteDoc(viewer).catch(() => {});
    };
  }, [gameId, uid, enabled]);

  const viewerCount = new Set(
    viewers
      .filter((viewer) => viewer.lastSeen?.toMillis() > now - 90000)
      .map((viewer) => viewer.uid),
  ).size;
  const send = async (text) => {
    if (!db || !enabled || !user || !connected)
      throw new Error("실시간 채팅 연결 후 전송해 주세요.");
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 300)
      throw new Error("메시지를 1~300자로 입력해 주세요.");
    await addDoc(collection(db, "sportsRooms", gameId, "messages"), {
      uid: user.uid,
      name: (user.displayName || "야구 팬").slice(0, 40),
      text: trimmed,
      createdAt: serverTimestamp(),
    });
  };
  return { messages, viewerCount, error, connected, send };
}
