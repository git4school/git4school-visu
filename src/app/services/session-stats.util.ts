import type { Repository } from "@models/Repository.model";
import type {
  RibbonDataPoint,
  SessionDetailedStats,
  SessionHistogramBucket,
  SessionLiveIndicators,
  SessionProgressRibbonData,
  StudentSessionActivity,
  StudentWatchItem,
} from "./session-analytics.service";
import moment from "moment";

/**
 * Pure computations behind the session analytics: student health, commit histogram, cohort progress
 * ribbon and the live "pace / feed / resolved questions" indicators.
 *
 * They live outside `SessionAnalyticsService` so each rule can be tested on its own and so the
 * service only orchestrates data access. Everything is time-explicit (`...Ms` parameters come from
 * `ClockService` in the callers), which keeps these functions deterministic.
 */

export type RibbonPoint = SessionProgressRibbonData["studentCommitsPoints"][number];
export type PaceSection = SessionLiveIndicators["pace"];
export type ResolvedChart = SessionLiveIndicators["resolvedChart"];

/** Minutes covered by one bar of the commit histogram. */
export const HISTOGRAM_BUCKET_MINUTES = 15;
/** Minutes between two samples of the cohort progress ribbon. */
export const RIBBON_SAMPLE_MINUTES = 5;
/** Number of pace buckets kept for the live sparkline (the most recent ones). */
export const PACE_BUCKET_LIMIT = 16;

/** Linear-interpolated percentile over an already sorted array. */
export function percentile(sorted: number[], p: number): number {
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/** Mean / median / quartiles of the cohort values sampled at a given instant. */
export function calculateRibbonPoint(time: Date, relativeMinutes: number, values: number[]): RibbonDataPoint {
  if (!values || values.length === 0) {
    return { time, relativeMinutes, mean: 0, median: 0, q1: 0, q3: 0, min: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  return {
    time,
    relativeMinutes,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    median: percentile(sorted, 0.5),
    q1: percentile(sorted, 0.25),
    q3: percentile(sorted, 0.75),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/** A student who pushed twice or more is "active", once is "low", never is "inactive". */
export function classifyStudentStatus(inSessionCommits: number): StudentSessionActivity["status"] {
  if (inSessionCommits >= 2) return "active";
  if (inSessionCommits === 1) return "low";
  return "inactive";
}

/** Outcome of the per-repository pass: activity of one student plus his ribbon points. */
export interface RepoCommitSummary {
  inSessionCommitsCount: number;
  firstCommitDate?: Date;
  lastCommitDate?: Date;
  lastQuestionDone?: string;
  /** Questions closed during the session by this student. */
  closedQuestions: string[];
  /** Number of in-session closures per question, to aggregate over the whole cohort. */
  closuresByQuestion: Map<string, number>;
  ribbonPoints: RibbonPoint[];
}

/**
 * Walks the in-session commits of one repository to build its activity summary and the
 * per-commit points of the progress ribbon.
 */
export function summariseRepoCommits(
  repo: Repository,
  repoCommits: Repository["commits"],
  sessionStartMs: number,
  questions: string[],
  studentName: string,
): RepoCommitSummary {
  const summary: RepoCommitSummary = {
    inSessionCommitsCount: repoCommits.length,
    closedQuestions: [],
    closuresByQuestion: new Map<string, number>(),
    ribbonPoints: [],
  };
  const closedQuestions = new Set<string>();
  const repoId = repo.url || repo.name || repo.getDisplayName() || "repo";

  repoCommits.forEach((commit, index) => {
    const commitDate = new Date(commit.commitDate);
    if (!summary.firstCommitDate) {
      summary.firstCommitDate = commitDate;
    }
    summary.lastCommitDate = commitDate;

    if (commit.question) {
      summary.lastQuestionDone = commit.question;
    }
    if (commit.isCloture && commit.question) {
      closedQuestions.add(commit.question);
      summary.closuresByQuestion.set(commit.question, (summary.closuresByQuestion.get(commit.question) || 0) + 1);
    }

    summary.ribbonPoints.push({
      repoId,
      student: studentName,
      time: commitDate,
      relativeMinutes: Math.round((commitDate.getTime() - sessionStartMs) / 60000),
      questionIndex: commit.question ? questions.indexOf(commit.question) + 1 : 0,
      questionName: commit.question || "",
      cumulativeCommits: index + 1,
      isCloture: Boolean(commit.isCloture),
      commit,
    });
  });

  summary.closedQuestions = Array.from(closedQuestions);
  return summary;
}

/** In-session commits of a repository, chronological. */
export function commitsWithinWindow(commits: Repository["commits"], startMs: number, endMs: number) {
  return (commits || [])
    .filter((commit) => {
      const time = new Date(commit.commitDate).getTime();
      return time >= startMs && time <= endMs;
    })
    .sort((a, b) => new Date(a.commitDate).getTime() - new Date(b.commitDate).getTime());
}

/** Commit histogram of the session, one bucket every `bucketMinutes`. */
export function buildHistogramBuckets(
  points: RibbonPoint[],
  sessionStartMs: number,
  sessionEndMs: number,
  bucketMinutes = HISTOGRAM_BUCKET_MINUTES,
): SessionHistogramBucket[] {
  const bucketDurationMs = bucketMinutes * 60 * 1000;
  const durationMs = Math.max(1, sessionEndMs - sessionStartMs);
  const numBuckets = Math.max(1, Math.ceil(durationMs / bucketDurationMs));
  const buckets: SessionHistogramBucket[] = [];

  for (let index = 0; index < numBuckets; index++) {
    const startDate = new Date(sessionStartMs + index * bucketDurationMs);
    const endDate = new Date(Math.min(sessionEndMs, startDate.getTime() + bucketDurationMs));
    const bucketCommits = points.filter((point) => {
      const time = point.time.getTime();
      return time >= startDate.getTime() && time < endDate.getTime();
    });

    const countsByColor: { [colorKey: string]: number } = {};
    let closingCommitsCount = 0;
    bucketCommits.forEach((point) => {
      const color = point.commit.color?.name || "slate";
      countsByColor[color] = (countsByColor[color] || 0) + 1;
      if (point.isCloture) closingCommitsCount++;
    });

    buckets.push({
      startDate,
      endDate,
      label: moment(startDate).format("HH:mm"),
      total: bucketCommits.length,
      countsByColor,
      closingCommitsCount,
    });
  }

  return buckets;
}

/** Per-question closure counts, as a percentage of the eligible students. */
export function buildQuestionsSummary(
  questions: string[],
  closuresByQuestion: Map<string, number>,
  totalEligibleStudents: number,
): SessionDetailedStats["questionsSummary"] {
  return questions.map((question) => {
    const closedByCount = closuresByQuestion.get(question) || 0;
    return {
      question,
      closedByCount,
      percentage: totalEligibleStudents > 0 ? (closedByCount / totalEligibleStudents) * 100 : 0,
    };
  });
}

/** Cohort progress sampled every `sampleMinutes`, in questions then in cumulative commits. */
export function computeCohortSamples(
  cohort: Repository[],
  questions: string[],
  sessionStartMs: number,
  sessionEndMs: number,
  sampleMinutes = RIBBON_SAMPLE_MINUTES,
): Pick<SessionProgressRibbonData, "timePoints" | "questionsRibbon" | "commitsRibbon"> {
  const sampleMs = sampleMinutes * 60 * 1000;
  const durationMs = Math.max(1, sessionEndMs - sessionStartMs);
  const numSamples = Math.max(2, Math.ceil(durationMs / sampleMs) + 1);

  const timePoints: Date[] = [];
  const questionsRibbon: RibbonDataPoint[] = [];
  const commitsRibbon: RibbonDataPoint[] = [];

  for (let index = 0; index < numSamples; index++) {
    const sampleTimeMs = Math.min(sessionEndMs, sessionStartMs + index * sampleMs);
    timePoints.push(new Date(sampleTimeMs));

    const questionIndices: number[] = [];
    const commitCounts: number[] = [];

    cohort.forEach((repo) => {
      let maxQuestion = 0;
      let count = 0;
      repo.commits?.forEach((commit) => {
        const commitTime = new Date(commit.commitDate).getTime();
        if (commitTime >= sessionStartMs && commitTime <= sampleTimeMs) {
          count++;
        }
        if (commitTime <= sampleTimeMs && commit.question) {
          maxQuestion = Math.max(maxQuestion, questions.indexOf(commit.question) + 1);
        }
      });
      questionIndices.push(maxQuestion);
      commitCounts.push(count);
    });

    const relativeMinutes = Math.round((sampleTimeMs - sessionStartMs) / 60000);
    questionsRibbon.push(calculateRibbonPoint(new Date(sampleTimeMs), relativeMinutes, questionIndices));
    commitsRibbon.push(calculateRibbonPoint(new Date(sampleTimeMs), relativeMinutes, commitCounts));
  }

  return { timePoints, questionsRibbon, commitsRibbon };
}

/** Outcome of the live health pass over the session students. */
export interface StudentHealthResult {
  activeCount: number;
  watchCount: number;
  inactiveCount: number;
  activeStudents: string[];
  watchStudents: string[];
  inactiveStudents: string[];
  watchCandidates: StudentWatchItem[];
}

/**
 * Classifies the students of a running session as active / to nudge / inactive, using only the
 * commits that already happened relative to `nowMs`. The watch list is ordered inactive first,
 * then by longest idle time.
 */
export function classifyStudentHealth(
  students: StudentSessionActivity[],
  sessionStartMs: number,
  nowMs: number,
  staleMs: number,
): StudentHealthResult {
  const result: StudentHealthResult = {
    activeCount: 0,
    watchCount: 0,
    inactiveCount: 0,
    activeStudents: [],
    watchStudents: [],
    inactiveStudents: [],
    watchCandidates: [],
  };

  students.forEach((student) => {
    const pastCommits = commitsAfter((student.repository?.commits || []) as any[], sessionStartMs, nowMs);
    const lastPastMs = pastCommits.length > 0 ? pastCommits[pastCommits.length - 1] : undefined;

    if (pastCommits.length === 0) {
      result.inactiveCount++;
      result.inactiveStudents.push(student.studentName);
      result.watchCandidates.push({
        repository: student.repository,
        studentName: student.studentName,
        risk: "inactive",
        reasonKey: "SESSION-TAB.PANEL.WATCH.REASON-NO-COMMIT",
        inSessionCommitsCount: 0,
      });
      return;
    }

    if (lastPastMs !== undefined && nowMs - lastPastMs > staleMs) {
      result.watchCount++;
      result.watchStudents.push(student.studentName);
      result.watchCandidates.push({
        repository: student.repository,
        studentName: student.studentName,
        risk: "watch",
        reasonKey: "SESSION-TAB.PANEL.WATCH.REASON-STALE",
        reasonMinutes: Math.round((nowMs - lastPastMs) / 60000),
        inSessionCommitsCount: pastCommits.length,
      });
      return;
    }

    result.activeCount++;
    result.activeStudents.push(student.studentName);
  });

  result.watchCandidates.sort(compareWatchCandidates);
  return result;
}

/** Pace of the class: commits per elapsed bucket, capped to the most recent ones. */
export function buildPace(
  points: RibbonPoint[],
  histogramBuckets: SessionHistogramBucket[],
  sessionStartMs: number,
  nowMs: number,
  staleMs: number,
): PaceSection {
  const elapsedBuckets = (histogramBuckets || [])
    .filter((bucket) => new Date(bucket.startDate).getTime() <= nowMs)
    .slice(-PACE_BUCKET_LIMIT);

  const bucketTotals = elapsedBuckets.map((bucket) => {
    const startMs = new Date(bucket.startDate).getTime();
    const endMs = new Date(bucket.endDate).getTime();
    return {
      label: bucket.label,
      total: points.filter((point) => point.time.getTime() >= startMs && point.time.getTime() < endMs).length,
      isCurrent: nowMs >= startMs && nowMs < endMs,
    };
  });

  const maxTotal = bucketTotals.reduce((max, bucket) => Math.max(max, bucket.total), 1);
  const buckets = bucketTotals.map((bucket) => ({ ...bucket, height: Math.round((bucket.total / maxTotal) * 100) }));
  const commitsLast15 = points.filter((point) => nowMs - point.time.getTime() <= staleMs).length;
  const lastActivityMs = points.reduce((max, point) => Math.max(max, point.time.getTime()), sessionStartMs);

  return { buckets, commitsLast15, stalled: nowMs - lastActivityMs > staleMs };
}

/** Latest commits of the session, newest first. */
export function buildLiveFeed(points: RibbonPoint[], nowMs: number, limit: number) {
  return [...points]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, limit)
    .map((point) => {
      const minutesAgo = Math.max(0, Math.round((nowMs - point.time.getTime()) / 60000));
      return {
        studentName: point.student,
        questionName: point.questionName,
        isCloture: point.isCloture,
        minutesAgo,
        justNow: minutesAgo < 1,
        commitUrl: point.commit?.url || "",
      };
    });
}

/** Questions already resolved at `nowMs`, in the order declared by the assignment. */
export function resolveQuestionsFromPoints(points: RibbonPoint[], questions: string[]): string[] {
  const resolved = new Set<string>();
  points.forEach((point) => {
    if (point.isCloture && point.questionName) {
      resolved.add(point.questionName);
    }
  });
  return questions.filter((question) => resolved.has(question));
}

/**
 * Live scatter of the question completions (one dot per closing commit) with the group average
 * curve and the per-student progress trajectories.
 */
export function buildResolvedChart(
  points: RibbonPoint[],
  questionsRibbon: RibbonDataPoint[],
  startMs: number,
  nowMs: number,
  totalQuestions: number,
): ResolvedChart {
  const elapsed = Math.max(1, nowMs - startMs);
  const totalQuestionsSafe = Math.max(1, totalQuestions);
  const toPercentX = (timeMs: number) => clampPercent(((timeMs - startMs) / elapsed) * 100);
  const toPercentY = (rank: number) => clampPercent(100 - (rank / totalQuestionsSafe) * 100);

  const dots = points
    .filter((point) => point.isCloture && point.questionName && point.questionIndex > 0)
    .map((point) => ({
      x: toPercentX(point.time.getTime()),
      y: toPercentY(point.questionIndex),
      question: point.questionName,
      student: point.student,
      minutesAgo: Math.max(0, Math.round((nowMs - point.time.getTime()) / 60000)),
    }));

  const elapsedMinutes = Math.max(1, Math.round(elapsed / 60000));
  const average = (questionsRibbon || [])
    .filter((ribbon) => ribbon.time.getTime() <= nowMs)
    .map((ribbon) => ({
      x: clampPercent((ribbon.relativeMinutes / elapsedMinutes) * 100),
      y: clampPercent(100 - (ribbon.mean / totalQuestionsSafe) * 100),
    }));

  const trajectories: Record<string, Array<{ x: number; y: number }>> = {};
  groupPointsByStudent(points).forEach((studentPoints, student) => {
    let maxRank = 0;
    const trajectory: Array<{ x: number; y: number }> = [{ x: 0, y: 100 }];
    studentPoints.forEach((point) => {
      maxRank = Math.max(maxRank, point.questionIndex);
      trajectory.push({ x: toPercentX(point.time.getTime()), y: toPercentY(maxRank) });
    });
    trajectories[student] = trajectory;
  });

  return { dots, average, trajectories };
}

/** Inactives first, then the students idle for the longest time. */
function compareWatchCandidates(a: StudentWatchItem, b: StudentWatchItem): number {
  if (a.risk !== b.risk) {
    return a.risk === "inactive" ? -1 : 1;
  }
  return (b.reasonMinutes || 0) - (a.reasonMinutes || 0);
}

/** Timestamps of the commits inside the window, chronological. */
function commitsAfter(commits: Array<{ commitDate: Date }>, startMs: number, endMs: number): number[] {
  return commits
    .map((commit) => new Date(commit.commitDate).getTime())
    .filter((time) => time >= startMs && time <= endMs)
    .sort((a, b) => a - b);
}

/** Student points of the ribbon, grouped per student and sorted chronologically. */
function groupPointsByStudent(points: RibbonPoint[]): Map<string, RibbonPoint[]> {
  const byStudent = new Map<string, RibbonPoint[]>();
  points.forEach((point) => {
    const studentPoints = byStudent.get(point.student) || [];
    studentPoints.push(point);
    byStudent.set(point.student, studentPoints);
  });
  byStudent.forEach((studentPoints) => studentPoints.sort((a, b) => a.time.getTime() - b.time.getTime()));
  return byStudent;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}
