import { findDeepLinkSessionIndex, parseSessionsDeepLink } from "./sessions-deep-link.util";
import { SessionDetailedStats } from "@services/session-analytics.service";

describe("sessions-deep-link.util", () => {
  describe("parseSessionsDeepLink", () => {
    it("should ignore a missing or unparsable session", () => {
      expect(parseSessionsDeepLink(null, null)).toBeUndefined();
      expect(parseSessionsDeepLink("", "matrix")).toBeUndefined();
      expect(parseSessionsDeepLink("pas-une-date", null)).toBeUndefined();
    });

    it("should read the targeted session start", () => {
      const deepLink = parseSessionsDeepLink("2026-01-05T09:00:00.000Z", null);
      expect(deepLink).toEqual({ startMs: new Date("2026-01-05T09:00:00.000Z").getTime(), sub: undefined });
    });

    it("should only accept the known sub-tabs", () => {
      const start = "2026-01-05T09:00:00.000Z";
      expect(parseSessionsDeepLink(start, "matrix")?.sub).toBe("matrix");
      expect(parseSessionsDeepLink(start, "students")?.sub).toBe("students");
      expect(parseSessionsDeepLink(start, "timeline")?.sub).toBeUndefined();
      expect(parseSessionsDeepLink(start, "")?.sub).toBeUndefined();
    });
  });

  describe("findDeepLinkSessionIndex", () => {
    const stats = [
      { session: { startDate: new Date("2026-01-05T09:00:00.000Z") } },
      { session: { startDate: new Date("2026-01-12T09:00:00.000Z") } },
    ] as SessionDetailedStats[];

    it("should find the session by its start date", () => {
      expect(findDeepLinkSessionIndex(stats, new Date("2026-01-12T09:00:00.000Z").getTime())).toBe(1);
    });

    it("should return -1 when the session is not in the list", () => {
      expect(findDeepLinkSessionIndex(stats, new Date("2026-01-19T09:00:00.000Z").getTime())).toBe(-1);
    });
  });
});
