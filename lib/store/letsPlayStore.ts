import { create } from "zustand";
import type { LetsPlayAnswer, LetsPlayPlayer, LetsPlayRoom } from "@/lib/types";

interface MyAnswerState {
  choiceId: string;
  isCorrect: boolean;
  points: number;
  isFirst: boolean;
}

interface LetsPlayState {
  room: LetsPlayRoom | null;
  players: Record<string, LetsPlayPlayer>; // userId -> player
  onlineUserIds: string[]; // from Supabase Presence — who's actually connected right now
  currentAnswers: LetsPlayAnswer[]; // live "who answered" feed, scoped to the room's current question
  myAnswer: MyAnswerState | null; // this browser's own submitted answer for the current question

  setRoom: (room: LetsPlayRoom) => void;
  upsertPlayer: (player: LetsPlayPlayer) => void;
  setOnlineUserIds: (userIds: string[]) => void;
  recordAnswer: (answer: LetsPlayAnswer) => void;
  setMyAnswer: (answer: MyAnswerState | null) => void;
  resetForNewQuestion: () => void;
  reset: () => void;
}

const initialState = {
  room: null,
  players: {},
  onlineUserIds: [],
  currentAnswers: [],
  myAnswer: null,
};

// PHASE2: once a dedicated Multiplayer/Trivia Agent exists, this store's remote-mirrored slices
// (room/players/currentAnswers) could be replaced by a shared realtime query cache — for now it's a
// plain Zustand store synced directly off Supabase Realtime callbacks in letsPlayService.ts.
export const useLetsPlayStore = create<LetsPlayState>()((set, get) => ({
  ...initialState,
  setRoom: (room) => {
    const prev = get().room;
    // A new current_question_id means the room just advanced — clear the previous question's
    // live answer feed and this client's own answer state so stale feedback doesn't leak forward.
    if (prev && prev.currentQuestionId !== room.currentQuestionId) {
      set({ room, currentAnswers: [], myAnswer: null });
    } else {
      set({ room });
    }
  },
  upsertPlayer: (player) => set({ players: { ...get().players, [player.userId]: player } }),
  setOnlineUserIds: (onlineUserIds) => set({ onlineUserIds }),
  recordAnswer: (answer) => {
    const room = get().room;
    if (room && answer.questionId !== room.currentQuestionId) return; // stale event, ignore
    const existing = get().currentAnswers;
    if (existing.some((a) => a.userId === answer.userId)) return;
    set({ currentAnswers: [...existing, answer] });
  },
  setMyAnswer: (myAnswer) => set({ myAnswer }),
  resetForNewQuestion: () => set({ currentAnswers: [], myAnswer: null }),
  reset: () => set(initialState),
}));
