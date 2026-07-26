"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "stopped";

interface UseSpeakingRecorderResult {
  status: RecorderStatus;
  elapsedSeconds: number;
  audioUrl: string | null;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

// Real microphone capture via getUserMedia + MediaRecorder. Every component in the Speaking UI
// depends only on this hook's return shape, so PHASE2 can swap the recorded Blob upload target
// (e.g. stream it to the Speaking Evaluator agent over a WebSocket) without touching the UI.
export function useSpeakingRecorder(maxSeconds: number): UseSpeakingRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const maxSecondsRef = useRef(maxSeconds);
  maxSecondsRef.current = maxSeconds;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  const start = useCallback(() => {
    setError(null);

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Microphone recording isn't supported in this browser.");
      return;
    }

    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    setElapsedSeconds(0);
    chunksRef.current = [];

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          setAudioUrl(URL.createObjectURL(blob));
          releaseStream();
        };

        recorder.onerror = () => {
          setError("Recording failed unexpectedly. Please try again.");
          clearTimer();
          setStatus("stopped");
          releaseStream();
        };

        recorder.start();
        setStatus("recording");

        clearTimer();
        intervalRef.current = setInterval(() => {
          setElapsedSeconds((prev) => {
            if (prev + 1 >= maxSecondsRef.current) {
              clearTimer();
              if (recorderRef.current && recorderRef.current.state !== "inactive") {
                recorderRef.current.stop();
              }
              setStatus("stopped");
              return maxSecondsRef.current;
            }
            return prev + 1;
          });
        }, 1000);
      })
      .catch(() => {
        setError("Microphone access was denied. Please allow microphone access and try again.");
        setStatus("idle");
      });
  }, [clearTimer, releaseStream]);

  const stop = useCallback(() => {
    clearTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      releaseStream();
    }
    setStatus("stopped");
  }, [clearTimer, releaseStream]);

  const reset = useCallback(() => {
    clearTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    releaseStream();
    setStatus("idle");
    setElapsedSeconds(0);
    setError(null);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [clearTimer, releaseStream]);

  useEffect(
    () => () => {
      clearTimer();
      releaseStream();
    },
    [clearTimer, releaseStream],
  );

  return { status, elapsedSeconds, audioUrl, error, start, stop, reset };
}
