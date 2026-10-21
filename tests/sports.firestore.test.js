import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

// Run only against the demo emulator with npm run test:sports:emulator.
test(
  "two authenticated users: realtime messages, isolation, presence and authorization",
  { timeout: 30000 },
  async () => {
    const env = await initializeTestEnvironment({
      projectId: "demo-ott-sports",
      firestore: {
        host: "127.0.0.1",
        port: 8088,
        rules: await readFile(
          new URL("../docs/sports-live.firestore.rules", import.meta.url),
          "utf8",
        ),
      },
    });
    try {
      await env.clearFirestore();
      const alice = env.authenticatedContext("alice").firestore();
      const bob = env.authenticatedContext("bob").firestore();
      const guest = env.unauthenticatedContext().firestore();
      const messages = (db, id = "abcdefghijk") =>
        collection(db, "sportsRooms", id, "messages");
      const payload = (uid, text = "함께 응원해요!") => ({
        uid,
        name: "야구 팬",
        text,
        createdAt: serverTimestamp(),
      });
      await assertFails(getDocs(messages(guest)));
      await assertFails(addDoc(messages(guest), payload("guest")));
      await assertFails(addDoc(messages(alice), payload("bob")));
      await assertFails(
        addDoc(messages(alice), payload("alice", "x".repeat(301))),
      );
      await assertFails(addDoc(messages(alice), payload("alice", "   ")));
      await assertFails(
        addDoc(messages(alice, "not-a-video"), payload("alice")),
      );
      await assertFails(
        addDoc(messages(alice), { ...payload("alice"), admin: true }),
      );
      await assertFails(
        addDoc(messages(alice), {
          ...payload("alice"),
          createdAt: "forged-time",
        }),
      );
      let stop, receiveTimer;
      const received = new Promise((resolve, reject) => {
        receiveTimer = setTimeout(
          () => reject(new Error("Realtime delivery timeout")),
          10000,
        );
        stop = onSnapshot(
          query(messages(bob), orderBy("createdAt", "desc"), limit(100)),
          (snapshot) => {
            if (snapshot.docs.some((item) => item.data().uid === "alice"))
              resolve();
          },
          reject,
        );
      });
      try {
        const sent = await assertSucceeds(
          addDoc(messages(alice), payload("alice")),
        );
        await received;
        await assertFails(setDoc(sent, payload("alice", "수정")));
        await assertFails(deleteDoc(sent));
        assert.equal((await getDocs(messages(bob, "lmnopqrstuv"))).size, 0);
      } finally {
        clearTimeout(receiveTimer);
        stop?.();
      }
      await assertSucceeds(
        addDoc(messages(bob), payload("bob", "같이 응원해요!")),
      );
      assert.equal((await getDocs(messages(alice))).size, 2);
      const presence = doc(
        alice,
        "sportsRooms",
        "abcdefghijk",
        "viewers",
        "alice-tab",
      );
      await assertSucceeds(
        setDoc(presence, { uid: "alice", lastSeen: serverTimestamp() }),
      );
      assert.equal(
        (
          await getDocs(
            collection(bob, "sportsRooms", "abcdefghijk", "viewers"),
          )
        ).size,
        1,
      );
      await assertFails(
        deleteDoc(
          doc(bob, "sportsRooms", "abcdefghijk", "viewers", "alice-tab"),
        ),
      );
      await assertFails(
        setDoc(doc(bob, "sportsRooms", "abcdefghijk", "viewers", "alice-tab"), {
          uid: "bob",
          lastSeen: serverTimestamp(),
        }),
      );
      await assertSucceeds(deleteDoc(presence));
      assert.equal(
        (
          await getDocs(
            collection(bob, "sportsRooms", "abcdefghijk", "viewers"),
          )
        ).size,
        0,
      );
    } finally {
      await env.cleanup();
    }
  },
);
