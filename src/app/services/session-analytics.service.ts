import { Injectable } from "@angular/core";
import { Commit, CommitColor } from "@models/Commit.model";
import { Repository } from "@models/Repository.model";
import { Session } from "@models/Session.model";
import { AnonymizationService } from "@services/anonymization.service";
import { Utils } from "@services/utils";
import * as moment from "moment";

export interface GracePeriodResult {
  effectiveEndDate: Date;
  graceMinutes: number;
  extendedStudentsCount: number;
  isExtended: boolean;
}

export interface StudentSessionActivity {
  repository: Repository;
  studentName: string;
  tpGroup?: string;
  inSessionCommitsCount: number;
  totalCommitsCount: number;
  firstCommitDate?: Date;
  lastCommitDate?: Date;
  lastQuestionDone?: string;
  status: "active" | "low" | "inactive";
  questionsCompletedInSession: string[];
}

export interface SessionHistogramBucket {
  startDate: Date;
  endDate: Date;
  label: string;
  total: number;
  countsByColor: { [colorKey: string]: number };
  closingCommitsCount: number;
}

export interface RibbonDataPoint {
  time: Date;
  relativeMinutes: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

export interface SessionProgressRibbonData {
  timePoints: Date[];
  questionsRibbon: RibbonDataPoint[];
  commitsRibbon: RibbonDataPoint[];
  studentCommitsPoints: Array<{
    repoId: string;
    student: string;
    time: Date;
    relativeMinutes: number;
    questionIndex: number;
    questionName: string;
    cumulativeCommits: number;
    isCloture: boolean;
    commit: Commit;
  }>;
}

export interface SessionDetailedStats {
  session: Session;
  displayName: string;
  tpGroup?: string;
  gracePeriod: GracePeriodResult;
  totalEligibleStudents: number;
  activeStudentsCount: number;
  inactiveStudentsCount: number;
  studentsWithoutResolvedQuestionsCount: number;
  participationRate: number;
  inSessionCommitsCount: number;
  totalPeriodCommitsCount: number;
  inSessionRatio: number;
  resolvedQuestionsCount: number;
  questionsSummary: Array<{
    question: string;
    closedByCount: number;
    percentage: number;
  }>;
  histogramBuckets: SessionHistogramBucket[];
  ribbonData: SessionProgressRibbonData;
  studentsActivity: StudentSessionActivity[];
}

export type StudentRisk = "active" | "watch" | "inactive";

export interface StudentWatchItem {
  repository: Repository;
  studentName: string;
  risk: StudentRisk;
  /** i18n key explaining why the student needs attention. */
  reasonKey: string;
  /** Minutes since the last commit, when the reason is time-based. */
  reasonMinutes?: number;
  inSessionCommitsCount: number;
}

export interface PaceBucket {
  label: string;
  total: number;
  isCurrent: boolean;
  /** 0..100 bar height, relative to the busiest elapsed bucket. */
  height: number;
}

export interface LiveFeedItem {
  studentName: string;
  questionName: string;
  isCloture: boolean;
  minutesAgo: number;
  justNow: boolean;
  commitUrl: string;
}

/**
 * Actionable "live cockpit" indicators derived from the detailed stats, so the teacher can
 * orchestrate the session: who needs help, the class pace and the latest activity.
 */
export interface SessionLiveIndicators {
  activeCount: number;
  watchCount: number;
  inactiveCount: number;
  totalStudents: number;
  resolvedQuestions: number;
  totalQuestions: number;
  questionsPct: number;
  /** Student names per health bucket (for the hover tooltips). */
  activeStudents: string[];
  watchStudents: string[];
  inactiveStudents: string[];
  /** Names of the resolved questions (for the hover tooltip). */
  resolvedQuestionsList: string[];
  /** Live resolved-questions scatter (one dot per completion) + group average progress curve. */
  resolvedChart: {
    dots: Array<{ x: number; y: number; question: string; student: string; minutesAgo: number }>;
    average: Array<{ x: number; y: number }>;
    /** Per-student cumulative progress trajectory (0..100 box), keyed by student name. */
    trajectories: Record<string, Array<{ x: number; y: number }>>;
  };
  watchlist: StudentWatchItem[];
  pace: {
    buckets: PaceBucket[];
    commitsLast15: number;
    stalled: boolean;
  };
  feed: LiveFeedItem[];
}

export interface SuggestedSessionResult {
  session: Session;
  activeStudentsCount: number;
  commitsCount: number;
  totalGroupStudents: number;
  suggestedLabel: string;
}

@Injectable({
  providedIn: "root",
})
export class SessionAnalyticsService {
  readonly BASE_GRACE_MINUTES = 3;
  readonly MAX_GRACE_MINUTES = 30;
  readonly MAX_CONSECUTIVE_GAP_MINUTES = 4;

  /** No commit for longer than this flags a student "to nudge" and a class "stalled". */
  readonly LIVE_STALE_MINUTES = 15;
  readonly LIVE_WATCHLIST_LIMIT = 4;
  readonly LIVE_FEED_LIMIT = 4;

  constructor(private anonymizationService?: AnonymizationService) {}

  getStudentDisplayName(repo: Repository): string {
    const rawName = this.anonymizationService
      ? this.anonymizationService.getDisplayName(repo)
      : repo.getDisplayName() || repo.name || "Étudiant";
    return Utils.truncateMiddle(rawName, Utils.OVERVIEW_NAME_LENGTH_LIMIT);
  }

  /**
   * Computes the dynamic adaptive grace period for a session.
   */
  computeDynamicGracePeriod(session: Session, commits: Commit[], repositories: Repository[]): GracePeriodResult {
    if (!session || !session.endDate) {
      return {
        effectiveEndDate: session?.endDate || new Date(),
        graceMinutes: 0,
        extendedStudentsCount: 0,
        isExtended: false,
      };
    }

    const sessionStartTime = new Date(session.startDate).getTime();
    const sessionEndTime = new Date(session.endDate).getTime();
    const baseGraceEndTime = sessionEndTime + this.BASE_GRACE_MINUTES * 60 * 1000;
    const maxGraceEndTime = sessionEndTime + this.MAX_GRACE_MINUTES * 60 * 1000;

    // Filter candidate commits matching group if specified
    const repoGroupMap = new Map<string, string>();
    repositories?.forEach((r) => {
      const group = r.tpGroup || "";
      r.commits?.forEach((c) => repoGroupMap.set(c.url, group));
    });

    const candidateCommits = (commits || [])
      .filter((c) => {
        if (!c || !c.commitDate) return false;
        const cTime = new Date(c.commitDate).getTime();
        if (cTime < sessionEndTime || cTime > maxGraceEndTime) return false;
        if (session.tpGroup) {
          const rGroup = repoGroupMap.get(c.url);
          if (rGroup && rGroup !== session.tpGroup) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.commitDate).getTime() - new Date(b.commitDate).getTime());

    let currentCutoffTime = baseGraceEndTime;
    let lastAcceptedTime = sessionEndTime;
    const extendedStudents = new Set<string>();

    for (const commit of candidateCommits) {
      const commitTime = new Date(commit.commitDate).getTime();

      // If commit is within the base grace, accept unconditionally
      if (commitTime <= baseGraceEndTime) {
        lastAcceptedTime = Math.max(lastAcceptedTime, commitTime);
        extendedStudents.add(commit.author || "Unknown");
        continue;
      }

      // If beyond base grace, check continuous chain gap (<= 4 min)
      const gapMinutes = (commitTime - lastAcceptedTime) / (60 * 1000);
      if (gapMinutes <= this.MAX_CONSECUTIVE_GAP_MINUTES && commitTime <= maxGraceEndTime) {
        lastAcceptedTime = commitTime;
        currentCutoffTime = Math.max(currentCutoffTime, commitTime);
        extendedStudents.add(commit.author || "Unknown");
      } else {
        // Continuous wave broken
        break;
      }
    }

    const effectiveEndDate = new Date(Math.max(sessionEndTime, currentCutoffTime));
    const graceMinutes = Math.round((effectiveEndDate.getTime() - sessionEndTime) / (60 * 1000));
    const isExtended = graceMinutes > this.BASE_GRACE_MINUTES;

    return {
      effectiveEndDate,
      graceMinutes,
      extendedStudentsCount: extendedStudents.size,
      isExtended,
    };
  }

  /**
   * Checks if a commit belongs to a session
   */
  isCommitInSession(commit: Commit, session: Session, graceMinutes = 0, repoGroup?: string): boolean {
    if (!commit || !commit.commitDate || !session || !session.startDate || !session.endDate) {
      return false;
    }

    if (session.tpGroup && repoGroup && session.tpGroup !== repoGroup) {
      return false;
    }

    const cTime = new Date(commit.commitDate).getTime();
    const sStart = new Date(session.startDate).getTime();
    const sEnd = new Date(session.endDate).getTime() + graceMinutes * 60 * 1000;

    return cTime >= sStart && cTime <= sEnd;
  }

  /**
   * Computes comprehensive analytical stats for a single session
   */
  computeSessionStats(session: Session, repositories: Repository[], questions: string[] = []): SessionDetailedStats {
    // 1. Filter matching repositories
    const relevantRepos = (repositories || []).filter((r) => {
      if (!session.tpGroup) return true;
      return r.tpGroup === session.tpGroup;
    });

    // Extract all commits in relevant repos
    const allCandidateCommits: Commit[] = [];
    relevantRepos.forEach((r) => {
      if (r.commits) allCandidateCommits.push(...r.commits);
    });

    // 2. Compute dynamic grace period
    const graceResult = this.computeDynamicGracePeriod(session, allCandidateCommits, relevantRepos);
    const sessionStart = new Date(session.startDate);
    const effectiveEnd = graceResult.effectiveEndDate;

    const sessionStartMs = sessionStart.getTime();
    const sessionEndMs = effectiveEnd.getTime();
    const durationMs = Math.max(1, sessionEndMs - sessionStartMs);

    // 3. Process each student repository
    const studentsActivity: StudentSessionActivity[] = [];
    let activeStudentsCount = 0;
    let inSessionCommitsCount = 0;
    const questionsClosedSet = new Map<string, number>();
    questions.forEach((q) => questionsClosedSet.set(q, 0));

    const ribbonPoints: SessionProgressRibbonData["studentCommitsPoints"] = [];

    relevantRepos.forEach((repo) => {
      const repoCommits = (repo.commits || [])
        .filter((c) => {
          const t = new Date(c.commitDate).getTime();
          return t >= sessionStartMs && t <= sessionEndMs;
        })
        .sort((a, b) => new Date(a.commitDate).getTime() - new Date(b.commitDate).getTime());

      const inCount = repoCommits.length;
      inSessionCommitsCount += inCount;

      let firstDate: Date | undefined;
      let lastDate: Date | undefined;
      let lastQuestion: string | undefined;
      const closedQuestionsForStudent = new Set<string>();

      repoCommits.forEach((c, idx) => {
        const cDate = new Date(c.commitDate);
        if (!firstDate) firstDate = cDate;
        lastDate = cDate;

        if (c.question) {
          lastQuestion = c.question;
        }

        if (c.isCloture && c.question) {
          closedQuestionsForStudent.add(c.question);
          questionsClosedSet.set(c.question, (questionsClosedSet.get(c.question) || 0) + 1);
        }

        const qIdx = c.question ? questions.indexOf(c.question) + 1 : 0;
        const relMinutes = Math.round((cDate.getTime() - sessionStartMs) / 60000);
        const repoId = repo.url || repo.name || repo.getDisplayName() || "repo";
        const studentDisplayName = this.getStudentDisplayName(repo);

        ribbonPoints.push({
          repoId,
          student: studentDisplayName,
          time: cDate,
          relativeMinutes: relMinutes,
          questionIndex: qIdx,
          questionName: c.question || "",
          cumulativeCommits: idx + 1,
          isCloture: Boolean(c.isCloture),
          commit: c,
        });
      });

      // Status classification
      let status: "active" | "low" | "inactive" = "inactive";
      if (inCount >= 2) {
        status = "active";
      } else if (inCount === 1) {
        status = "low";
      }

      if (inCount > 0) {
        activeStudentsCount++;
      }

      studentsActivity.push({
        repository: repo,
        studentName: this.getStudentDisplayName(repo),
        tpGroup: repo.tpGroup,
        inSessionCommitsCount: inCount,
        totalCommitsCount: repo.commits?.length || 0,
        firstCommitDate: firstDate,
        lastCommitDate: lastDate,
        lastQuestionDone: lastQuestion,
        status,
        questionsCompletedInSession: Array.from(closedQuestionsForStudent),
      });
    });

    const totalEligibleStudents = relevantRepos.length;
    const inactiveStudentsCount = totalEligibleStudents - activeStudentsCount;
    const studentsWithoutResolvedQuestionsCount = studentsActivity.filter(
      (student) => student.questionsCompletedInSession.length === 0,
    ).length;
    const participationRate = totalEligibleStudents > 0 ? (activeStudentsCount / totalEligibleStudents) * 100 : 0;

    // 4. Histogram Buckets (15 min)
    const BUCKET_MINUTES = 15;
    const bucketDurationMs = BUCKET_MINUTES * 60 * 1000;
    const numBuckets = Math.max(1, Math.ceil(durationMs / bucketDurationMs));
    const histogramBuckets: SessionHistogramBucket[] = [];

    for (let b = 0; b < numBuckets; b++) {
      const bStart = new Date(sessionStartMs + b * bucketDurationMs);
      const bEnd = new Date(Math.min(sessionEndMs, bStart.getTime() + bucketDurationMs));
      const bLabel = moment(bStart).format("HH:mm");

      const bucketCommits = ribbonPoints.filter((p) => {
        const t = p.time.getTime();
        return t >= bStart.getTime() && t < bEnd.getTime();
      });

      const countsByColor: { [colorKey: string]: number } = {};
      let closingCount = 0;

      bucketCommits.forEach((p) => {
        const col = p.commit.color?.name || "slate";
        countsByColor[col] = (countsByColor[col] || 0) + 1;
        if (p.isCloture) closingCount++;
      });

      histogramBuckets.push({
        startDate: bStart,
        endDate: bEnd,
        label: bLabel,
        total: bucketCommits.length,
        countsByColor,
        closingCommitsCount: closingCount,
      });
    }

    // 5. Cohort Progress Ribbon Data (Sampling every 5 minutes)
    const SAMPLE_MINUTES = 5;
    const sampleMs = SAMPLE_MINUTES * 60 * 1000;
    const numSamples = Math.max(2, Math.ceil(durationMs / sampleMs) + 1);

    const questionsRibbon: RibbonDataPoint[] = [];
    const commitsRibbon: RibbonDataPoint[] = [];
    const timePoints: Date[] = [];

    // Cohort evaluated: active students in session, or all relevant repos if none
    const activeRepos = relevantRepos.filter((r) =>
      studentsActivity.some((sa) => sa.repository === r && (sa.status === "active" || sa.status === "low")),
    );
    const cohortToSample = activeRepos.length > 0 ? activeRepos : relevantRepos;

    for (let s = 0; s < numSamples; s++) {
      const sampleTimeMs = Math.min(sessionEndMs, sessionStartMs + s * sampleMs);
      const sampleTime = new Date(sampleTimeMs);
      const relMin = Math.round((sampleTimeMs - sessionStartMs) / 60000);
      timePoints.push(sampleTime);

      // Compute stats for questions and commits for cohort up to sampleTime
      const studentQIndices: number[] = [];
      const studentCommitCounts: number[] = [];

      cohortToSample.forEach((repo) => {
        let maxQ = 0;
        let cCount = 0;
        repo.commits?.forEach((c) => {
          const ct = new Date(c.commitDate).getTime();
          if (ct >= sessionStartMs && ct <= sampleTimeMs) {
            cCount++;
          }
          if (ct <= sampleTimeMs && c.question) {
            const qIdx = questions.indexOf(c.question) + 1;
            if (qIdx > maxQ) maxQ = qIdx;
          }
        });
        studentQIndices.push(maxQ);
        studentCommitCounts.push(cCount);
      });

      questionsRibbon.push(this.calculateRibbonPoint(sampleTime, relMin, studentQIndices));
      commitsRibbon.push(this.calculateRibbonPoint(sampleTime, relMin, studentCommitCounts));
    }

    const ribbonData: SessionProgressRibbonData = {
      timePoints,
      questionsRibbon,
      commitsRibbon,
      studentCommitsPoints: ribbonPoints,
    };

    // 6. Question summary
    const questionsSummary = questions.map((q) => {
      const closed = questionsClosedSet.get(q) || 0;
      return {
        question: q,
        closedByCount: closed,
        percentage: totalEligibleStudents > 0 ? (closed / totalEligibleStudents) * 100 : 0,
      };
    });

    const displayName = session.label || `Séance ${session.tpGroup ? `(${session.tpGroup})` : ""}`;

    return {
      session,
      displayName,
      tpGroup: session.tpGroup,
      gracePeriod: graceResult,
      totalEligibleStudents,
      activeStudentsCount,
      inactiveStudentsCount,
      studentsWithoutResolvedQuestionsCount,
      participationRate,
      inSessionCommitsCount,
      totalPeriodCommitsCount: allCandidateCommits.length,
      inSessionRatio: allCandidateCommits.length > 0 ? (inSessionCommitsCount / allCandidateCommits.length) * 100 : 100,
      resolvedQuestionsCount: questionsSummary.filter((q) => q.closedByCount > 0).length,
      questionsSummary,
      histogramBuckets,
      ribbonData,
      studentsActivity,
    };
  }

  /**
   * Derives the actionable "live cockpit" indicators from the already-computed detailed stats.
   * Pure and cheap (no extra data pass): the teacher gets who needs help, the class pace and the
   * latest activity. `nowMs` comes from ClockService so the dev-bar clock shift is honoured.
   */
  buildLiveIndicators(stats: SessionDetailedStats, nowMs: number): SessionLiveIndicators {
    const staleMs = this.LIVE_STALE_MINUTES * 60 * 1000;
    const students = stats.studentsActivity || [];
    const startMs = new Date(stats.session.startDate).getTime();

    let activeCount = 0;
    let watchCount = 0;
    let inactiveCount = 0;
    const activeStudents: string[] = [];
    const watchStudents: string[] = [];
    const inactiveStudents: string[] = [];
    const watchCandidates: StudentWatchItem[] = [];

    /* Only the commits that already happened (relative to the simulated clock) count: a session's
       window extends into the future, so a commit made "later" must not mark its student active. */
    students.forEach((student) => {
      const pastCommits = (student.repository?.commits || []).filter((commit) => {
        const t = new Date(commit.commitDate).getTime();
        return t >= startMs && t <= nowMs;
      });
      const pastCount = pastCommits.length;
      const lastPastMs = pastCount
        ? pastCommits.reduce((max, commit) => Math.max(max, new Date(commit.commitDate).getTime()), 0)
        : undefined;

      if (pastCount === 0) {
        inactiveCount++;
        inactiveStudents.push(student.studentName);
        watchCandidates.push({
          repository: student.repository,
          studentName: student.studentName,
          risk: "inactive",
          reasonKey: "SESSION-TAB.PANEL.WATCH.REASON-NO-COMMIT",
          inSessionCommitsCount: 0,
        });
        return;
      }
      if (lastPastMs !== undefined && nowMs - lastPastMs > staleMs) {
        watchCount++;
        watchStudents.push(student.studentName);
        watchCandidates.push({
          repository: student.repository,
          studentName: student.studentName,
          risk: "watch",
          reasonKey: "SESSION-TAB.PANEL.WATCH.REASON-STALE",
          reasonMinutes: Math.round((nowMs - lastPastMs) / 60000),
          inSessionCommitsCount: pastCount,
        });
        return;
      }
      activeCount++;
      activeStudents.push(student.studentName);
    });

    /* Inactives first, then the longest-idle students. */
    watchCandidates.sort((a, b) => {
      if (a.risk !== b.risk) {
        return a.risk === "inactive" ? -1 : 1;
      }
      return (b.reasonMinutes || 0) - (a.reasonMinutes || 0);
    });

    const points = (stats.ribbonData?.studentCommitsPoints || []).filter((p) => p.time.getTime() <= nowMs);

    /* Only the elapsed buckets are shown; the current one is highlighted. Counts are recomputed
       from the past-only points (the precomputed buckets include the future). Cap to 16 tranches. */
    const elapsedBuckets = (stats.histogramBuckets || []).filter((b) => new Date(b.startDate).getTime() <= nowMs).slice(-16);
    const bucketTotals = elapsedBuckets.map((b) => {
      const bStart = new Date(b.startDate).getTime();
      const bEnd = new Date(b.endDate).getTime();
      return {
        label: b.label,
        total: points.filter((p) => p.time.getTime() >= bStart && p.time.getTime() < bEnd).length,
        isCurrent: nowMs >= bStart && nowMs < bEnd,
      };
    });
    const maxTotal = bucketTotals.reduce((max, b) => Math.max(max, b.total), 1);
    const buckets: PaceBucket[] = bucketTotals.map((b) => ({ ...b, height: Math.round((b.total / maxTotal) * 100) }));

    const commitsLast15 = points.filter((p) => nowMs - p.time.getTime() <= staleMs).length;
    const lastActivityMs = points.reduce((max, p) => Math.max(max, p.time.getTime()), startMs);
    const stalled = nowMs - lastActivityMs > staleMs;

    const feed: LiveFeedItem[] = [...points]
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, this.LIVE_FEED_LIMIT)
      .map((p) => {
        const minutesAgo = Math.max(0, Math.round((nowMs - p.time.getTime()) / 60000));
        return {
          studentName: p.student,
          questionName: p.questionName,
          isCloture: p.isCloture,
          minutesAgo,
          justNow: minutesAgo < 1,
          commitUrl: p.commit?.url || "",
        };
      });

    const totalQuestions = (stats.questionsSummary || []).length;

    /* Resolved questions must honour the simulated clock: only closing commits up to `now` count. */
    const resolvedSet = new Set<string>();
    points.forEach((p) => {
      if (p.isCloture && p.questionName) {
        resolvedSet.add(p.questionName);
      }
    });
    const resolvedQuestionsList = (stats.questionsSummary || []).filter((q) => resolvedSet.has(q.question)).map((q) => q.question);
    const resolvedQuestions = resolvedQuestionsList.length;

    /* Live scatter of question completions: one dot per closing commit (x = elapsed share,
       y = question rank, higher rank up). The group's AVERAGE progress curve adds context. */
    const elapsed = Math.max(1, nowMs - startMs);
    const totalQ = Math.max(1, totalQuestions);
    const clampPct = (v: number) => Math.min(100, Math.max(0, v));
    const dots = points
      .filter((p) => p.isCloture && p.questionName && p.questionIndex > 0)
      .map((p) => ({
        x: clampPct(((p.time.getTime() - startMs) / elapsed) * 100),
        y: clampPct(100 - (p.questionIndex / totalQ) * 100),
        question: p.questionName,
        student: p.student,
        minutesAgo: Math.max(0, Math.round((nowMs - p.time.getTime()) / 60000)),
      }));
    const elapsedMinutes = Math.max(1, Math.round(elapsed / 60000));
    const average: Array<{ x: number; y: number }> = (stats.ribbonData?.questionsRibbon || [])
      .filter((r) => r.time.getTime() <= nowMs)
      .map((r) => ({
        x: clampPct((r.relativeMinutes / elapsedMinutes) * 100),
        y: clampPct(100 - (r.mean / totalQ) * 100),
      }));

    /* Per-student cumulative progress trajectory (hover in the panel, like the sessions ribbon). */
    const byStudent = new Map<string, typeof points>();
    points.forEach((p) => {
      const arr = byStudent.get(p.student) || [];
      arr.push(p);
      byStudent.set(p.student, arr);
    });
    const trajectories: Record<string, Array<{ x: number; y: number }>> = {};
    byStudent.forEach((arr, student) => {
      arr.sort((a, b) => a.time.getTime() - b.time.getTime());
      let maxQ = 0;
      const pts: Array<{ x: number; y: number }> = [{ x: 0, y: 100 }];
      arr.forEach((p) => {
        maxQ = Math.max(maxQ, p.questionIndex);
        pts.push({
          x: clampPct(((p.time.getTime() - startMs) / elapsed) * 100),
          y: clampPct(100 - (maxQ / totalQ) * 100),
        });
      });
      trajectories[student] = pts;
    });

    return {
      activeCount,
      watchCount,
      inactiveCount,
      totalStudents: stats.totalEligibleStudents,
      resolvedQuestions,
      totalQuestions,
      questionsPct: totalQuestions > 0 ? Math.round((resolvedQuestions / totalQuestions) * 100) : 0,
      activeStudents,
      watchStudents,
      inactiveStudents,
      resolvedQuestionsList,
      resolvedChart: { dots, average, trajectories },
      watchlist: watchCandidates.slice(0, this.LIVE_WATCHLIST_LIMIT),
      pace: { buckets, commitsLast15, stalled },
      feed,
    };
  }

  /**
   * Detects suggested sessions from commit clusters across all repositories
   */
  detectSuggestedSessions(
    repositories: Repository[],
    defaultDurationMinutes = 120,
    existingSessions: Session[] = [],
  ): SuggestedSessionResult[] {
    if (!repositories || repositories.length === 0) return [];

    // Group repos by tpGroup
    const groupsMap = new Map<string, Repository[]>();
    repositories.forEach((repo) => {
      const grp = repo.tpGroup || "";
      const existing = groupsMap.get(grp);
      if (existing) {
        existing.push(repo);
      } else {
        groupsMap.set(grp, [repo]);
      }
    });

    const suggestions: SuggestedSessionResult[] = [];

    groupsMap.forEach((reposInGroup, groupName) => {
      const allCommits: Array<{ commit: Commit; author: string }> = [];
      reposInGroup.forEach((r) => {
        r.commits?.forEach((c) => {
          allCommits.push({ commit: c, author: r.name || c.author });
        });
      });

      if (allCommits.length < 3) return;

      allCommits.sort((a, b) => new Date(a.commit.commitDate).getTime() - new Date(b.commit.commitDate).getTime());

      // Count existing sessions for this group
      const existingForGroup = (existingSessions || []).filter((s) => (s.tpGroup || "") === (groupName || "")).length;
      let groupSessionCounter = existingForGroup;

      // 15-minute slot aggregation
      const slotMap = new Map<number, Set<string>>();
      const slotCommitCount = new Map<number, number>();

      allCommits.forEach(({ commit, author }) => {
        const t = new Date(commit.commitDate).getTime();
        // Round to nearest 15 min
        const slotKey = Math.floor(t / (15 * 60 * 1000)) * (15 * 60 * 1000);
        if (!slotMap.has(slotKey)) {
          slotMap.set(slotKey, new Set());
          slotCommitCount.set(slotKey, 0);
        }
        const studentsSet = slotMap.get(slotKey);
        if (studentsSet) {
          studentsSet.add(author);
        }
        const currentCount = slotCommitCount.get(slotKey) || 0;
        slotCommitCount.set(slotKey, currentCount + 1);
      });

      // Identify slots where at least 2 distinct students (or 20% of group) were active
      const minActive = Math.max(2, Math.floor(reposInGroup.length * 0.2));
      const activeSlots = Array.from(slotMap.keys())
        .filter((slotKey) => (slotMap.get(slotKey)?.size || 0) >= minActive)
        .sort((a, b) => a - b);

      if (activeSlots.length === 0) return;

      // Cluster adjacent active slots (separated by no more than 45 min)
      const clusters: number[][] = [];
      let currentCluster: number[] = [activeSlots[0]];

      for (let i = 1; i < activeSlots.length; i++) {
        const prev = activeSlots[i - 1];
        const curr = activeSlots[i];
        if (curr - prev <= 45 * 60 * 1000) {
          currentCluster.push(curr);
        } else {
          clusters.push(currentCluster);
          currentCluster = [curr];
        }
      }
      if (currentCluster.length > 0) clusters.push(currentCluster);

      // Build session from each cluster
      clusters.forEach((cluster) => {
        const clusterStart = cluster[0];
        const clusterEnd = cluster[cluster.length - 1] + 15 * 60 * 1000;
        const clusterDurationMin = (clusterEnd - clusterStart) / 60000;

        // Use default duration if cluster is around that size, or adapt if clearly longer
        const durationToUseMin =
          clusterDurationMin > defaultDurationMinutes + 30 ? Math.round(clusterDurationMin / 30) * 30 : defaultDurationMinutes;

        const startDate = new Date(clusterStart);
        const endDate = new Date(clusterStart + durationToUseMin * 60 * 1000);

        // Check if overlaps with an existing session in the same group
        const overlapsExisting = (existingSessions || []).some((es) => {
          if ((es.tpGroup || "") !== (groupName || "")) return false;
          const esStart = new Date(es.startDate).getTime();
          const esEnd = new Date(es.endDate).getTime();
          return Math.max(startDate.getTime(), esStart) < Math.min(endDate.getTime(), esEnd);
        });
        if (overlapsExisting) return;

        // Count distinct students and commits in this detected window
        const windowCommits = allCommits.filter(({ commit }) => {
          const ct = new Date(commit.commitDate).getTime();
          return ct >= startDate.getTime() && ct <= endDate.getTime();
        });

        const distinctStudents = new Set(windowCommits.map((w) => w.author));

        if (distinctStudents.size >= minActive && windowCommits.length >= 4) {
          groupSessionCounter++;
          const suggestedLabel = `Séance ${groupSessionCounter}`;

          // Note: session.label is intentionally undefined so the application's default dynamic label mechanism works
          const session = new Session(startDate, endDate, groupName || undefined, undefined, undefined);

          suggestions.push({
            session,
            activeStudentsCount: distinctStudents.size,
            commitsCount: windowCommits.length,
            totalGroupStudents: reposInGroup.length,
            suggestedLabel,
          });
        }
      });
    });

    return suggestions.sort((a, b) => a.session.startDate.getTime() - b.session.startDate.getTime());
  }

  /**
   * Helper to calculate statistical quartiles (Q1, Median, Q3) for an array of numbers
   */
  private calculateRibbonPoint(time: Date, relativeMinutes: number, values: number[]): RibbonDataPoint {
    if (!values || values.length === 0) {
      return { time, relativeMinutes, mean: 0, median: 0, q1: 0, q3: 0, min: 0, max: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const median = this.percentile(sorted, 0.5);
    const q1 = this.percentile(sorted, 0.25);
    const q3 = this.percentile(sorted, 0.75);

    return {
      time,
      relativeMinutes,
      mean,
      median,
      q1,
      q3,
      min,
      max,
    };
  }

  private percentile(sorted: number[], p: number): number {
    const pos = (sorted.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  }
}
