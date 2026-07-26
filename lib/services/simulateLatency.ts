// PHASE2: remove once services make real network/DB calls (which have their own latency).
export function simulateLatency(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
