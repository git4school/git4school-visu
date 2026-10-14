import { Session } from "@models/Session.model";
import {
  compareSessions,
  computeOverlapGroups,
  findOverlapGroup,
  formatSelectionDuration,
  getGroupId,
  getSessionKeyNum,
  isSameSession,
  resolveActiveSession,
  resolveSessionAtDate,
  sessionCoversTime,
  SessionUidFactory,
  sessionsOverlap,
} from "./session-graph.util";

describe("session-graph.util", () => {
  const session = (start: string, end: string, extra: Partial<Session> = {}): Session =>
    ({
      startDate: new Date(start),
      endDate: new Date(end),
      tpGroup: "TP1",
      label: "Séance",
      ...extra,
    } as Session);

  const s9 = session("2026-01-01T09:00:00", "2026-01-01T10:00:00", { label: "A" });
  const s10 = session("2026-01-01T10:00:00", "2026-01-01T11:00:00", { label: "B" });
  const s930 = session("2026-01-01T09:30:00", "2026-01-01T10:30:00", { label: "C" });

  describe("sessionsOverlap", () => {
    it("should detect intersecting intervals only", () => {
      expect(sessionsOverlap(s9, s930)).toBeTrue();
      expect(sessionsOverlap(s930, s9)).toBeTrue();
      expect(sessionsOverlap(s9, s10)).toBeFalse();
    });
  });

  describe("compareSessions", () => {
    it("should order by start date, then end date, then group order, then label", () => {
      expect(compareSessions(s9, s10)).toBeLessThan(0);
      expect(compareSessions(s10, s9)).toBeGreaterThan(0);

      const shortSession = session("2026-01-01T09:00:00", "2026-01-01T09:30:00");
      expect(compareSessions(shortSession, s9)).toBeLessThan(0);

      const tp2 = session("2026-01-01T09:00:00", "2026-01-01T10:00:00", { tpGroup: "TP2" });
      expect(compareSessions(s9, tp2, ["TP1", "TP2"])).toBeLessThan(0);
      expect(compareSessions(tp2, s9, ["TP1", "TP2"])).toBeGreaterThan(0);

      const labelB = session("2026-01-01T09:00:00", "2026-01-01T10:00:00", { label: "B" });
      expect(compareSessions(s9, labelB)).toBeLessThan(0);
    });

    it("should push unreadable dates and missing sessions to the end", () => {
      const broken = session("n/a", "n/a");
      expect(compareSessions(broken, s9)).toBeGreaterThan(0);
      expect(compareSessions(s9, broken)).toBeLessThan(0);
      expect(compareSessions(null, s9)).toBeGreaterThan(0);
      expect(compareSessions(s9, null)).toBeLessThan(0);
      expect(compareSessions(null, null)).toBe(0);
    });
  });

  describe("computeOverlapGroups", () => {
    it("should group sessions that overlap, directly or transitively", () => {
      const groups = computeOverlapGroups([s9, s10, s930]);
      expect(groups.length).toBe(1);
      expect(groups[0].map((s) => s.label)).toEqual(["A", "C", "B"]);
    });

    it("should keep independent sessions in separate groups", () => {
      const groups = computeOverlapGroups([s9, s10]);
      expect(groups.length).toBe(2);
      expect(groups[0][0].label).toBe("A");
      expect(groups[1][0].label).toBe("B");
    });

    it("should handle an empty list", () => {
      expect(computeOverlapGroups([])).toEqual([]);
    });
  });

  describe("isSameSession / findOverlapGroup", () => {
    it("should compare sessions by value", () => {
      const clone = session("2026-01-01T09:00:00", "2026-01-01T10:00:00", { label: "A" });
      expect(isSameSession(s9, clone)).toBeTrue();
      expect(isSameSession(s9, s10)).toBeFalse();
      expect(isSameSession(s9, null)).toBeFalse();
      expect(isSameSession(s9, s9)).toBeTrue();
    });

    it("should find the group of an equal but distinct session", () => {
      const clone = session("2026-01-01T09:00:00", "2026-01-01T10:00:00", { label: "A" });
      const groups = computeOverlapGroups([s9, s930]);
      expect(findOverlapGroup(groups, clone)).toEqual(groups[0]);
      expect(findOverlapGroup(groups, s10)).toBeNull();
      expect(findOverlapGroup([], s9)).toBeNull();
    });
  });

  describe("getGroupId / getSessionKeyNum", () => {
    it("should build a stable id per group and a sort key per session", () => {
      expect(getGroupId([s9, s930])).toContain("_TP1_A__");
      expect(getGroupId([])).toBe("");
      expect(getSessionKeyNum(s9)).toBe(new Date("2026-01-01T09:00:00").getTime());
    });
  });

  describe("sessionCoversTime", () => {
    it("should include both boundaries and support inverted dates", () => {
      const at = (iso: string) => new Date(iso).getTime();
      expect(sessionCoversTime(s9, at("2026-01-01T09:00:00"))).toBeTrue();
      expect(sessionCoversTime(s9, at("2026-01-01T10:00:00"))).toBeTrue();
      expect(sessionCoversTime(s9, at("2026-01-01T10:00:01"))).toBeFalse();

      const inverted = session("2026-01-01T10:00:00", "2026-01-01T09:00:00");
      expect(sessionCoversTime(inverted, at("2026-01-01T09:30:00"))).toBeTrue();
    });
  });

  describe("resolveActiveSession", () => {
    const groups = computeOverlapGroups([s9, s930]);
    const context = { overlapGroups: groups, activeSessionIndices: new Map<string, number>() };

    it("should return the session itself when it does not overlap", () => {
      expect(resolveActiveSession(s10, { ...context, overlapGroups: [] })).toBe(s10);
    });

    it("should default to the first card of the group", () => {
      expect(resolveActiveSession(s930, context)).toBe(groups[0][0]);
    });

    it("should return the card selected in the group", () => {
      const indices = new Map<string, number>([[getGroupId(groups[0]), 1]]);
      expect(resolveActiveSession(s930, { ...context, activeSessionIndices: indices })).toBe(groups[0][1]);
    });
  });

  describe("resolveSessionAtDate", () => {
    const groups = computeOverlapGroups([s9, s930]);
    const context = {
      overlapGroups: groups,
      activeSessionIndices: new Map<string, number>(),
      lastFocusedSession: null as Session | null,
      visibleSessions: [s9, s10, s930],
    };
    const at = (iso: string) => new Date(iso);

    it("should prefer the session under the pointer", () => {
      expect(resolveSessionAtDate(at("2026-01-01T10:30:00"), s930, context)).toBe(s930);
    });

    it("should fall back on the group member covering the date", () => {
      expect(resolveSessionAtDate(at("2026-01-01T09:15:00"), s930, context)).toBe(s9);
    });

    it("should return null outside of every session", () => {
      expect(resolveSessionAtDate(at("2026-01-01T12:00:00"), undefined, context)).toBeNull();
    });

    it("should return the only candidate", () => {
      expect(resolveSessionAtDate(at("2026-01-01T10:15:00"), undefined, context)).toBe(s10);
    });

    it("should keep the invalid date fallback on the preferred session", () => {
      expect(resolveSessionAtDate(new Date("n/a"), s10, context)).toBe(s10);
      expect(resolveSessionAtDate(new Date("n/a"), undefined, context)).toBeNull();
    });

    it("should prioritize the active card when several sessions overlap", () => {
      context.activeSessionIndices.set(getGroupId(groups[0]), 1);
      expect(resolveSessionAtDate(at("2026-01-01T09:45:00"), undefined, context)).toBe(s930);
      context.activeSessionIndices.clear();
    });

    it("should fall back on the last focused session", () => {
      const focused = session("2026-01-01T09:00:00", "2026-01-01T11:00:00", { label: "D" });
      const shared = { ...context, visibleSessions: [focused, s9], lastFocusedSession: focused };
      expect(resolveSessionAtDate(at("2026-01-01T09:45:00"), undefined, shared)).toBe(focused);
    });
  });

  describe("formatSelectionDuration", () => {
    it("should format days, hours and minutes", () => {
      expect(formatSelectionDuration(new Date("2026-01-01T09:00:00"), new Date("2026-01-01T09:00:00"))).toBe("0min");
      expect(formatSelectionDuration(new Date("2026-01-01T09:00:00"), new Date("2026-01-01T09:45:00"))).toBe("45min");
      expect(formatSelectionDuration(new Date("2026-01-01T09:00:00"), new Date("2026-01-01T10:00:00"))).toBe("1h");
      expect(formatSelectionDuration(new Date("2026-01-01T09:00:00"), new Date("2026-01-01T10:30:00"))).toBe("1h 30min");
      expect(formatSelectionDuration(new Date("2026-01-01T09:00:00"), new Date("2026-01-03T10:00:00"))).toBe("2j 1h");
      expect(formatSelectionDuration(new Date("2026-01-03T09:00:00"), new Date("2026-01-01T10:00:00"))).toBe("1j 23h");
    });
  });

  describe("SessionUidFactory", () => {
    it("should give a stable, unique id per session", () => {
      const factory = new SessionUidFactory();
      const uid = factory.uid(s9);
      expect(uid).toBe(factory.uid(s9));
      expect(uid).toContain("_TP1_A_");
      expect(factory.uid(s10)).not.toBe(uid);
      expect(factory.uid(null)).toBe("unknown");
    });

    it("should sanitize group and label", () => {
      const factory = new SessionUidFactory();
      expect(factory.uid(session("2026-01-01T09:00:00", "2026-01-01T10:00:00", { tpGroup: "TP 1/2", label: "Cours #1" }))).toContain(
        "_TP_1_2_Cours__1_",
      );
    });
  });
});
