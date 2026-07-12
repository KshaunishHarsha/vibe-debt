// Datafast client-side goal tracking. No-ops if the snippet
// isn't loaded (localhost, ad blocker).
declare global {
  interface Window {
    datafast?: (goal: string, metadata?: Record<string, string>) => void;
  }
}

export function trackGoal(goal: string, metadata?: Record<string, string>) {
  if (typeof window !== "undefined") window.datafast?.(goal, metadata);
}
