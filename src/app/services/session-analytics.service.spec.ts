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

  describe("computeSessionStats / buildLiveIndicators", () => {
    const start = new Date("2026-03-10T14:00:00.000Z");
    const end = new Date("2026-03-10T16:00:00.000Z");
    const at = (minutes: number) => new Date(start.getTime() + minutes * 60000);

    const inSessionCommit = (question: string, minutes: number, isCloture = false, author = "A") => {
      const c = new Commit("msg", author, at(minutes), `url-${author}-${minutes}`);
      c.question = question;
      c.isCloture = isCloture;
      return c;
    };

    const session = new Session(start, end, "TP1");
    const repos = [
      new Repository("u1", "Alice", [inSessionCommit("q1", 10, true, "Alice"), inSessionCommit("q2", 30, false, "Alice")], "TP1"),
      new Repository("u2", "Bob", [inSessionCommit("q1", 20, true, "Bob")], "TP1"),
      new Repository("u3", "Carol", [inSessionCommit("q1", 300, false, "Carol")], "TP1"),
    ];

    it("should aggregate the session stats from the repositories", () => {
      const stats = service.computeSessionStats(session, repos, ["q1", "q2"]);

      expect(stats.totalEligibleStudents).toBe(3);
      expect(stats.activeStudentsCount).toBe(2);
      expect(stats.inactiveStudentsCount).toBe(1);
      expect(stats.inSessionCommitsCount).toBe(3);
      expect(Math.round(stats.participationRate)).toBe(67);
      expect(stats.inSessionRatio).toBe(75); // 3 commits en séance sur 4 sur la période
      expect(stats.resolvedQuestionsCount).toBe(1);
      expect(stats.questionsSummary).toEqual([
        { question: "q1", closedByCount: 2, percentage: (2 / 3) * 100 },
        { question: "q2", closedByCount: 0, percentage: 0 },
      ]);
      expect(stats.displayName).toBe("Séance (TP1)");

      const bucketTotal = stats.histogramBuckets.reduce((sum, bucket) => sum + bucket.total, 0);
      expect(bucketTotal).toBe(3);
      expect(stats.ribbonData.timePoints.length).toBeGreaterThan(10);
      expect(stats.ribbonData.studentCommitsPoints.length).toBe(3);
      expect(stats.ribbonData.commitsRibbon.length).toBe(stats.ribbonData.timePoints.length);

      const alice = stats.studentsActivity.find((s) => s.studentName.startsWith("Alice"));
      expect(alice.status).toBe("active");
      expect(alice.questionsCompletedInSession).toEqual(["q1"]);
      expect(alice.lastQuestionDone).toBe("q2");
    });

    it("should filter the repositories of other TP groups", () => {
      const otherGroup = new Repository("u4", "Dave", [inSessionCommit("q1", 15)], "TP2");
      const stats = service.computeSessionStats(session, [...repos, otherGroup], ["q1"]);
      expect(stats.totalEligibleStudents).toBe(3);
      expect(stats.studentsActivity.some((s) => s.studentName.startsWith("Dave"))).toBeFalse();
    });

    it("should build the live indicators from the computed stats", () => {
      const stats = service.computeSessionStats(session, repos, ["q1", "q2"]);
      const onlyUpTo = new Date(start.getTime() + 25 * 60000).getTime();
      const live = service.buildLiveIndicators(stats, onlyUpTo);

      expect(live.totalStudents).toBe(3);
      expect(live.activeCount).toBe(2);
      expect(live.inactiveCount).toBe(1);
      expect(live.watchCount).toBe(0);
      expect(live.totalQuestions).toBe(2);
      /* q2 n'est pas encore clôturée à la 25e minute. */
      expect(live.resolvedQuestions).toBe(1);
      expect(live.resolvedQuestionsList).toEqual(["q1"]);
      expect(live.questionsPct).toBe(50);
      expect(live.resolvedChart.dots.length).toBe(2);
      expect(Object.keys(live.resolvedChart.trajectories).length).toBeGreaterThan(0);
      expect(live.watchlist.length).toBe(1);
      expect(live.watchlist[0].risk).toBe("inactive");
      expect(live.pace.buckets.length).toBe(2);
      expect(live.feed.length).toBe(2);
      expect(live.feed[0].studentName.startsWith("Bob")).toBeTrue();
    });

    it("should ignore the commits that did not happen yet in the live indicators", () => {
      const stats = service.computeSessionStats(session, repos, ["q1"]);
      const beforeAnything = start.getTime();
      const live = service.buildLiveIndicators(stats, beforeAnything);

      expect(live.activeCount).toBe(0);
      expect(live.inactiveCount).toBe(3);
      expect(live.resolvedQuestions).toBe(0);
      expect(live.resolvedChart.dots).toEqual([]);
      expect(live.feed).toEqual([]);
      /* La première tranche est déjà ouverte à l'instant de départ. */
      expect(live.pace.buckets.length).toBe(1);
      expect(live.pace.buckets[0].total).toBe(0);
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
