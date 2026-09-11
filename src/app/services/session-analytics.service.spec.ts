import { Commit } from "@models/Commit.model";
import { Repository } from "@models/Repository.model";
import { Session } from "@models/Session.model";
import { SessionAnalyticsService } from "./session-analytics.service";

describe("SessionAnalyticsService", () => {
  let service: SessionAnalyticsService;

  beforeEach(() => {
    service = new SessionAnalyticsService();
  });

  describe("computeDynamicGracePeriod", () => {
    it("should provide at least 3 minutes of base grace period", () => {
      const start = new Date("2025-01-10T14:00:00.000Z");
      const end = new Date("2025-01-10T16:00:00.000Z");
      const session = new Session(start, end, "Group A");

      // Single commit 2 minutes after end
      const c1 = new Commit("Done", "Alice", new Date("2025-01-10T16:02:00.000Z"), "url1");
      const repo = new Repository("url1", "Alice", [c1], "Group A");

      const grace = service.computeDynamicGracePeriod(session, [c1], [repo]);
      expect(grace.graceMinutes).toBeGreaterThanOrEqual(2);
      expect(grace.extendedStudentsCount).toBeGreaterThanOrEqual(1);
    });

    it("should extend continuously when multiple distinct students push in close succession", () => {
      const start = new Date("2025-01-10T14:00:00.000Z");
      const end = new Date("2025-01-10T16:00:00.000Z");
      const session = new Session(start, end, "Group A");

      // Commits at +2m, +5m, +8m, +11m by different students
      const c1 = new Commit("Done 1", "Alice", new Date("2025-01-10T16:02:00.000Z"), "url1");
      const c2 = new Commit("Done 2", "Bob", new Date("2025-01-10T16:05:00.000Z"), "url2");
      const c3 = new Commit("Done 3", "Charlie", new Date("2025-01-10T16:08:00.000Z"), "url3");
      const c4 = new Commit("Done 4", "David", new Date("2025-01-10T16:11:00.000Z"), "url4");

      const repos = [
        new Repository("url1", "Alice", [c1], "Group A"),
        new Repository("url2", "Bob", [c2], "Group A"),
        new Repository("url3", "Charlie", [c3], "Group A"),
        new Repository("url4", "David", [c4], "Group A"),
      ];

      const grace = service.computeDynamicGracePeriod(session, [c1, c2, c3, c4], repos);
      expect(grace.graceMinutes).toBe(11);
      expect(grace.extendedStudentsCount).toBe(4);
    });

    it("should not extend for an isolated commit after the base grace if gap is too large", () => {
      const start = new Date("2025-01-10T14:00:00.000Z");
      const end = new Date("2025-01-10T16:00:00.000Z");
      const session = new Session(start, end, "Group A");

      // Single commit at +12m (gap > 4m after base 3m)
      const c1 = new Commit("Late", "Alice", new Date("2025-01-10T16:12:00.000Z"), "url1");
      const repos = [new Repository("url1", "Alice", [c1], "Group A")];

      const grace = service.computeDynamicGracePeriod(session, [c1], repos);
      expect(grace.graceMinutes).toBe(3); // capped at base grace
      expect(grace.extendedStudentsCount).toBe(0);
    });

    it("should cap extension at 30 minutes maximum", () => {
      const start = new Date("2025-01-10T14:00:00.000Z");
      const end = new Date("2025-01-10T16:00:00.000Z");
      const session = new Session(start, end);

      const commits: Commit[] = [];
      const repos: Repository[] = [];
      // Continuous chain up to 45 minutes
      for (let i = 1; i <= 45; i += 2) {
        const time = new Date(end.getTime() + i * 60 * 1000);
        const name = `Student${i}`;
        const c = new Commit(`Done ${i}`, name, time, `url_${i}`);
        commits.push(c);
        repos.push(new Repository(`url_${i}`, name, [c]));
      }

      const grace = service.computeDynamicGracePeriod(session, commits, repos);
      expect(grace.graceMinutes).toBeLessThanOrEqual(30);
    });
  });

  describe("detectSuggestedSessions", () => {
    it("should detect a session when multiple students commit simultaneously", () => {
      const t1 = new Date("2025-02-15T14:05:00.000Z");
      const t2 = new Date("2025-02-15T14:20:00.000Z");
      const t3 = new Date("2025-02-15T15:10:00.000Z");
      const t4 = new Date("2025-02-15T15:45:00.000Z");

      const repos = [
        new Repository("u1", "S1", [new Commit("c1", "S1", t1, "u1"), new Commit("c2", "S1", t3, "u1")], "Gr1"),
        new Repository("u2", "S2", [new Commit("c3", "S2", t2, "u2"), new Commit("c4", "S2", t4, "u2")], "Gr1"),
        new Repository("u3", "S3", [new Commit("c5", "S3", t1, "u3"), new Commit("c6", "S3", t2, "u3")], "Gr1"),
      ];

      const suggestions = service.detectSuggestedSessions(repos, 120);
      expect(suggestions.length).toBeGreaterThan(0);
      const s = suggestions[0];
      expect(s.activeStudentsCount).toBe(3);
      expect(s.commitsCount).toBe(6);
      expect(s.session.startDate).toBeDefined();
      expect(s.session.endDate).toBeDefined();
      expect(s.session.label).toBeUndefined();
      expect(s.suggestedLabel).toBe("Séance 1");
    });
  });
});
