import { Injectable } from "@angular/core";
import { GitProviderType } from "@models/Account.model";
import { Assignment } from "@models/Assignment.model";
import { DatabaseService } from "@services/database.service";
import { DataService } from "@services/data.service";
import { MockGithubInstanceService } from "./mock-github-instance.service";
import { MockGitlabInstanceService } from "./mock-gitlab-instance.service";
import { buildDemoAssignment, setFixtureEpoch } from "./mock-fixtures";

const FIXTURE_ACTIVE_KEY = "g4s_dev_fixture_active";
const FIXTURE_PROVIDER_KEY = "g4s_dev_fixture_provider";
const FIXTURE_ASSIGNMENT_ID_KEY = "g4s_dev_fixture_assignment_id";

/**
 * DEV-ONLY service building a complete demo assignment (metadata, sessions,
 * milestones and repositories) stored in IndexedDB and paired with a mocked Git
 * account. It lets the app be exercised offline, logged-in and with real-looking
 * data through the full loading pipeline.
 */
@Injectable({
  providedIn: "root",
})
export class DevFixtureService {
  constructor(
    private databaseService: DatabaseService,
    private dataService: DataService,
    private mockGitlabInstanceService: MockGitlabInstanceService,
    private mockGithubInstanceService: MockGithubInstanceService,
  ) {}

  get isActive(): boolean {
    try {
      return localStorage.getItem(FIXTURE_ACTIVE_KEY) === "true";
    } catch {
      return false;
    }
  }

  get provider(): GitProviderType {
    try {
      return localStorage.getItem(FIXTURE_PROVIDER_KEY) === "gitlab" ? "gitlab" : "github";
    } catch {
      return "github";
    }
  }

  /**
   * Enables the matching mock account (if needed), seeds a fresh demo assignment
   * and sets it as the current one so the guards let the user reach the graphs.
   */
  async loadDemoAssignment(provider: GitProviderType): Promise<Assignment> {
    await this.ensureMockAccount(provider);
    const assignment = await this.seedAssignment(provider);
    this.saveActive(provider);
    this.dataService.assignment = assignment;
    this.dataService.groupFilter = "";
    return assignment;
  }

  /**
   * Re-activates the demo mode after a reload: re-enables the mocked account,
   * restores (or re-seeds) the assignment and makes it current.
   */
  async restoreIfActive(): Promise<Assignment | null> {
    if (!this.isActive) {
      return null;
    }

    const provider = this.provider;
    await this.ensureMockAccount(provider);

    const id = this.readAssignmentId();
    if (id !== null) {
      const existing = await this.databaseService.getAssignmentById(id);
      if (existing) {
        this.dataService.assignment = existing;
        return existing;
      }
    }

    const assignment = await this.seedAssignment(provider);
    this.dataService.assignment = assignment;
    return assignment;
  }

  /**
   * Disables the demo mode flags. The seeded assignment itself is kept in the
   * database so it remains reachable from the home list.
   */
  clearDemo(): void {
    try {
      localStorage.removeItem(FIXTURE_ACTIVE_KEY);
      localStorage.removeItem(FIXTURE_PROVIDER_KEY);
      localStorage.removeItem(FIXTURE_ASSIGNMENT_ID_KEY);
    } catch {
      /* Storage unavailable */
    }
  }

  private async ensureMockAccount(provider: GitProviderType): Promise<void> {
    if (provider === "gitlab") {
      if (!this.mockGitlabInstanceService.isMockActive) {
        await this.mockGitlabInstanceService.enableMock();
      }
      return;
    }
    if (!this.mockGithubInstanceService.isMockActive) {
      this.mockGithubInstanceService.enableMock();
    }
  }

  private async seedAssignment(provider: GitProviderType): Promise<Assignment> {
    const epoch = Date.now();
    setFixtureEpoch(epoch);
    const assignment = buildDemoAssignment(provider, epoch);
    const id = await this.databaseService.saveAssignment(assignment);
    assignment.id = id;
    this.saveAssignmentId(id);
    await this.seedArchivedAssignment(provider, epoch);
    return assignment;
  }

  /**
   * Seeds an already-archived copy so the « Archivés » tab, its badge and the restore
   * action can be exercised live without a real account. Deliberately a separate row:
   * the demo assignment itself must stay active.
   */
  private async seedArchivedAssignment(provider: GitProviderType, epoch: number): Promise<void> {
    const archived = buildDemoAssignment(provider, epoch);
    archived.title = provider === "gitlab" ? "Démo — UE Algo TP0 (archivé, GitLab)" : "Démo — UE Algo TP0 (archivé, GitHub)";
    /* Fixture hors affichage : l'horloge système suffit (voir AGENTS.md). */
    archived.archivedAt = new Date(epoch - 30 * 24 * 60 * 60 * 1000);
    archived.lastModificationDate = archived.archivedAt;
    await this.databaseService.saveAssignment(archived);
  }

  private saveActive(provider: GitProviderType): void {
    try {
      localStorage.setItem(FIXTURE_ACTIVE_KEY, "true");
      localStorage.setItem(FIXTURE_PROVIDER_KEY, provider);
    } catch {
      /* Storage unavailable */
    }
  }

  private saveAssignmentId(id: number): void {
    try {
      localStorage.setItem(FIXTURE_ASSIGNMENT_ID_KEY, String(id));
    } catch {
      /* Storage unavailable */
    }
  }

  private readAssignmentId(): number | null {
    try {
      const raw = localStorage.getItem(FIXTURE_ASSIGNMENT_ID_KEY);
      const parsed = raw ? parseInt(raw, 10) : NaN;
      return isNaN(parsed) ? null : parsed;
    } catch {
      return null;
    }
  }
}
