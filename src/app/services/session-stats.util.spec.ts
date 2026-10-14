import { Commit } from "@models/Commit.model";
import { Repository } from "@models/Repository.model";
import {
  buildHistogramBuckets,
  buildLiveFeed,
  buildPace,
  buildQuestionsSummary,
  buildResolvedChart,
  calculateRibbonPoint,
  classifyStudentHealth,
  classifyStudentStatus,
  commitsWithinWindow,
  computeCohortSamples,
  percentile,
  resolveQuestionsFromPoints,
  RibbonPoint,
  summariseRepoCommits,
} from "./session-stats.util";
import { StudentSessionActivity } from "./session-analytics.service";

describe("session-stats.util", () => {
  const T0 = new Date("2026-03-10T14:00:00.000Z");
  const at = (minutes: number) => new Date(T0.getTime() + minutes * 60000);
  const T0_MS = T0.getTime();
  const sessionEndMs = at(60).getTime();

  const commit = (question: string, minutes: number, options: { cloture?: boolean; color?: string } = {}): Commit => {
    const c = new Commit("msg", "Alice", at(minutes), `url-${question}-${minutes}`);
    c.question = question;
    c.isCloture = Boolean(options.cloture);
    if (options.color) {
      c.color = { name: options.color, label: options.color, labelKey: options.color } as any;
    }
    return c;
  };

  const ribbonPoint = (
    student: string,
    minutes: number,
    questionIndex: number,
    options: { cloture?: boolean; question?: string } = {},
  ): RibbonPoint =>
    ({
      repoId: "r",
      student,
      time: at(minutes),
      relativeMinutes: minutes,
      questionIndex,
      questionName: options.question ?? "",
      cumulativeCommits: 1,
      isCloture: Boolean(options.cloture),
      commit: commit(options.question ?? "", minutes),
    } as RibbonPoint);

  describe("percentile / calculateRibbonPoint", () => {
    it("should interpolate quartiles on a sorted sample", () => {
      expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
      expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
      expect(percentile([4], 0.75)).toBe(4);
    });

    it("should summarise a cohort sample", () => {
      const point = calculateRibbonPoint(T0, 0, [1, 3, 5]);
      expect(point.mean).toBe(3);
      expect(point.median).toBe(3);
      expect(point.q1).toBe(2);
      expect(point.q3).toBe(4);
      expect(point.min).toBe(1);
      expect(point.max).toBe(5);
    });

    it("should fall back to zeros without values", () => {
      const point = calculateRibbonPoint(T0, 5, []);
      expect(point).toEqual({ time: T0, relativeMinutes: 5, mean: 0, median: 0, q1: 0, q3: 0, min: 0, max: 0 });
    });
  });

  describe("classifyStudentStatus", () => {
    it("should map the commit count to a status", () => {
      expect(classifyStudentStatus(0)).toBe("inactive");
      expect(classifyStudentStatus(1)).toBe("low");
      expect(classifyStudentStatus(2)).toBe("active");
      expect(classifyStudentStatus(9)).toBe("active");
    });
  });

  describe("commitsWithinWindow", () => {
    it("should keep the window bounds and sort chronologically", () => {
      const commits = [commit("q", 10), commit("q", -5), commit("q", 60), commit("q", 61), commit("q", 0)];
      const kept = commitsWithinWindow(commits, T0_MS, sessionEndMs);
      expect(kept.length).toBe(3);
      expect(new Date(kept[0].commitDate).getTime()).toBe(T0_MS);
      expect(new Date(kept[2].commitDate).getTime()).toBe(sessionEndMs);
    });

    it("should tolerate missing commits", () => {
      expect(commitsWithinWindow(undefined, T0_MS, sessionEndMs)).toEqual([]);
    });
  });

  describe("summariseRepoCommits", () => {
    it("should aggregate activity, closures and ribbon points", () => {
      const repo = new Repository("https://repo", "Alice", [], "TP1");
      const commits = [commit("q1", 5), commit("q1", 10, { cloture: true }), commit("q2", 20, { cloture: true })];
      const summary = summariseRepoCommits(repo, commits, T0_MS, ["q1", "q2", "q3"], "Alice");

      expect(summary.inSessionCommitsCount).toBe(3);
      expect(summary.closedQuestions.sort()).toEqual(["q1", "q2"]);
      expect(summary.closuresByQuestion.get("q1")).toBe(1);
      expect(summary.lastQuestionDone).toBe("q2");
      expect(summary.firstCommitDate).toEqual(at(5));
      expect(summary.lastCommitDate).toEqual(at(20));
      expect(summary.ribbonPoints.length).toBe(3);
      expect(summary.ribbonPoints[0].relativeMinutes).toBe(5);
      expect(summary.ribbonPoints[0].questionIndex).toBe(1);
      expect(summary.ribbonPoints[2].cumulativeCommits).toBe(3);
      expect(summary.ribbonPoints[1].isCloture).toBe(true);
    });

    it("should use a rank of zero for commits without a question", () => {
      const repo = new Repository("https://repo", "Alice", []);
      const summary = summariseRepoCommits(repo, [commit("", 1)], T0_MS, ["q1"], "Alice");
      expect(summary.ribbonPoints[0].questionIndex).toBe(0);
      expect(summary.closedQuestions).toEqual([]);
      expect(summary.lastQuestionDone).toBeUndefined();
    });
  });

  describe("buildHistogramBuckets", () => {
    it("should bucket the commits every 15 minutes and count the closures per colour", () => {
      const points = [
        ribbonPoint("A", 1, 1, { cloture: true }),
        ribbonPoint("B", 2, 1),
        ribbonPoint("C", 16, 2, { cloture: true }),
        ribbonPoint("D", 59, 3),
      ];
      points[0].commit.color = { name: "green", label: "green", labelKey: "green" } as any;
      points[1].commit.color = { name: "green", label: "green", labelKey: "green" } as any;

      const buckets = buildHistogramBuckets(points, T0_MS, sessionEndMs);
      expect(buckets.length).toBe(4);
      expect(buckets[0].total).toBe(2);
      expect(buckets[0].closingCommitsCount).toBe(1);
      expect(buckets[0].countsByColor["green"]).toBe(2);
      expect(buckets[1].total).toBe(1);
      expect(buckets[3].total).toBe(1);
      expect(buckets[0].label).toMatch(/\d{2}:\d{2}/);
    });

    it("should always produce at least one bucket", () => {
      expect(buildHistogramBuckets([], T0_MS, T0_MS).length).toBe(1);
    });
  });

  describe("buildQuestionsSummary", () => {
    it("should express the closures as a share of the eligible students", () => {
      const summary = buildQuestionsSummary(["q1", "q2"], new Map([["q1", 3]]), 6);
      expect(summary).toEqual([
        { question: "q1", closedByCount: 3, percentage: 50 },
        { question: "q2", closedByCount: 0, percentage: 0 },
      ]);
    });

    it("should not divide by zero without students", () => {
      expect(buildQuestionsSummary(["q1"], new Map(), 0)[0].percentage).toBe(0);
    });
  });

  describe("computeCohortSamples", () => {
    it("should sample the cohort every 5 minutes for both metrics", () => {
      const repos = [
        new Repository("u1", "A", [commit("q1", 10, { cloture: true }), commit("q2", 30)]),
        new Repository("u2", "B", [commit("q1", 20)]),
      ];
      const samples = computeCohortSamples(repos, ["q1", "q2"], T0_MS, sessionEndMs);

      expect(samples.timePoints.length).toBeGreaterThan(10);
      expect(samples.questionsRibbon.length).toBe(samples.timePoints.length);
      expect(samples.commitsRibbon.length).toBe(samples.timePoints.length);
      expect(samples.questionsRibbon[0].mean).toBe(0);
      /* Le dernier échantillon voit 2 commits pour A et 1 pour B : max = 2, moyenne = 1,5. */
      expect(samples.commitsRibbon[samples.commitsRibbon.length - 1].max).toBe(2);
      expect(samples.commitsRibbon[samples.commitsRibbon.length - 1].mean).toBe(1.5);
      expect(samples.questionsRibbon[samples.questionsRibbon.length - 1].max).toBe(2);
    });

    it("should sample at least twice on a very short session", () => {
      const samples = computeCohortSamples([], ["q1"], T0_MS, T0_MS + 1000);
      expect(samples.timePoints.length).toBe(2);
    });
  });

  describe("classifyStudentHealth", () => {
    const student = (name: string, commits: Commit[]): StudentSessionActivity =>
      ({
        repository: new Repository(`u-${name}`, name, commits),
        studentName: name,
        inSessionCommitsCount: commits.length,
        totalCommitsCount: commits.length,
        status: "active",
        questionsCompletedInSession: [],
      } as StudentSessionActivity);

    it("should split the students in active / to nudge / inactive and order the watch list", () => {
      const nowMs = at(40).getTime();
      const staleMs = 15 * 60000;
      const students = [student("Active", [commit("q1", 35)]), student("Idle", [commit("q1", 10)]), student("Ghost", [commit("q1", -30)])];

      const health = classifyStudentHealth(students, T0_MS, nowMs, staleMs);
      expect(health.activeCount).toBe(1);
      expect(health.activeStudents).toEqual(["Active"]);
      expect(health.watchCount).toBe(1);
      expect(health.watchStudents).toEqual(["Idle"]);
      expect(health.inactiveCount).toBe(1);
      expect(health.inactiveStudents).toEqual(["Ghost"]);
      expect(health.watchCandidates.map((c) => c.risk)).toEqual(["inactive", "watch"]);
      expect(health.watchCandidates[1].reasonMinutes).toBe(30);
      expect(health.watchCandidates[1].reasonKey).toBe("SESSION-TAB.PANEL.WATCH.REASON-STALE");
    });

    it("should ignore commits made after now", () => {
      const nowMs = at(10).getTime();
      const students = [student("Future", [commit("q1", 30)])];
      const health = classifyStudentHealth(students, T0_MS, nowMs, 15 * 60000);
      expect(health.inactiveCount).toBe(1);
    });

    it("should order two idle students by longest idle time", () => {
      const nowMs = at(60).getTime();
      const students = [student("Recent", [commit("q1", 40)]), student("Old", [commit("q1", 20)])];
      const health = classifyStudentHealth(students, T0_MS, nowMs, 15 * 60000);
      expect(health.watchCandidates.map((c) => c.studentName)).toEqual(["Old", "Recent"]);
    });
  });

  describe("buildPace", () => {
    it("should size the buckets relatively to the busiest one and flag a stalled class", () => {
      const points = [ribbonPoint("A", 1, 1), ribbonPoint("A", 2, 1), ribbonPoint("B", 16, 1), ribbonPoint("B", 37, 1)];
      const buckets = buildHistogramBuckets(points, T0_MS, sessionEndMs);
      const nowMs = at(40).getTime();

      const pace = buildPace(points, buckets, T0_MS, nowMs, 15 * 60000);
      expect(pace.buckets.length).toBe(3);
      expect(pace.buckets[0].total).toBe(2);
      expect(pace.buckets[0].height).toBe(100);
      expect(pace.buckets[1].height).toBe(50);
      expect(pace.buckets[2].isCurrent).toBeTrue();
      expect(pace.commitsLast15).toBe(1);
      expect(pace.stalled).toBeFalse();
    });

    it("should report a stalled class when the last commit is older than the threshold", () => {
      const points = [ribbonPoint("A", 1, 1)];
      const pace = buildPace(points, buildHistogramBuckets(points, T0_MS, sessionEndMs), T0_MS, at(40).getTime(), 15 * 60000);
      expect(pace.stalled).toBeTrue();
      expect(pace.commitsLast15).toBe(0);
    });

    it("should drop the future buckets", () => {
      const buckets = buildHistogramBuckets([], T0_MS, sessionEndMs);
      const pace = buildPace([], buckets, T0_MS, at(20).getTime(), 15 * 60000);
      expect(pace.buckets.length).toBe(2);
    });
  });

  describe("buildLiveFeed", () => {
    it("should return the newest commits first with their age", () => {
      const points = [ribbonPoint("A", 1, 1), ribbonPoint("B", 10, 1, { cloture: true, question: "q2" })];
      const feed = buildLiveFeed(points, at(11).getTime(), 4);
      expect(feed.length).toBe(2);
      expect(feed[0].studentName).toBe("B");
      expect(feed[0].minutesAgo).toBe(1);
      expect(feed[0].justNow).toBeFalse();
      expect(feed[0].commitUrl).toContain("url-");
      expect(feed[1].studentName).toBe("A");
    });

    it("should cap the feed and mark a fresh commit", () => {
      const points = [ribbonPoint("A", 10, 1), ribbonPoint("B", 10.2, 1)];
      const feed = buildLiveFeed(points, at(10.4).getTime(), 1);
      expect(feed.length).toBe(1);
      expect(feed[0].justNow).toBeTrue();
    });
  });

  describe("resolveQuestionsFromPoints", () => {
    it("should return the questions closed up to now, in the declared order", () => {
      const points = [ribbonPoint("A", 5, 1, { cloture: true, question: "q2" }), ribbonPoint("B", 6, 1, { question: "q1" })];
      expect(resolveQuestionsFromPoints(points, ["q1", "q2", "q3"])).toEqual(["q2"]);
    });
  });

  describe("buildResolvedChart", () => {
    it("should place the dots, the average curve and the trajectories in a 0..100 box", () => {
      const points = [
        ribbonPoint("A", 10, 1, { cloture: true, question: "q1" }),
        ribbonPoint("A", 20, 2, { cloture: true, question: "q2" }),
        ribbonPoint("B", 30, 1, { cloture: true, question: "q1" }),
      ];
      const ribbon = [
        calculateRibbonPoint(at(10), 10, [1]),
        calculateRibbonPoint(at(20), 20, [1.5]),
        calculateRibbonPoint(at(90), 90, [2]),
      ];
      const chart = buildResolvedChart(points, ribbon, T0_MS, at(40).getTime(), 2);

      expect(chart.dots.length).toBe(3);
      expect(chart.dots.map((d) => d.question)).toEqual(["q1", "q2", "q1"]);
      expect(chart.dots[0].y).toBe(50);
      expect(chart.dots[1].y).toBe(0);
      expect(Math.max(...chart.dots.map((d) => d.x))).toBeLessThanOrEqual(100);
      expect(chart.dots[0].minutesAgo).toBe(30);

      /* La courbe moyenne s'arrête à maintenant (le point à 90 min est futur). */
      expect(chart.average.length).toBe(2);
      expect(chart.average[0].y).toBe(50);

      expect(Object.keys(chart.trajectories)).toEqual(["A", "B"]);
      expect(chart.trajectories["A"][0]).toEqual({ x: 0, y: 100 });
      expect(chart.trajectories["A"].length).toBe(3);
      expect(chart.trajectories["A"][2].y).toBe(0);
    });

    it("should ignore commits without a question rank", () => {
      const points = [ribbonPoint("A", 10, 0, { cloture: true, question: "" })];
      const chart = buildResolvedChart(points, [], T0_MS, at(20).getTime(), 1);
      expect(chart.dots).toEqual([]);
    });
  });
});
