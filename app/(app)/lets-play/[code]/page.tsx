"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { LetsPlayLobby } from "@/components/exam/letsPlay/LetsPlayLobby";
import { LetsPlayQuestion } from "@/components/exam/letsPlay/LetsPlayQuestion";
import { LetsPlayReveal } from "@/components/exam/letsPlay/LetsPlayReveal";
import { LetsPlayScoreboard } from "@/components/exam/letsPlay/LetsPlayScoreboard";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useExamTheme } from "@/hooks/useExamTheme";
import { QUESTION_SECONDS } from "@/lib/constants/letsPlay";
import {
  advanceQuestion,
  getRoomByCode,
  getRoomPlayers,
  joinRoom,
  setRoomStatus,
  subscribeToRoom,
  submitAnswer,
} from "@/lib/services/letsPlayService";
import { useLetsPlayStore } from "@/lib/store/letsPlayStore";
import { useAuthStore } from "@/lib/store/authStore";

export default function LetsPlayRoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const confettiFired = useRef(false);

  const room = useLetsPlayStore((s) => s.room);
  const players = useLetsPlayStore((s) => s.players);
  const onlineUserIds = useLetsPlayStore((s) => s.onlineUserIds);
  const currentAnswers = useLetsPlayStore((s) => s.currentAnswers);
  const myAnswer = useLetsPlayStore((s) => s.myAnswer);
  const setRoom = useLetsPlayStore((s) => s.setRoom);
  const upsertPlayer = useLetsPlayStore((s) => s.upsertPlayer);
  const setOnlineUserIds = useLetsPlayStore((s) => s.setOnlineUserIds);
  const recordAnswer = useLetsPlayStore((s) => s.recordAnswer);
  const setMyAnswer = useLetsPlayStore((s) => s.setMyAnswer);
  const resetStore = useLetsPlayStore((s) => s.reset);

  useExamTheme("party");

  // Load the room, join as a player (idempotent — the host is already a player from creation),
  // then subscribe to Realtime for everything that happens after this point.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function init() {
      try {
        const foundRoom = await getRoomByCode(params.code);
        if (!foundRoom) {
          if (!cancelled) setLoadError("No room found with that code. Double-check it with your host.");
          return;
        }
        await joinRoom(foundRoom.id, session!.user.id, session!.user.name, session!.user.avatarInitials);
        const roster = await getRoomPlayers(foundRoom.id);
        if (cancelled) return;

        setRoom(foundRoom);
        roster.forEach(upsertPlayer);
        unsubscribe = subscribeToRoom(
          foundRoom.id,
          { userId: session!.user.id, name: session!.user.name },
          { onRoomChange: setRoom, onPlayerChange: upsertPlayer, onAnswer: recordAnswer, onPresenceSync: setOnlineUserIds },
        );
        setReady(true);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not join this room.");
      }
    }
    void init();

    return () => {
      cancelled = true;
      unsubscribe?.();
      resetStore();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code, session?.user.id]);

  const isHost = Boolean(session && room && session.user.id === room.hostId);
  const playerList = useMemo(() => Object.values(players).sort((a, b) => b.score - a.score), [players]);
  const currentQuestion = room?.questions[room.currentQuestionIndex];
  const isLastQuestion = room ? room.currentQuestionIndex >= room.questions.length - 1 : false;

  // Host-only: the browser that started the game is the sole timer authority for this question —
  // once QUESTION_SECONDS elapses since current_question_started_at, flip the room into 'reveal'.
  // Every other client just reacts to that row change over Realtime; no server cron needed.
  useEffect(() => {
    if (!isHost || !room || room.status !== "active" || !room.currentQuestionStartedAt) return;
    const elapsedMs = Date.now() - new Date(room.currentQuestionStartedAt).getTime();
    const remainingMs = QUESTION_SECONDS * 1000 - elapsedMs;
    if (remainingMs <= 0) {
      void setRoomStatus(room.id, "reveal");
      return;
    }
    const timer = setTimeout(() => void setRoomStatus(room.id, "reveal"), remainingMs);
    return () => clearTimeout(timer);
    // Only re-run when the fields that actually change the countdown change — not on every
    // `room` reference update (e.g. player score changes), which would otherwise reset the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, room?.status, room?.currentQuestionId, room?.currentQuestionStartedAt, room?.id]);

  async function handleStart() {
    if (!room || room.questions.length === 0) return;
    await advanceQuestion(room.id, 0, room.questions[0]!.id);
  }

  async function handleAnswer(choiceId: string) {
    if (!room || !currentQuestion || myAnswer) return;
    const isCorrect = choiceId === currentQuestion.correctChoiceId;
    setMyAnswer({ choiceId, isCorrect, points: 0, isFirst: false });
    try {
      const result = await submitAnswer(room.id, currentQuestion.id, choiceId, isCorrect);
      setMyAnswer({ choiceId, isCorrect, points: result.points, isFirst: result.isFirst });
    } catch {
      setMyAnswer(null); // let them try again rather than getting stuck locked out
    }
  }

  async function handleNext() {
    if (!room) return;
    if (isLastQuestion) {
      await setRoomStatus(room.id, "finished");
    } else {
      const nextIndex = room.currentQuestionIndex + 1;
      await advanceQuestion(room.id, nextIndex, room.questions[nextIndex]!.id);
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-foreground-muted">{loadError}</p>
        <Button accent="party" onClick={() => router.push("/lets-play")}>
          Back to Let&apos;s Play
        </Button>
      </div>
    );
  }

  if (!ready || !room || !session) {
    return <Spinner label="Joining room…" />;
  }

  return (
    <PageTransition className="rounded-2xl bg-[var(--accent-current-wash)] transition-colors duration-300 sm:p-2">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 py-4">
        {room.status === "lobby" && (
          <LetsPlayLobby
            room={room}
            players={playerList}
            onlineUserIds={onlineUserIds}
            isHost={isHost}
            onStart={handleStart}
            onLeave={() => router.push("/lets-play")}
          />
        )}

        {room.status === "active" && currentQuestion && (
          <LetsPlayQuestion
            room={room}
            question={currentQuestion}
            questionNumber={room.currentQuestionIndex + 1}
            totalQuestions={room.questions.length}
            players={players}
            currentAnswers={currentAnswers}
            myAnswer={myAnswer}
            onAnswer={handleAnswer}
          />
        )}

        {room.status === "reveal" && currentQuestion && (
          <LetsPlayReveal
            currentQuestion={currentQuestion}
            players={players}
            currentAnswers={currentAnswers}
            selfUserId={session.user.id}
            isHost={isHost}
            isLastQuestion={isLastQuestion}
            onNext={handleNext}
          />
        )}

        {room.status === "finished" && (
          <LetsPlayScoreboard
            players={playerList}
            selfUserId={session.user.id}
            confettiFired={confettiFired}
            onExit={() => router.push("/dashboard")}
            onPlayAgain={() => router.push("/lets-play")}
          />
        )}
      </div>
    </PageTransition>
  );
}
