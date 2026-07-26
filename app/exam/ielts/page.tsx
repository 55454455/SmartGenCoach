"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Mic, Pause, Play, Square } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { SkillPracticeQuiz } from "@/components/exam/SkillPracticeQuiz";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useCountdown } from "@/hooks/useCountdown";
import { useExamTheme } from "@/hooks/useExamTheme";
import { useSpeakingRecorder } from "@/hooks/useSpeakingRecorder";
import type { IeltsListeningBundle } from "@/lib/services/examService";
import type { IeltsDomain, Question, SpeakingPrompt } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

const FULL_EXAM_SECTIONS: IeltsDomain[] = ["Listening", "Reading", "Writing", "Speaking"];

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Browser TTS quality varies a lot by OS/voice pack. Favor whichever installed voice sounds least
// robotic: named "Enhanced"/"Premium"/"Neural"/"Natural" packs first (macOS/Windows let users
// download these for free in system settings), then well-regarded default en-US/en-GB voices,
// then any English voice, then whatever's available.
const PREFERRED_VOICE_NAMES = [
  "samantha",
  "ava",
  "allison",
  "susan",
  "zoe",
  "nicky",
  "daniel",
  "serena",
  "karen",
  "moira",
  "google us english",
  "google uk english female",
  "microsoft aria",
  "microsoft jenny",
];

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;
  const rank = (v: SpeechSynthesisVoice) => {
    const name = v.name.toLowerCase();
    if (/enhanced|premium|neural|natural/i.test(v.name)) return 0;
    const preferredIndex = PREFERRED_VOICE_NAMES.findIndex((p) => name.includes(p));
    if (preferredIndex !== -1) return 1 + preferredIndex;
    if (v.lang === "en-US" || v.lang === "en-GB") return 100;
    if (v.lang.startsWith("en")) return 200;
    return 300;
  };
  return [...voices].sort((a, b) => rank(a) - rank(b))[0];
}

function ListeningSection() {
  const [bundle, setBundle] = useState<IeltsListeningBundle | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [unsupported, setUnsupported] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    fetch("/api/exam/ielts?section=Listening")
      .then((res) => res.json())
      .then((data: IeltsListeningBundle) => setBundle(data));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setUnsupported(true);
      return;
    }
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const clearKeepAlive = () => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  };

  // Chrome has a long-standing bug where speechSynthesis silently auto-pauses utterances longer
  // than ~15 seconds. The standard mitigation is to nudge it with pause()/resume() periodically
  // while genuinely speaking, which resets Chrome's internal watchdog without audibly interrupting.
  const startKeepAlive = () => {
    clearKeepAlive();
    keepAliveRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  };

  const startTimer = (durationSeconds: number) => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= durationSeconds) {
          clearTimer();
          return durationSeconds;
        }
        return prev + 1;
      });
    }, 1000);
  };

  // Real speech, generated live by the browser's speech engine (Web Speech API) — not a simulated
  // timer. Seeking approximates a jump by re-speaking from a proportional character offset, since
  // SpeechSynthesisUtterance has no native seek.
  const speakFrom = (fromSeconds: number) => {
    if (!bundle) return;
    window.speechSynthesis.cancel();
    const duration = bundle.audioDurationSeconds;
    const ratio = duration > 0 ? Math.min(Math.max(fromSeconds / duration, 0), 1) : 0;
    const charIndex = Math.floor(ratio * bundle.transcript.length);
    const text = bundle.transcript.slice(charIndex).trim() || bundle.transcript;

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickBestVoice(voicesRef.current);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.97;
    utterance.pitch = 1;
    utterance.onend = () => {
      clearTimer();
      clearKeepAlive();
      setPlaying(false);
      setElapsed(bundle.audioDurationSeconds);
    };
    utterance.onerror = (e) => {
      // "canceled"/"interrupted" fire whenever we call cancel() ourselves (seeking, replaying) —
      // expected, not a real failure, and the next utterance's own handlers take over.
      if (e.error === "canceled" || e.error === "interrupted") return;
      clearTimer();
      clearKeepAlive();
      setPlaying(false);
    };
    window.speechSynthesis.speak(utterance);
    startTimer(duration);
    startKeepAlive();
  };

  const togglePlay = () => {
    if (!bundle || unsupported) return;
    if (playing) {
      window.speechSynthesis.pause();
      clearTimer();
      clearKeepAlive();
      setPlaying(false);
      return;
    }
    if (window.speechSynthesis.paused && window.speechSynthesis.speaking) {
      window.speechSynthesis.resume();
      startTimer(bundle.audioDurationSeconds);
      startKeepAlive();
    } else {
      speakFrom(elapsed >= bundle.audioDurationSeconds ? 0 : elapsed);
    }
    setPlaying(true);
  };

  const handleSeek = (value: number) => {
    setElapsed(value);
    if (playing) speakFrom(value);
  };

  useEffect(
    () => () => {
      clearTimer();
      clearKeepAlive();
    },
    [],
  );

  if (!bundle) return <Spinner label="Loading listening section…" />;

  const visibleCues = bundle.cues.filter((cue) => elapsed >= cue.atSeconds);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="mb-3 text-sm text-foreground-muted">
          {unsupported
            ? "Your browser doesn't support spoken audio (Web Speech API) — try Chrome, Edge, or Safari."
            : "Real audio, generated live by your browser's speech engine — press play to listen."}
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            disabled={unsupported}
            aria-label={playing ? "Pause audio" : "Play audio"}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ielts text-white hover:bg-ielts/90 disabled:opacity-50"
          >
            {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
          </button>
          <input
            type="range"
            min={0}
            max={bundle.audioDurationSeconds}
            value={elapsed}
            onChange={(e) => handleSeek(Number(e.target.value))}
            disabled={unsupported}
            aria-label="Audio position"
            className="h-1.5 flex-1 accent-ielts"
          />
          <span className="w-20 shrink-0 text-right font-mono text-sm text-foreground-muted">
            {formatClock(elapsed)} / {formatClock(bundle.audioDurationSeconds)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {visibleCues.length === 0 && (
          <p className="text-sm text-foreground-muted">Questions will appear here as the audio plays.</p>
        )}
        <AnimatePresence>
          {visibleCues.map((cue) => {
            const question = bundle.questionsById[cue.questionId];
            if (!question) return null;
            return (
              <motion.div
                key={cue.questionId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <p className="mb-3 font-medium text-foreground">{question.prompt}</p>
                <div className="flex flex-col gap-2">
                  {question.choices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [cue.questionId]: choice.id }))}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm",
                        answers[cue.questionId] === choice.id
                          ? "border-ielts bg-ielts-soft text-foreground"
                          : "border-border hover:bg-surface-muted",
                      )}
                    >
                      {choice.text}
                    </button>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ReadingWritingSection({ domain }: { domain: "Reading" | "Writing" }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);

  useEffect(() => {
    setQuestions(null);
    fetch(`/api/exam/ielts?section=${domain}`)
      .then((res) => res.json())
      .then((data: { questions: Question[] }) => setQuestions(data.questions));
  }, [domain]);

  if (!questions) return <Spinner label={`Loading ${domain.toLowerCase()} section…`} />;

  return <SkillPracticeQuiz title={`IELTS ${domain}`} questions={questions} accent="ielts" />;
}

function SpeakingSection() {
  const [prompts, setPrompts] = useState<SpeakingPrompt[] | null>(null);
  const [partIndex, setPartIndex] = useState(0);
  const [prepping, setPrepping] = useState(true);

  useEffect(() => {
    fetch("/api/exam/ielts?section=Speaking")
      .then((res) => res.json())
      .then((data: { prompts: SpeakingPrompt[] }) => setPrompts(data.prompts));
  }, []);

  const prompt = prompts?.[partIndex];
  const recorder = useSpeakingRecorder(prompt?.speakSeconds ?? 30);

  useEffect(() => {
    setPrepping((prompt?.prepSeconds ?? 0) > 0);
    recorder.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partIndex]);

  const { secondsLeft: prepSecondsLeft } = useCountdown(prompt?.prepSeconds ?? 0, {
    paused: !prepping || !prompt,
    onExpire: () => {
      setPrepping(false);
      recorder.start();
    },
  });

  if (!prompts || !prompt) return <Spinner label="Loading speaking section…" />;

  const isLastPart = partIndex === prompts.length - 1;

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="rounded-full bg-ielts-soft px-3 py-1 text-xs font-semibold text-ielts">{prompt.title}</span>
      <p className="max-w-lg text-lg text-foreground">{prompt.prompt}</p>

      {prepping && prompt.prepSeconds > 0 ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-foreground-muted">Preparation time</p>
          <span className="font-mono text-3xl font-semibold text-foreground">{formatClock(prepSecondsLeft)}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 items-end gap-1" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.span
                key={i}
                className={cn("w-1.5 rounded-full", recorder.status === "recording" ? "bg-ielts" : "bg-border")}
                animate={
                  recorder.status === "recording"
                    ? { height: [8, 24 + ((i * 7) % 32), 8] }
                    : { height: 8 }
                }
                transition={{ duration: 0.8, repeat: recorder.status === "recording" ? Infinity : 0, delay: i * 0.05 }}
              />
            ))}
          </div>

          {recorder.error && <p className="max-w-sm text-sm text-red-600">{recorder.error}</p>}
          {recorder.status === "idle" && (
            <Button accent="ielts" icon={<Mic size={16} aria-hidden="true" />} onClick={recorder.start}>
              Start Recording
            </Button>
          )}
          {recorder.status === "recording" && (
            <div className="flex flex-col items-center gap-2">
              <span className="font-mono text-sm text-foreground-muted">
                {formatClock(recorder.elapsedSeconds)} / {formatClock(prompt.speakSeconds)}
              </span>
              <Button variant="secondary" accent="ielts" icon={<Square size={16} aria-hidden="true" />} onClick={recorder.stop}>
                Stop Recording
              </Button>
            </div>
          )}
          {recorder.status === "stopped" && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-ielts">
                <CheckCircle2 size={16} aria-hidden="true" /> Response recorded
              </div>
              {recorder.audioUrl && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio controls src={recorder.audioUrl} className="w-full max-w-xs" />
              )}
              <Button
                accent="ielts"
                onClick={() => {
                  if (!isLastPart) setPartIndex((i) => i + 1);
                }}
                disabled={isLastPart}
              >
                {isLastPart ? "Speaking section complete" : "Next Part"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IeltsExamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedSection = searchParams.get("section");
  const singleSection: IeltsDomain | null =
    requestedSection === "Listening" || requestedSection === "Speaking" ? requestedSection : null;

  const sections = useMemo(() => (singleSection ? [singleSection] : FULL_EXAM_SECTIONS), [singleSection]);
  const [activeSection, setActiveSection] = useState<IeltsDomain>(sections[0]!);

  useExamTheme("ielts");

  return (
    <div className="flex h-screen min-h-0 flex-col">
      <header className="flex flex-col border-b border-border bg-surface">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <h1 className="text-sm font-semibold text-foreground sm:text-base">
            IELTS {singleSection ? `${singleSection} Practice` : "Full Exam"}
          </h1>
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            Exit
          </Button>
        </div>
        {sections.length > 1 && (
          <nav className="flex gap-1 px-4 pb-2 sm:px-6">
            {sections.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => setActiveSection(section)}
                aria-current={activeSection === section ? "true" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  activeSection === section
                    ? "bg-ielts-soft text-ielts"
                    : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {section}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto bg-[var(--accent-current-wash)] p-4 transition-colors duration-300 sm:p-8">
        {activeSection === "Listening" && <ListeningSection />}
        {activeSection === "Reading" && <ReadingWritingSection domain="Reading" />}
        {activeSection === "Writing" && <ReadingWritingSection domain="Writing" />}
        {activeSection === "Speaking" && <SpeakingSection />}
      </main>
    </div>
  );
}

export default function IeltsExamPage() {
  return (
    <PageTransition>
      <Suspense fallback={<Spinner label="Loading exam…" />}>
        <IeltsExamContent />
      </Suspense>
    </PageTransition>
  );
}
