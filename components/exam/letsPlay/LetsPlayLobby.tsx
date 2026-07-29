"use client";

import { Circle, Copy, Crown, LogOut } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { LetsPlayPlayer, LetsPlayRoom } from "@/lib/types";

interface LetsPlayLobbyProps {
  room: LetsPlayRoom;
  players: LetsPlayPlayer[];
  onlineUserIds: string[];
  isHost: boolean;
  onStart: () => void | Promise<void>;
  onLeave: () => void;
}

export function LetsPlayLobby({ room, players, onlineUserIds, isHost, onStart, onLeave }: LetsPlayLobbyProps) {
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied — the code is already visible on screen, nothing else to do.
    }
  }

  async function handleStart() {
    setStarting(true);
    try {
      await onStart();
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Room code</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className="text-3xl font-bold tracking-[0.3em] text-party">{room.code}</span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy room code"
            className="rounded-lg p-2 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
          >
            <Copy size={16} aria-hidden="true" />
          </button>
        </div>
        {copied && <p className="mt-1 text-xs text-party">Copied!</p>}
        <div className="mt-3 flex items-center justify-center gap-2">
          <Badge accent="party">{room.examType}</Badge>
          <Badge accent="party">{room.domain}</Badge>
          <Badge accent="neutral">{room.questions.length} questions</Badge>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Players ({players.length})</CardTitle>
        </CardHeader>
        <ul className="flex flex-col gap-2">
          {players.map((player) => {
            const online = onlineUserIds.includes(player.userId);
            return (
              <li
                key={player.userId}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-party-soft text-xs font-semibold text-party">
                    {player.avatarInitials}
                  </span>
                  <span className="text-sm font-medium text-foreground">{player.name}</span>
                  {player.userId === room.hostId && <Crown size={14} className="text-party" aria-hidden="true" />}
                </div>
                <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
                  <Circle size={8} className={online ? "fill-green-500 text-green-500" : "fill-border text-border"} aria-hidden="true" />
                  {online ? "Online" : "Connecting…"}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onLeave} icon={<LogOut size={16} aria-hidden="true" />}>
          Leave
        </Button>
        {isHost ? (
          <Button accent="party" onClick={handleStart} disabled={starting || room.questions.length === 0}>
            {starting ? "Starting…" : "Start Game"}
          </Button>
        ) : (
          <p className="text-sm text-foreground-muted">Waiting for the host to start the game…</p>
        )}
      </div>
    </div>
  );
}
