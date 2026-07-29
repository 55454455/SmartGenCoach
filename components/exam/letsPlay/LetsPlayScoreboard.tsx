"use client";

import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Crown, Medal } from "lucide-react";
import { useEffect, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { LetsPlayPlayer } from "@/lib/types";

interface LetsPlayScoreboardProps {
  players: LetsPlayPlayer[]; // already sorted by score, descending
  selfUserId: string;
  confettiFired: RefObject<boolean>;
  onExit: () => void;
  onPlayAgain: () => void;
}

const MEDAL_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-700"];

export function LetsPlayScoreboard({ players, selfUserId, confettiFired, onExit, onPlayAgain }: LetsPlayScoreboardProps) {
  const winner = players[0];

  useEffect(() => {
    if (confettiFired.current || !winner) return;
    confettiFired.current = true;
    const duration = 2500;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors: ["#ea580c", "#facc15", "#22c55e"] });
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors: ["#ea580c", "#facc15", "#22c55e"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
    confetti({ particleCount: 120, spread: 100, origin: { y: 0.6 }, colors: ["#ea580c", "#facc15", "#22c55e", "#3b82f6"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-2 py-4 text-center"
      >
        <Crown size={40} className="text-yellow-500" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-foreground">
          {winner ? `${winner.name} wins!` : "Game over!"}
        </h1>
        <p className="text-sm text-foreground-muted">Final scoreboard</p>
      </motion.div>

      <Card>
        <ul className="flex flex-col gap-2">
          {players.map((player, index) => {
            const isSelf = player.userId === selfUserId;
            return (
              <motion.li
                key={player.userId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  isSelf ? "border-party bg-party-soft" : "border-border bg-surface"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-foreground-muted">
                    {index < 3 ? <Medal size={20} className={MEDAL_COLORS[index]} aria-hidden="true" /> : `#${index + 1}`}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-foreground">
                    {player.avatarInitials}
                  </span>
                  <span className="font-medium text-foreground">
                    {player.name}
                    {isSelf && <span className="ml-1.5 text-xs text-foreground-muted">(you)</span>}
                  </span>
                </div>
                <span className="text-lg font-bold text-party">{player.score}</span>
              </motion.li>
            );
          })}
        </ul>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onExit}>
          Back to Dashboard
        </Button>
        <Button accent="party" onClick={onPlayAgain}>
          Play Again
        </Button>
      </div>
    </div>
  );
}
