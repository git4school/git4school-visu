import { Assignment } from "@models/Assignment.model";
import { GitProviderType } from "@models/Account.model";
import { Milestone } from "@models/Milestone.model";
import { Repository } from "@models/Repository.model";
import { Session } from "@models/Session.model";
import * as moment from "moment";

/**
 * DEV-ONLY fixture dataset shared by the mocked Git providers (GitHub & GitLab).
 *
 * Everything is generated relatively to a single "epoch" persisted at seed time
 * so that the assignment dates, the sessions and the commit timestamps stay
 * consistent between requests and page reloads.
 */

export const FIXTURE_EPOCH_KEY = "g4s_dev_fixture_epoch";
export const MOCK_GITHUB_ACTIVE_KEY = "g4s_dev_mock_github_active";
export const HOUR_MS = 60 * 60 * 1000;

export const MOCK_GITHUB_OWNER = "git4school-demo";
export const MOCK_GITHUB_TOKEN = "gho_mock_git4school_demo_token";
export const MOCK_GITHUB_LOGIN = "prof.octocat";
export const MOCK_GITHUB_NAME = "Prof. Octocat";

export const MOCK_QUESTIONS = ["Q1", "Q2", "Q3", "Q4"];

export interface MockCommitTemplate {
  hoursAgo: number;
  message: string;
}

export interface MockStudent {
  login: string;
  firstName: string;
  lastName: string;
  tpGroup: string;
  repoSlug: string;
  description: string;
  /** 0 = the most advanced student, 5 = the least advanced. Controls how many commits exist. */
  level: number;
}

export interface MockSession {
  startHoursAgo: number;
  endHoursAgo: number;
  label: string;
}

/**
 * Commit templates, ordered from the oldest to the newest (hoursAgo descending).
 * Messages intentionally close the questions Q1..Q4 using the standard GitHub
 * keywords so the color/question logic is exercised.
 */
export const MOCK_COMMIT_TEMPLATES: MockCommitTemplate[] = [
  { hoursAgo: 500, message: "Initial project structure" },
  { hoursAgo: 470, message: "Add README and identity file" },
  { hoursAgo: 430, message: "Fix Q1: implement the core algorithm" },
  { hoursAgo: 385, message: "Refactor: extract helper functions" },
  { hoursAgo: 335, message: "Fix Q2: handle boundary cases" },
  { hoursAgo: 310, message: "Docs: describe the chosen approach" },
  { hoursAgo: 260, message: "Fix Q1: improve performance" },
  { hoursAgo: 200, message: "Chore: update dependencies" },
  { hoursAgo: 167, message: "Fix Q3: add integration tests" },
  { hoursAgo: 110, message: "Fix Q4: write the report" },
  { hoursAgo: 23, message: "Final cleanup" },
];

export const MOCK_SESSIONS: MockSession[] = [
  { startHoursAgo: 505, endHoursAgo: 495, label: "Séance 1" },
  { startHoursAgo: 440, endHoursAgo: 425, label: "Séance 2" },
  { startHoursAgo: 340, endHoursAgo: 330, label: "Séance 3" },
  { startHoursAgo: 175, endHoursAgo: 160, label: "Séance 4" },
  { startHoursAgo: 30, endHoursAgo: 15, label: "Séance 5" },
];

export const MOCK_STUDENTS: MockStudent[] = [
  {
    login: "alan.turing",
    firstName: "Alan",
    lastName: "TURING",
    tpGroup: "1A",
    repoSlug: "ue-algo-tp1-alan-turing",
    description: "TP1 — Algorithmique (Alan Turing)",
    level: 0,
  },
  {
    login: "grace.hopper",
    firstName: "Grace",
    lastName: "HOPPER",
    tpGroup: "1A",
    repoSlug: "ue-algo-tp1-grace-hopper",
    description: "TP1 — Algorithmique (Grace Hopper)",
    level: 1,
  },
  {
    login: "ada.lovelace",
    firstName: "Ada",
    lastName: "LOVELACE",
    tpGroup: "1A",
    repoSlug: "ue-algo-tp1-ada-lovelace",
    description: "TP1 — Algorithmique (Ada Lovelace)",
    level: 2,
  },
  {
    login: "linus.torvalds",
    firstName: "Linus",
    lastName: "TORVALDS",
    tpGroup: "1B",
    repoSlug: "ue-algo-tp1-linus-torvalds",
    description: "TP1 — Algorithmique (Linus Torvalds)",
    level: 3,
  },
  {
    login: "margaret.hamilton",
    firstName: "Margaret",
    lastName: "HAMILTON",
    tpGroup: "1B",
    repoSlug: "ue-algo-tp1-margaret-hamilton",
    description: "TP1 — Algorithmique (Margaret Hamilton)",
    level: 4,
  },
  {
    login: "katherine.johnson",
    firstName: "Katherine",
    lastName: "JOHNSON",
    tpGroup: "1B",
    repoSlug: "ue-algo-tp1-katherine-johnson",
    description: "TP1 — Algorithmique (Katherine Johnson)",
    level: 5,
  },
];

export interface MockCommit {
  message: string;
  authorName: string;
  date: Date;
  url: string;
  shortId: string;
}

export interface MockProfile {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
}

export function getFixtureEpoch(): number {
  try {
    const raw = localStorage.getItem(FIXTURE_EPOCH_KEY);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  } catch {
    /* Storage unavailable */
  }
  return Date.now();
}

export function setFixtureEpoch(epoch: number): void {
  try {
    localStorage.setItem(FIXTURE_EPOCH_KEY, String(epoch));
  } catch {
    /* Storage unavailable */
  }
}

export function getMockProfile(provider: GitProviderType): MockProfile {
  if (provider === "gitlab") {
    return {
      id: 9999,
      login: "prof.turing",
      name: "Alan Turing",
      avatarUrl: "https://avatars.githubusercontent.com/u/1083893?v=4",
    };
  }
  return {
    id: 12345,
    login: MOCK_GITHUB_LOGIN,
    name: MOCK_GITHUB_NAME,
    avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
  };
}

export function getStudentBySlug(slug: string): MockStudent | undefined {
  if (!slug) {
    return undefined;
  }
  const normalized = decodeURIComponent(slug).toLowerCase();
  return MOCK_STUDENTS.find((s) => s.repoSlug.toLowerCase() === normalized || normalized.endsWith(`/${s.repoSlug.toLowerCase()}`));
}

export function getCommitCountForStudent(student: MockStudent): number {
  return Math.max(1, MOCK_COMMIT_TEMPLATES.length - student.level);
}

export function getCommitTemplatesForStudent(student: MockStudent): MockCommitTemplate[] {
  return MOCK_COMMIT_TEMPLATES.slice(0, getCommitCountForStudent(student));
}

export function getRepoUrl(provider: GitProviderType, student: MockStudent, instanceHost?: string): string {
  if (provider === "gitlab") {
    const host = instanceHost || "gitlab.univ-tlse3.fr";
    return `https://${host}/prof.turing/${student.repoSlug}`;
  }
  return `https://github.com/${MOCK_GITHUB_OWNER}/${student.repoSlug}`;
}

export function getCommitsForStudent(
  student: MockStudent,
  provider: GitProviderType,
  instanceHost?: string,
  since?: Date,
  until?: Date,
): MockCommit[] {
  const epoch = getFixtureEpoch();
  const authorName = `${student.firstName} ${student.lastName}`;
  const templates = getCommitTemplatesForStudent(student);
  const baseUrl = getRepoUrl(provider, student, instanceHost);

  return templates
    .map((template, index) => {
      const date = new Date(epoch - template.hoursAgo * HOUR_MS);
      const shortId = `${student.login.replace(/[^a-z]/g, "").slice(0, 4)}${String(index).padStart(3, "0")}${(
        index * 7 +
        student.level
      ).toString(16)}`;
      const url = provider === "gitlab" ? `${baseUrl}/-/commit/${shortId.padEnd(12, "0")}` : `${baseUrl}/commit/${shortId.padEnd(12, "0")}`;
      return {
        message: template.message,
        authorName,
        date,
        url,
        shortId: shortId.padEnd(12, "0"),
      };
    })
    .filter((commit) => {
      if (since && commit.date.getTime() < since.getTime()) {
        return false;
      }
      if (until && commit.date.getTime() > until.getTime()) {
        return false;
      }
      return true;
    });
}

export function getReadmeForStudent(student: MockStudent): string {
  return [
    `# ${student.repoSlug}`,
    "",
    `Nom: ${student.lastName}`,
    `Prénom: ${student.firstName}`,
    `Groupe: ${student.tpGroup}`,
    "",
    "Travaux pratiques d'algorithmique et structures de données.",
  ].join("\n");
}

export function getIdentityForStudent(student: MockStudent): string {
  return JSON.stringify({
    last_name: student.lastName,
    first_name: student.firstName,
    group: student.tpGroup,
  });
}

/**
 * Builds a GitHub GraphQL repository node matching the fields requested by
 * GithubDataService.search queries.
 */
export function buildGithubRepoNode(student: MockStudent): any {
  return {
    name: student.repoSlug,
    url: getRepoUrl("github", student),
    description: student.description,
    isFork: false,
    parent: null,
    forks: { nodes: [] },
  };
}

/**
 * Builds a GitLab REST project payload matching the fields requested by
 * GitlabDataService.
 */
export function buildGitlabProject(student: MockStudent, instanceHost?: string): any {
  const host = instanceHost || "gitlab.univ-tlse3.fr";
  return {
    id: 1000 + MOCK_STUDENTS.indexOf(student),
    name: student.repoSlug,
    path: student.repoSlug,
    path_with_namespace: `prof.turing/${student.repoSlug}`,
    default_branch: "main",
    web_url: `https://${host}/prof.turing/${student.repoSlug}`,
    description: student.description,
    avatar_url: null,
    namespace: {
      name: "prof.turing",
      path: "prof.turing",
      avatar_url: null,
    },
  };
}

function hoursAgoToDate(epoch: number, hoursAgo: number): Date {
  return new Date(epoch - hoursAgo * HOUR_MS);
}

/**
 * Builds a fully-populated demo Assignment (metadata, questions, sessions,
 * milestones and repositories) for the given provider, relative to `epoch`.
 */
export function buildDemoAssignment(provider: GitProviderType, epoch: number): Assignment {
  const assignment = new Assignment();
  assignment.provider = provider;
  assignment.uiStatus = "ongoing";
  assignment.title = provider === "gitlab" ? "Démo — UE Algo TP1 (GitLab)" : "Démo — UE Algo TP1 (GitHub)";
  assignment.course = "Algorithmique";
  assignment.program = "Licence Informatique";
  assignment.year = "2025-2026";
  assignment.startDate = moment(hoursAgoToDate(epoch, 520)).format("YYYY-MM-DD HH:mm");
  assignment.endDate = moment(hoursAgoToDate(epoch, 0)).format("YYYY-MM-DD HH:mm");
  assignment.questions = [...MOCK_QUESTIONS];
  assignment.closingMode = "standard";

  assignment.sessions = MOCK_SESSIONS.map(
    (session) =>
      new Session(
        hoursAgoToDate(epoch, session.startHoursAgo),
        hoursAgoToDate(epoch, session.endHoursAgo),
        undefined,
        undefined,
        session.label,
      ),
  );

  assignment.reviews = [
    new Milestone(hoursAgoToDate(epoch, 380), "Revue 1", ["Q1", "Q2"], undefined, "review"),
    new Milestone(hoursAgoToDate(epoch, 190), "Revue 2", ["Q3", "Q4"], undefined, "review"),
  ];
  assignment.corrections = [
    new Milestone(hoursAgoToDate(epoch, 300), "Correction 1", ["Q1", "Q2"], undefined, "correction"),
    new Milestone(hoursAgoToDate(epoch, 120), "Correction 2", ["Q3", "Q4"], undefined, "correction"),
  ];
  assignment.others = [new Milestone(hoursAgoToDate(epoch, 5), "Soutenance", undefined, undefined, "other")];

  const instanceHost = provider === "gitlab" ? "gitlab.univ-tlse3.fr" : "github.com";
  assignment.instanceHost = instanceHost;
  assignment.instanceName = provider === "gitlab" ? "UT3" : "GitHub";
  assignment.repositories = MOCK_STUDENTS.map(
    (student) =>
      new Repository(
        getRepoUrl(provider, student, instanceHost),
        undefined,
        undefined,
        student.tpGroup,
        undefined,
        student.description,
        false,
        undefined,
        false,
        provider,
      ),
  );

  return assignment;
}
