"use client";

// Real-time multiplayer trivia backend for the "Let's Play" feature. Talks directly to Supabase from
// the browser (same pattern TopNav already uses for auth.signOut()) — no custom WebSocket server.
// Room/player/answer state lives in Postgres (see supabase/lets_play_schema.sql); Supabase Realtime's
// postgres_changes feed pushes every row change to every subscribed client, and Presence tracks who's
// currently connected to the lobby. The "first correct answer wins the point" race is resolved
// server-side by the lets_play_submit_answer RPC (atomic UPDATE ... WHERE ... IS NULL) — the client
// never decides who won, it only reports what the database decided.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { ExamType, LetsPlayAnswer, LetsPlayPlayer, LetsPlayRoom, Question, SkillDomain } from "@/lib/types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easier to read aloud/type

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  exam_type: ExamType;
  domain: SkillDomain;
  questions: Question[];
  status: LetsPlayRoom["status"];
  current_question_index: number;
  current_question_id: string | null;
  current_question_winner: string | null;
  current_question_started_at: string | null;
  created_at: string;
}

interface PlayerRow {
  id: string;
  room_id: string;
  user_id: string;
  name: string;
  avatar_initials: string;
  score: number;
  joined_at: string;
}

interface AnswerRow {
  id: string;
  room_id: string;
  question_id: string;
  user_id: string;
  choice_id: string;
  is_correct: boolean;
  points: number;
  answered_at: string;
}

function roomFromRow(row: RoomRow): LetsPlayRoom {
  return {
    id: row.id,
    code: row.code,
    hostId: row.host_id,
    examType: row.exam_type,
    domain: row.domain,
    questions: row.questions ?? [],
    status: row.status,
    currentQuestionIndex: row.current_question_index,
    currentQuestionId: row.current_question_id,
    currentQuestionWinner: row.current_question_winner,
    currentQuestionStartedAt: row.current_question_started_at,
    createdAt: row.created_at,
  };
}

function playerFromRow(row: PlayerRow): LetsPlayPlayer {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    name: row.name,
    avatarInitials: row.avatar_initials,
    score: row.score,
    joinedAt: row.joined_at,
  };
}

function answerFromRow(row: AnswerRow): LetsPlayAnswer {
  return {
    id: row.id,
    roomId: row.room_id,
    questionId: row.question_id,
    userId: row.user_id,
    choiceId: row.choice_id,
    isCorrect: row.is_correct,
    points: row.points,
    answeredAt: row.answered_at,
  };
}

/** Generates a fresh trivia question set via the same real Claude pipeline every other exam mode uses. */
export async function generateTriviaQuestions(examType: ExamType, domain: SkillDomain, count: number): Promise<Question[]> {
  const params = new URLSearchParams({ examType, count: String(count) });
  params.append("domain", domain);
  const res = await fetch(`/api/exam/questions?${params.toString()}`);
  const data = (await res.json()) as { questions: Question[] } | { error: string };
  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : "Could not generate trivia questions.");
  }
  return data.questions;
}

export async function createRoom(params: {
  examType: ExamType;
  domain: SkillDomain;
  questions: Question[];
  hostId: string;
  hostName: string;
  hostAvatarInitials: string;
}): Promise<LetsPlayRoom> {
  const { examType, domain, questions, hostId, hostName, hostAvatarInitials } = params;
  const supabase = createClient();

  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const { data, error } = await supabase
      .from("lets_play_rooms")
      .insert({ code, host_id: hostId, exam_type: examType, domain, questions, status: "lobby" })
      .select()
      .single();

    if (!error && data) {
      const room = roomFromRow(data as RoomRow);
      const { error: playerError } = await supabase
        .from("lets_play_players")
        .insert({ room_id: room.id, user_id: hostId, name: hostName, avatar_initials: hostAvatarInitials });
      if (playerError) throw new Error(playerError.message);
      return room;
    }
    // Unique-constraint collision on `code` — extremely unlikely with 33^6 combinations, but retry
    // with a fresh code rather than surfacing a confusing error to the host.
    lastError = error;
    if (error && error.code !== "23505") break;
  }
  throw new Error(lastError instanceof Error ? lastError.message : "Could not create the room. Please try again.");
}

export async function getRoomByCode(code: string): Promise<LetsPlayRoom | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lets_play_rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? roomFromRow(data as RoomRow) : null;
}

export async function getRoomPlayers(roomId: string): Promise<LetsPlayPlayer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lets_play_players")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as PlayerRow[]).map(playerFromRow);
}

export async function joinRoom(roomId: string, userId: string, name: string, avatarInitials: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lets_play_players")
    .upsert({ room_id: roomId, user_id: userId, name, avatar_initials: avatarInitials }, { onConflict: "room_id,user_id" });
  if (error) throw new Error(error.message);
}

/** Host-only: advances the room to question `index` and flips status to 'active'. No-ops server-side
 *  (via the RPC's own host_id check) if called by anyone but the host. */
export async function advanceQuestion(roomId: string, index: number, questionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("lets_play_advance_question", {
    p_room_id: roomId,
    p_question_index: index,
    p_question_id: questionId,
  });
  if (error) throw new Error(error.message);
}

/** Host-only: transitions the room into 'reveal' or 'finished'. */
export async function setRoomStatus(roomId: string, status: "reveal" | "finished"): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("lets_play_set_room_status", { p_room_id: roomId, p_status: status });
  if (error) throw new Error(error.message);
}

export interface SubmitAnswerResult {
  points: number;
  isFirst: boolean;
}

/** The only path a client has to score a point — the actual "who was first" decision happens
 *  server-side in an atomic UPDATE, so two players racing on the same question can't both win. */
export async function submitAnswer(
  roomId: string,
  questionId: string,
  choiceId: string,
  isCorrect: boolean,
): Promise<SubmitAnswerResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("lets_play_submit_answer", {
    p_room_id: roomId,
    p_question_id: questionId,
    p_choice_id: choiceId,
    p_is_correct: isCorrect,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return { points: row?.points ?? 0, isFirst: row?.is_first ?? false };
}

export interface RoomSubscriptionHandlers {
  onRoomChange?: (room: LetsPlayRoom) => void;
  onPlayerChange?: (player: LetsPlayPlayer) => void;
  onAnswer?: (answer: LetsPlayAnswer) => void;
  onPresenceSync?: (userIds: string[]) => void;
}

/** One Realtime channel per room: Postgres row-change feeds for room/players/answers, plus Presence
 *  for "who's actually online right now" in the lobby. Returns an unsubscribe function. */
export function subscribeToRoom(
  roomId: string,
  self: { userId: string; name: string },
  handlers: RoomSubscriptionHandlers,
): () => void {
  const supabase = createClient();
  const channel: RealtimeChannel = supabase
    .channel(`lets-play-room-${roomId}`, { config: { presence: { key: self.userId } } })
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "lets_play_rooms", filter: `id=eq.${roomId}` },
      (payload) => handlers.onRoomChange?.(roomFromRow(payload.new as RoomRow)),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "lets_play_players", filter: `room_id=eq.${roomId}` },
      (payload) => handlers.onPlayerChange?.(playerFromRow(payload.new as PlayerRow)),
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "lets_play_answers", filter: `room_id=eq.${roomId}` },
      (payload) => handlers.onAnswer?.(answerFromRow(payload.new as AnswerRow)),
    )
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      handlers.onPresenceSync?.(Object.keys(state));
    });

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ name: self.name, online_at: new Date().toISOString() });
    }
  });

  return () => {
    supabase.removeChannel(channel);
  };
}
