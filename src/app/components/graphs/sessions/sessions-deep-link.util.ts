import type { SessionDetailedStats } from "@services/session-analytics.service";

/** Sub-tabs of the sessions view that a deep-link can target. */
export type SessionsSubTab = "matrix" | "students";

/** Target of the "Voir tout" deep-link coming from the session panel. */
export interface SessionsDeepLink {
  /** Start timestamp of the targeted session. */
  startMs: number;
  sub?: SessionsSubTab;
}

/**
 * Reads the deep-link query params: `session` is the target session start (ISO date) and `sub`
 * optionally opens one of the sub-tabs. Anything else (absent, unparsable) means "no deep-link".
 */
export function parseSessionsDeepLink(sessionParam: string | null, subParam: string | null): SessionsDeepLink | undefined {
  if (!sessionParam) {
    return undefined;
  }

  const startMs = new Date(sessionParam).getTime();
  if (isNaN(startMs)) {
    return undefined;
  }

  return {
    startMs,
    sub: subParam === "matrix" || subParam === "students" ? subParam : undefined,
  };
}

/** Index of the session targeted by the deep-link, or -1 when it is not in the list. */
export function findDeepLinkSessionIndex(stats: SessionDetailedStats[], startMs: number): number {
  return stats.findIndex((stat) => new Date(stat.session.startDate).getTime() === startMs);
}
