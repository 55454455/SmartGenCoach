import { create } from "zustand";

interface ExamRunnerState {
  currentModuleIndex: number;
  currentQuestionIndex: number;
  answers: Record<string, string>; // questionId -> choiceId
  flagged: Record<string, boolean>;
  eliminated: Record<string, string[]>; // questionId -> eliminated choice ids
  timerHidden: boolean;
  calculatorOpen: boolean;
  eliminatorMode: boolean;
  navigatorOpen: boolean;
  directionsOpen: boolean;

  goToQuestion: (index: number) => void;
  nextQuestion: (moduleLength: number) => void;
  prevQuestion: () => void;
  advanceModule: () => void;
  selectAnswer: (questionId: string, choiceId: string) => void;
  toggleFlag: (questionId: string) => void;
  toggleEliminated: (questionId: string, choiceId: string) => void;
  toggleTimerHidden: () => void;
  toggleCalculator: () => void;
  toggleEliminatorMode: () => void;
  toggleNavigator: () => void;
  toggleDirections: () => void;
  reset: () => void;
}

const initialState = {
  currentModuleIndex: 0,
  currentQuestionIndex: 0,
  answers: {},
  flagged: {},
  eliminated: {},
  timerHidden: false,
  calculatorOpen: false,
  eliminatorMode: false,
  navigatorOpen: false,
  directionsOpen: false,
};

// PHASE2: on submit, POST { answers, flagged, durations } to the Orchestrator Agent for scoring.
export const useExamRunnerStore = create<ExamRunnerState>()((set, get) => ({
  ...initialState,
  goToQuestion: (index) => set({ currentQuestionIndex: index, navigatorOpen: false }),
  nextQuestion: (moduleLength) =>
    set({ currentQuestionIndex: Math.min(get().currentQuestionIndex + 1, moduleLength - 1) }),
  prevQuestion: () => set({ currentQuestionIndex: Math.max(get().currentQuestionIndex - 1, 0) }),
  advanceModule: () =>
    set({ currentModuleIndex: get().currentModuleIndex + 1, currentQuestionIndex: 0 }),
  selectAnswer: (questionId, choiceId) =>
    set({ answers: { ...get().answers, [questionId]: choiceId } }),
  toggleFlag: (questionId) =>
    set({ flagged: { ...get().flagged, [questionId]: !get().flagged[questionId] } }),
  toggleEliminated: (questionId, choiceId) => {
    const current = get().eliminated[questionId] ?? [];
    const next = current.includes(choiceId) ? current.filter((c) => c !== choiceId) : [...current, choiceId];
    set({ eliminated: { ...get().eliminated, [questionId]: next } });
  },
  toggleTimerHidden: () => set({ timerHidden: !get().timerHidden }),
  toggleCalculator: () => set({ calculatorOpen: !get().calculatorOpen }),
  toggleEliminatorMode: () => set({ eliminatorMode: !get().eliminatorMode }),
  toggleNavigator: () => set({ navigatorOpen: !get().navigatorOpen }),
  toggleDirections: () => set({ directionsOpen: !get().directionsOpen }),
  reset: () => set(initialState),
}));
