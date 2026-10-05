import { Component, HostListener, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { Subscription } from "rxjs";
import { environment } from "@environments/environment";
import { GitProviderType } from "@models/Account.model";
import { Session } from "@models/Session.model";
import { AssignmentsService } from "@services/assignments.service";
import { ClockService, DAY_MS, HOUR_MS, MINUTE_MS } from "@services/clock.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { DevFlagsService } from "@services/dev-flags.service";
import { DevFixtureService } from "@app/dev-mock/dev-fixture.service";
import { MockGithubInstanceService } from "@app/dev-mock/mock-github-instance.service";
import { MockGitlabInstanceService } from "@app/dev-mock/mock-gitlab-instance.service";
import { ToastService } from "@services/toast.service";
import { GithubAuthService } from "@services/github-auth.service";

@Component({
  selector: "app-dev-bar",
  templateUrl: "./dev-bar.component.html",
  styleUrls: ["./dev-bar.component.scss"],
})
export class DevBarComponent implements OnInit, OnDestroy {
  readonly isProduction = environment.production;

  readonly DAY_MS = DAY_MS;
  readonly HOUR_MS = HOUR_MS;

  isCollapsed = false;
  activePopover: "toasts" | "clock" | "mocks" | "demo" | null = null;

  fps = 60;
  memoryMB: number | null = null;
  viewportWidth = window.innerWidth;
  breakpoint = "desktop";

  clockDate: Date | null = null;

  private animFrameId: number | null = null;
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private memoryIntervalId: any = null;
  private clockTickerId: any = null;
  private clockSub: Subscription | null = null;

  constructor(
    public devFlagsService: DevFlagsService,
    public mockGitlabInstanceService: MockGitlabInstanceService,
    public mockGithubInstanceService: MockGithubInstanceService,
    public devFixtureService: DevFixtureService,
    public toastService: ToastService,
    public githubAuthService: GithubAuthService,
    public clockService: ClockService,
    public dataService: DataService,
    private assignmentsService: AssignmentsService,
    private databaseService: DatabaseService,
    private translateService: TranslateService,
    private router: Router,
  ) {}

  @HostListener("window:resize")
  onResize(): void {
    this.updateViewport();
  }

  ngOnInit(): void {
    if (this.isProduction) {
      return;
    }

    /* Restore collapsed preference */
    try {
      this.isCollapsed = localStorage.getItem("git4school_dev_bar_collapsed") === "true";
    } catch (e) {
      /* Ignore localstorage error */
    }

    this.updateViewport();
    this.startFpsLoop();
    this.startMemoryMonitoring();

    /* Reflect simulated clock shifts immediately in the dev bar display */
    this.clockSub = this.clockService.offsetMs$.subscribe(() => {
      this.clockDate = this.clockService.now();
    });

    this.restoreFixtureIfActive();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrameId);
    clearInterval(this.memoryIntervalId);
    clearInterval(this.clockTickerId);
    this.clockSub?.unsubscribe();
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.closePopover();
    try {
      localStorage.setItem("git4school_dev_bar_collapsed", String(this.isCollapsed));
    } catch (e) {}
  }

  togglePopover(name: "toasts" | "clock" | "mocks" | "demo"): void {
    this.activePopover = this.activePopover === name ? null : name;

    if (this.activePopover === "clock") {
      this.openClockPopover();
    } else {
      this.stopClockTicker();
    }
  }

  closePopover(): void {
    this.activePopover = null;
    this.stopClockTicker();
  }

  /* Simulated Clock */
  get clockOffsetLabel(): string {
    const ms = this.clockService.offsetMs;
    if (ms === 0) {
      return "";
    }
    const sign = ms > 0 ? "+" : "-";
    const abs = Math.abs(ms);
    if (abs >= DAY_MS && abs % HOUR_MS === 0) {
      return `${sign}${abs / DAY_MS} ${this.translateService.instant("DEV-BAR.CLOCK.UNIT-DAY")}`;
    }
    if (abs >= HOUR_MS && abs % MINUTE_MS === 0) {
      return `${sign}${abs / HOUR_MS} ${this.translateService.instant("DEV-BAR.CLOCK.UNIT-HOUR")}`;
    }
    return `${sign}${Math.round(abs / MINUTE_MS)} ${this.translateService.instant("DEV-BAR.CLOCK.UNIT-MINUTE")}`;
  }

  get simulatedNowLabel(): string {
    return this.clockService.moment().format("DD/MM/YYYY HH:mm");
  }

  onClockDateChange(date: Date | null): void {
    if (date) {
      this.clockService.setNow(date);
    }
  }

  shiftClock(deltaMs: number): void {
    this.clockService.shift(deltaMs);
  }

  resetClock(): void {
    this.clockService.reset();
    this.toastService.success(
      this.translateService.instant("DEV-BAR.CLOCK.HEADER"),
      this.translateService.instant("DEV-BAR.CLOCK.RESET-TOAST"),
    );
  }

  /* Toasts Testing Triggers */
  triggerToast(type: "success" | "warning" | "error" | "copy"): void {
    const toastConfig: Record<
      string,
      {
        method: "success" | "warning" | "error" | "copy";
        title: string;
        msg: string;
      }
    > = {
      success: {
        method: "success",
        title: "Succès (Test)",
        msg: "L'opération de test s'est déroulée avec succès.",
      },
      warning: {
        method: "warning",
        title: "Attention (Test)",
        msg: "Avertissement : validation ou quota intermédiaire.",
      },
      error: {
        method: "error",
        title: "Erreur (Test)",
        msg: "Échec simulé lors de la communication réseau.",
      },
      copy: {
        method: "copy",
        title: "Copié (Test)",
        msg: "Identifiant copié dans le presse-papier.",
      },
    };
    const c = toastConfig[type];
    this.toastService[c.method](c.title, c.msg);
  }

  /* Mock Git Instances */
  async toggleMockGitlab(): Promise<void> {
    const active = await this.mockGitlabInstanceService.toggleMock();
    const key = active ? "DEV-BAR.MOCK.GITLAB-ON" : "DEV-BAR.MOCK.GITLAB-OFF";
    this.toastService.success(this.translateService.instant("DEV-BAR.MOCK.TITLE"), this.translateService.instant(key));
  }

  async toggleMockGithub(): Promise<void> {
    const active = await this.mockGithubInstanceService.toggleMock();
    const key = active ? "DEV-BAR.MOCK.GITHUB-ON" : "DEV-BAR.MOCK.GITHUB-OFF";
    this.toastService.success(this.translateService.instant("DEV-BAR.MOCK.TITLE"), this.translateService.instant(key));
  }

  /* Add a session starting in 30 seconds, to exercise the session tab's swap */
  async addTestSession(): Promise<void> {
    const assignment = this.dataService.assignment;
    if (!assignment) {
      this.toastService.warning(
        this.translateService.instant("DEV-BAR.SESSION.TOAST-TITLE"),
        this.translateService.instant("DEV-BAR.SESSION.NO-ASSIGNMENT"),
      );
      return;
    }

    const start = new Date(this.clockService.now().getTime() + 30 * 1000);
    const duration = assignment.defaultSessionDuration || { hour: 2, minute: 0 };
    const end = new Date(start.getTime() + (duration.hour * 60 + duration.minute) * 60 * 1000);

    this.dataService.sessions = [
      ...(this.dataService.sessions || []),
      new Session(
        start,
        end,
        this.dataService.groupFilter || undefined,
        undefined,
        this.translateService.instant("DEV-BAR.SESSION.LABEL-VALUE"),
      ),
    ];

    await this.databaseService.saveAssignment(assignment);
    this.assignmentsService.assignmentModified.next();

    this.toastService.success(
      this.translateService.instant("DEV-BAR.SESSION.TOAST-TITLE"),
      this.translateService.instant("DEV-BAR.SESSION.ADDED"),
    );
  }

  /* Demo fixture */
  async loadDemo(provider: GitProviderType): Promise<void> {
    await this.devFixtureService.loadDemoAssignment(provider);
    this.closePopover();
    const key = provider === "gitlab" ? "DEV-BAR.FIXTURE.GITLAB-LOADED" : "DEV-BAR.FIXTURE.GITHUB-LOADED";
    this.toastService.success(this.translateService.instant("DEV-BAR.FIXTURE.LABEL"), this.translateService.instant(key));
    this.router.navigate(["commits"]);
  }

  clearDemo(): void {
    this.devFixtureService.clearDemo();
    this.closePopover();
    this.toastService.warning(
      this.translateService.instant("DEV-BAR.FIXTURE.LABEL"),
      this.translateService.instant("DEV-BAR.FIXTURE.CLEARED"),
    );
  }

  /* Quick Utilities */
  clearStorage(): void {
    try {
      localStorage.clear();
      this.toastService.warning("Dev Bar", "LocalStorage intégralement vidé.");
    } catch (e) {
      this.toastService.error("Dev Bar", "Impossible de vider le LocalStorage.");
    }
  }

  private restoreFixtureIfActive(): void {
    this.devFixtureService.restoreIfActive().then((assignment) => {
      if (!assignment) {
        return;
      }
      const url = this.router.url;
      if (url === "/" || url.includes("/home")) {
        this.router.navigate(["commits"]);
      }
    });
  }

  private updateViewport(): void {
    const w = window.innerWidth;
    this.viewportWidth = w;
    const bps: [number, "xs" | "sm" | "md" | "lg"][] = [
      [576, "xs"],
      [768, "sm"],
      [992, "md"],
      [1200, "lg"],
    ];
    const match = bps.find(([max]) => w < max);
    this.breakpoint = match ? match[1] : "xl";
  }

  private startFpsLoop = () => {
    this.frameCount++;
    const now = performance.now();
    const delta = now - this.lastFpsTime;

    if (delta >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / delta);
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    this.animFrameId = requestAnimationFrame(this.startFpsLoop);
  };

  private openClockPopover(): void {
    this.stopClockTicker();
    this.clockDate = this.clockService.now();
    /* The offset is fixed but the real clock keeps ticking: keep the readout fresh */
    this.clockTickerId = setInterval(() => {
      this.clockDate = this.clockService.now();
    }, 10000);
  }

  private stopClockTicker(): void {
    clearInterval(this.clockTickerId);
    this.clockTickerId = null;
  }

  private startMemoryMonitoring(): void {
    const updateMem = () => {
      const heap = (performance as any)?.memory?.usedJSHeapSize;
      this.memoryMB = heap ? Math.round(heap / (1024 * 1024)) : null;
    };
    updateMem();
    this.memoryIntervalId = setInterval(updateMem, 2500);
  }
}
