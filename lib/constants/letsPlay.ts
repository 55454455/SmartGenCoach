// How long each question stays live before the host's browser (the sole timer authority — see
// letsPlayService.ts) automatically flips the room into 'reveal'. Shared by the game room page and
// the question/countdown component so they can never drift out of sync with each other.
export const QUESTION_SECONDS = 20;
