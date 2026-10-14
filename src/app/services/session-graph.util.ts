import { Session } from "@models/Session.model";

/**
 * Pure session helpers used by the commits graph.
 *
 * The graph renders several sessions that may overlap in time: each overlap group behaves like a
 * stack of cards where exactly one session is "active". All the geometry-free rules behind that
 * behaviour live here so they can be reasoned about (and tested) without D3 nor Angular.
 */

/** State needed to resolve which session is active inside an overlap group. */
export interface SessionResolutionContext {
  overlapGroups: Session[][];
  activeSessionIndices: Map<string, number>;
  lastFocusedSession: Session | null;
  /** Sessions currently displayed, already filtered by the TP group. */
  visibleSessions: Session[];
}

/** Natural comparison ("TP2" < "TP10"), shared to keep the comparisons readable. */
const NATURAL_COMPARE: Intl.CollatorOptions = { numeric: true, sensitivity: "base" };

/** Milliseconds of a session boundary, accepting both `Date` and ISO strings. */
export function sessionTime(date: Date | string): number {
  return date instanceof Date ? date.getTime() : new Date(date).getTime();
}

/** Two sessions overlap when their intervals intersect (strict comparison, touching is not overlapping). */
export function sessionsOverlap(a: Session, b: Session): boolean {
  return sessionTime(a.startDate) < sessionTime(b.endDate) && sessionTime(b.startDate) < sessionTime(a.endDate);
}

/**
 * Orders sessions by start date, then end date, then TP group (following the order declared by the
 * assignment) and finally by label. Unreadable dates are pushed to the end.
 */
export function compareSessions(a: Session, b: Session, tpGroups: string[] = []): number {
  const timeOrder = compareSessionTimes(a, b);
  if (timeOrder !== 0) return timeOrder;

  const groupOrder = compareGroups(groupOf(a), groupOf(b), tpGroups);
  if (groupOrder !== 0) return groupOrder;

  return (a?.label || "").localeCompare(b?.label || "", undefined, NATURAL_COMPARE);
}

/** Groups sessions that overlap, directly or transitively, and sorts every group. */
export function computeOverlapGroups(sessions: Session[], tpGroups: string[] = []): Session[][] {
  const comparator = (a: Session, b: Session) => compareSessions(a, b, tpGroups);
  const sorted = [...sessions].sort(comparator);
  const groups: Session[][] = [];
  const visited = new Set<Session>();

  for (const session of sorted) {
    if (visited.has(session)) continue;

    const group: Session[] = [session];
    visited.add(session);
    let changed = true;
    while (changed) {
      changed = false;
      for (const other of sorted) {
        if (visited.has(other)) continue;
        if (group.some((s) => sessionsOverlap(s, other))) {
          group.push(other);
          visited.add(other);
          changed = true;
        }
      }
    }
    groups.push(group.sort(comparator));
  }

  return groups;
}

/** Overlap group holding the given session (compared by identity, then by value). */
export function findOverlapGroup(overlapGroups: Session[][], session: Session): Session[] | null {
  if (!overlapGroups || !session) return null;
  return overlapGroups.find((group) => group.includes(session) || group.some((s) => isSameSession(s, session))) || null;
}

/** Same session, even when the two objects come from different data reloads. */
export function isSameSession(a: Session, b: Session): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return SESSION_IDENTITY_FIELDS.every((field) => field(a) === field(b));
}

/** Fields identifying a session across data reloads. */
const SESSION_IDENTITY_FIELDS: Array<(session: Session) => unknown> = [
  (session) => sessionTime(session.startDate),
  (session) => sessionTime(session.endDate),
  (session) => session.tpGroup || "",
  (session) => session.label || "",
];

/** Stable identifier of an overlap group, used as the key of the active-session map. */
export function getGroupId(group: Session[]): string {
  if (!group || group.length === 0) return "";
  return group.map((s) => `${sessionTime(s.startDate)}_${sessionTime(s.endDate)}_${s.tpGroup || "all"}_${s.label || ""}`).join("__");
}

/** Sort key of a session: its start timestamp. */
export function getSessionKeyNum(session: Session): number {
  return sessionTime(session.startDate);
}

/** Whether the session interval covers the given timestamp. */
export function sessionCoversTime(session: Session, time: number): boolean {
  if (!session || !session.startDate || !session.endDate) return false;
  const start = sessionTime(session.startDate);
  const end = sessionTime(session.endDate);
  return time >= Math.min(start, end) && time <= Math.max(start, end);
}

/** Session actually displayed for the given one: the active card of its overlap group. */
export function resolveActiveSession(
  session: Session,
  context: Pick<SessionResolutionContext, "overlapGroups" | "activeSessionIndices">,
): Session {
  if (!session) return session;
  const group = findOverlapGroup(context.overlapGroups, session);
  if (!group || group.length <= 1) return session;

  const activeIndex = context.activeSessionIndices.get(getGroupId(group)) ?? 0;
  return group[activeIndex] ?? group[0] ?? session;
}

/**
 * Session under the pointer: the preferred one when it covers the date, otherwise the best
 * candidate among the displayed sessions (active card first, then the last focused session).
 */
export function resolveSessionAtDate(
  rawDate: Date,
  preferredSession: Session | undefined,
  context: SessionResolutionContext,
): Session | null {
  if (!rawDate || isNaN(rawDate.getTime())) return preferredSession || null;
  const time = rawDate.getTime();

  if (preferredSession) {
    const fromPreferred = resolveFromPreferredSession(preferredSession, time, context);
    if (fromPreferred) return fromPreferred;
  }

  return pickSessionAtTime(time, context);
}

/** Session to use when the pointer sits on a session the user already interacted with. */
function resolveFromPreferredSession(preferred: Session, time: number, context: SessionResolutionContext): Session | null {
  if (sessionCoversTime(preferred, time)) {
    return preferred;
  }

  const group = findOverlapGroup(context.overlapGroups, preferred);
  const covering = group?.find((s) => sessionCoversTime(s, time));
  if (covering) return covering;

  const activeSession = resolveActiveSession(preferred, context);
  if (activeSession && sessionCoversTime(activeSession, time)) {
    return activeSession;
  }

  return null;
}

/** Among the displayed sessions, the one under the pointer (active card first, then last focused). */
function pickSessionAtTime(time: number, context: SessionResolutionContext): Session | null {
  const candidates = context.visibleSessions.filter((s) => sessionCoversTime(s, time));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  /* Plusieurs séances se chevauchent à cet instant : on privilégie celle qui est active. */
  const activeCandidate = candidates.find((candidate) => isSameSession(resolveActiveSession(candidate, context), candidate));
  if (activeCandidate) return activeCandidate;

  if (context.lastFocusedSession && candidates.some((c) => isSameSession(c, context.lastFocusedSession))) {
    return context.lastFocusedSession;
  }

  return candidates[0];
}

/** Human readable duration between two dates ("2j 3h 15min"). */
export function formatSelectionDuration(d1: Date, d2: Date): string {
  const diffMs = Math.max(d1.getTime(), d2.getTime()) - Math.min(d1.getTime(), d2.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  let text = "";
  if (days > 0) {
    text += `${days}j `;
  }
  if (hours > 0 || days > 0) {
    text += `${hours}h `;
  }
  if (minutes > 0 || (days === 0 && hours === 0)) {
    text += `${minutes}min`;
  }
  return text.trim();
}

/**
 * Gives every session a stable DOM id. Sessions are recreated on each data reload, so the id is
 * remembered per object instance and never reused (the counter keeps ids unique for animations).
 */
export class SessionUidFactory {
  private uids = new WeakMap<Session, string>();
  private nextUid = 1;

  public uid(session: Session): string {
    if (!session) return "unknown";

    let uid = this.uids.get(session);
    if (!uid) {
      const group = (session.tpGroup || "all").replace(/[^a-zA-Z0-9_-]/g, "_");
      const label = (session.label || "").replace(/[^a-zA-Z0-9_-]/g, "_");
      uid = `s_${sessionTime(session.startDate)}_${sessionTime(session.endDate)}_${group}_${label}_${this.nextUid++}`;
      this.uids.set(session, uid);
    }
    return uid;
  }
}

/** Compares two timestamps, unreadable ones being pushed to the end. */
function compareTimes(a: number, b: number): number {
  const aValid = !isNaN(a);
  const bValid = !isNaN(b);
  if (!aValid && !bValid) return 0;
  if (!aValid) return 1;
  if (!bValid) return -1;
  return a - b;
}

/** Orders two sessions by time; missing sessions and unreadable dates go last. */
function compareSessionTimes(a: Session, b: Session): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const startOrder = compareTimes(sessionTime(a.startDate), sessionTime(b.startDate));
  if (startOrder !== 0) return startOrder;

  return compareTimes(sessionTime(a.endDate), sessionTime(b.endDate));
}

/** Normalised TP group of a session. */
function groupOf(session: Session): string {
  return session?.tpGroup ? session.tpGroup.trim() : "";
}

/** TP groups follow the order declared by the assignment, unknown groups being compared naturally. */
function compareGroups(groupA: string, groupB: string, tpGroups: string[]): number {
  if (groupA === groupB) return 0;
  if (!groupA) return -1;
  if (!groupB) return 1;

  const indexA = tpGroups.indexOf(groupA);
  const indexB = tpGroups.indexOf(groupB);
  if (indexA !== -1 && indexB !== -1 && indexA !== indexB) return indexA - indexB;
  if (indexA !== -1 && indexB === -1) return -1;
  if (indexB !== -1 && indexA === -1) return 1;

  return groupA.localeCompare(groupB, undefined, NATURAL_COMPARE);
}
