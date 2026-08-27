"use client";

import { motion } from "framer-motion";
import { Calculator, Delete, GripHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface CalculatorModalProps {
  onClose: () => void;
}

const DEFAULT_POSITION = { x: 24, y: 96 };

// ---------------------------------------------------------------------------
// Safe arithmetic/scientific expression evaluator.
// A small hand-written tokenizer + recursive-descent parser — no eval(), no
// external dependency. Supports + - * / ^ () unary minus, trailing %, the
// sqrt/sin/cos/tan/ln/log functions, and the pi/e constants.
// ---------------------------------------------------------------------------

class CalcError extends Error {}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = ch;
      i++;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        num += input[i];
        i++;
      }
      if ((num.match(/\./g) ?? []).length > 1) throw new CalcError("Invalid number");
      tokens.push(num);
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let word = ch;
      i++;
      while (i < input.length && /[a-zA-Z]/.test(input[i])) {
        word += input[i];
        i++;
      }
      tokens.push(word.toLowerCase());
      continue;
    }
    if ("+-*/^()%".includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }
    throw new CalcError(`Unexpected character "${ch}"`);
  }
  return tokens;
}

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };
const FUNCTION_NAMES = ["sqrt", "sin", "cos", "tan", "ln", "log"] as const;

function parseExpression(tokens: string[], angleMode: "deg" | "rad"): number {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  const toRad = (x: number) => (angleMode === "deg" ? (x * Math.PI) / 180 : x);

  const FUNCTIONS: Record<(typeof FUNCTION_NAMES)[number], (x: number) => number> = {
    sqrt: (x) => {
      if (x < 0) throw new CalcError("sqrt of a negative number");
      return Math.sqrt(x);
    },
    sin: (x) => Math.sin(toRad(x)),
    cos: (x) => Math.cos(toRad(x)),
    tan: (x) => Math.tan(toRad(x)),
    ln: (x) => {
      if (x <= 0) throw new CalcError("ln of a non-positive number");
      return Math.log(x);
    },
    log: (x) => {
      if (x <= 0) throw new CalcError("log of a non-positive number");
      return Math.log10(x);
    },
  };

  function parseExpr(): number {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const rhs = parseUnary();
      if (op === "/") {
        if (rhs === 0) throw new CalcError("Division by zero");
        value = value / rhs;
      } else {
        value = value * rhs;
      }
    }
    return value;
  }

  function parseUnary(): number {
    if (peek() === "-") {
      next();
      return -parseUnary();
    }
    if (peek() === "+") {
      next();
      return parseUnary();
    }
    return parsePostfix();
  }

  function parsePostfix(): number {
    let value = parsePower();
    while (peek() === "%") {
      next();
      value = value / 100;
    }
    return value;
  }

  function parsePower(): number {
    const base = parsePrimary();
    if (peek() === "^") {
      next();
      const exponent = parseUnary();
      return Math.pow(base, exponent);
    }
    return base;
  }

  function parsePrimary(): number {
    const token = peek();
    if (token === undefined) throw new CalcError("Unexpected end of expression");
    if (/^[0-9.]+$/.test(token)) {
      next();
      const n = Number(token);
      if (Number.isNaN(n)) throw new CalcError(`Invalid number "${token}"`);
      return n;
    }
    if (token === "(") {
      next();
      const value = parseExpr();
      if (peek() !== (")" as string)) throw new CalcError('Expected ")"');
      next();
      return value;
    }
    if (token in CONSTANTS) {
      next();
      return CONSTANTS[token];
    }
    if ((FUNCTION_NAMES as readonly string[]).includes(token)) {
      next();
      if (peek() !== "(") throw new CalcError(`Expected "(" after "${token}"`);
      next();
      const arg = parseExpr();
      if (peek() !== (")" as string)) throw new CalcError('Expected ")"');
      next();
      return FUNCTIONS[token as (typeof FUNCTION_NAMES)[number]](arg);
    }
    throw new CalcError(`Unexpected token "${token}"`);
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new CalcError(`Unexpected token "${tokens[pos]}"`);
  return result;
}

export function evaluateExpression(input: string, angleMode: "deg" | "rad" = "deg"): number {
  const trimmed = input.trim();
  if (!trimmed) throw new CalcError("Empty expression");
  const tokens = tokenize(trimmed);
  const result = parseExpression(tokens, angleMode);
  if (!Number.isFinite(result)) throw new CalcError("Result is not a finite number");
  return result;
}

function formatResult(n: number): string {
  const rounded = Number(n.toPrecision(12));
  return rounded.toString();
}

const SCI_BUTTON =
  "rounded-lg border border-border bg-surface px-2 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted";
const KEY_BUTTON =
  "rounded-lg border border-border bg-surface px-2 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-surface-muted";
const OP_BUTTON =
  "rounded-lg border border-border bg-surface-muted px-2 py-2.5 text-base font-semibold text-foreground transition-colors hover:bg-border";

export function CalculatorModal({ onClose }: CalculatorModalProps) {
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [expression, setExpression] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [angleMode, setAngleMode] = useState<"deg" | "rad">("deg");
  const draggingRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const dragAbortRef = useRef<AbortController | null>(null);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!draggingRef.current) return;
    setPosition({
      x: Math.max(0, event.clientX - draggingRef.current.offsetX),
      y: Math.max(0, event.clientY - draggingRef.current.offsetY),
    });
  }, []);

  const stopDragging = useCallback(() => {
    draggingRef.current = null;
    dragAbortRef.current?.abort();
    dragAbortRef.current = null;
  }, []);

  const startDragging = useCallback(
    (event: React.PointerEvent) => {
      draggingRef.current = { offsetX: event.clientX - position.x, offsetY: event.clientY - position.y };
      const controller = new AbortController();
      dragAbortRef.current = controller;
      window.addEventListener("pointermove", handlePointerMove, { signal: controller.signal });
      window.addEventListener("pointerup", stopDragging, { signal: controller.signal });
    },
    [handlePointerMove, position.x, position.y, stopDragging],
  );

  useEffect(() => () => dragAbortRef.current?.abort(), []);

  const insert = (token: string) => {
    setError(null);
    setExpression((prev) => prev + token);
  };

  const insertFunction = (name: string) => {
    setError(null);
    setExpression((prev) => `${prev}${name}(`);
  };

  const backspace = () => {
    setError(null);
    setExpression((prev) => prev.slice(0, -1));
  };

  const clearAll = () => {
    setError(null);
    setExpression("");
  };

  const toggleSign = () => {
    setError(null);
    setExpression((prev) => {
      if (!prev) return prev;
      const lastChar = prev.trimEnd().at(-1);
      if (lastChar && "+-*/^(".includes(lastChar)) return `${prev}-`;
      return `-(${prev})`;
    });
  };

  const evaluate = () => {
    try {
      const result = evaluateExpression(expression, angleMode);
      setExpression(formatResult(result));
      setError(null);
    } catch (err) {
      setError(err instanceof CalcError ? err.message : "Invalid expression");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (/^[0-9.+\-*/^()%]$/.test(event.key)) {
      event.preventDefault();
      insert(event.key);
    } else if (event.key === "Enter" || event.key === "=") {
      event.preventDefault();
      evaluate();
    } else if (event.key === "Backspace") {
      event.preventDefault();
      backspace();
    } else if (event.key === "Escape") {
      event.preventDefault();
      clearAll();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      role="dialog"
      aria-label="Calculator"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="fixed z-40 flex w-[19rem] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg outline-none sm:w-[22rem]"
      style={{ left: position.x, top: position.y }}
    >
      <div
        onPointerDown={startDragging}
        className="flex cursor-move items-center justify-between gap-2 border-b border-border bg-surface-muted px-3 py-2"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Calculator size={14} aria-hidden="true" />
          Calculator
        </div>
        <div className="flex items-center gap-2">
          <GripHorizontal size={14} className="text-foreground-muted" aria-hidden="true" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close calculator"
            className="rounded p-0.5 text-foreground-muted hover:bg-border hover:text-foreground"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 bg-background p-3">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-right">
          <output className="min-h-6 overflow-x-auto whitespace-nowrap font-mono text-lg text-foreground" aria-live="polite">
            {expression || "0"}
          </output>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          <button
            type="button"
            onClick={() => setAngleMode((m) => (m === "deg" ? "rad" : "deg"))}
            aria-pressed={angleMode === "rad"}
            className={cn(SCI_BUTTON, "text-xs uppercase")}
          >
            {angleMode}
          </button>
          <button type="button" onClick={() => insert("(")} className={SCI_BUTTON}>
            (
          </button>
          <button type="button" onClick={() => insert(")")} className={SCI_BUTTON}>
            )
          </button>
          <button type="button" onClick={() => insert("%")} className={SCI_BUTTON}>
            %
          </button>
          <button type="button" onClick={clearAll} aria-label="Clear" className={cn(SCI_BUTTON, "text-red-600")}>
            C
          </button>

          <button type="button" onClick={() => insertFunction("sin")} className={SCI_BUTTON}>
            sin
          </button>
          <button type="button" onClick={() => insertFunction("cos")} className={SCI_BUTTON}>
            cos
          </button>
          <button type="button" onClick={() => insertFunction("tan")} className={SCI_BUTTON}>
            tan
          </button>
          <button type="button" onClick={() => insert("^")} className={SCI_BUTTON}>
            x^y
          </button>
          <button type="button" onClick={backspace} aria-label="Backspace" className={SCI_BUTTON}>
            <Delete size={14} className="mx-auto" aria-hidden="true" />
          </button>

          <button type="button" onClick={() => insertFunction("ln")} className={SCI_BUTTON}>
            ln
          </button>
          <button type="button" onClick={() => insertFunction("log")} className={SCI_BUTTON}>
            log
          </button>
          <button type="button" onClick={() => insertFunction("sqrt")} className={SCI_BUTTON}>
            √
          </button>
          <button type="button" onClick={() => insert("pi")} className={SCI_BUTTON}>
            π
          </button>
          <button type="button" onClick={() => insert("e")} className={SCI_BUTTON}>
            e
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <button type="button" onClick={() => insert("7")} className={KEY_BUTTON}>
            7
          </button>
          <button type="button" onClick={() => insert("8")} className={KEY_BUTTON}>
            8
          </button>
          <button type="button" onClick={() => insert("9")} className={KEY_BUTTON}>
            9
          </button>
          <button type="button" onClick={() => insert("/")} aria-label="Divide" className={OP_BUTTON}>
            ÷
          </button>

          <button type="button" onClick={() => insert("4")} className={KEY_BUTTON}>
            4
          </button>
          <button type="button" onClick={() => insert("5")} className={KEY_BUTTON}>
            5
          </button>
          <button type="button" onClick={() => insert("6")} className={KEY_BUTTON}>
            6
          </button>
          <button type="button" onClick={() => insert("*")} aria-label="Multiply" className={OP_BUTTON}>
            ×
          </button>

          <button type="button" onClick={() => insert("1")} className={KEY_BUTTON}>
            1
          </button>
          <button type="button" onClick={() => insert("2")} className={KEY_BUTTON}>
            2
          </button>
          <button type="button" onClick={() => insert("3")} className={KEY_BUTTON}>
            3
          </button>
          <button type="button" onClick={() => insert("-")} aria-label="Subtract" className={OP_BUTTON}>
            −
          </button>

          <button type="button" onClick={toggleSign} aria-label="Toggle sign" className={KEY_BUTTON}>
            ±
          </button>
          <button type="button" onClick={() => insert("0")} className={KEY_BUTTON}>
            0
          </button>
          <button type="button" onClick={() => insert(".")} className={KEY_BUTTON}>
            .
          </button>
          <button type="button" onClick={() => insert("+")} aria-label="Add" className={OP_BUTTON}>
            +
          </button>
        </div>

        <button
          type="button"
          onClick={evaluate}
          className="rounded-lg bg-[var(--accent-current)] px-2 py-2.5 text-base font-semibold text-white transition-opacity hover:opacity-90"
        >
          =
        </button>
      </div>
    </motion.div>
  );
}
