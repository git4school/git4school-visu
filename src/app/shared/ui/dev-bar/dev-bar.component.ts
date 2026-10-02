import { Component, HostListener, OnDestroy, OnInit } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { environment } from "@environments/environment";
import { ClockService, DAY_MS, HOUR_MS, MINUTE_MS } from "@services/clock.service";
import { DevFlagsService } from "@services/dev-flags.service";
import { MockGitlabInstanceService } from "@app/dev-mock/mock-gitlab-instance.service";
import { ToastService } from "@services/toast.service";
import { ThemeService } from "@services/theme.service";
import { GithubAuthService } from "@services/github-auth.service";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { ShortcutsModalComponent } from "@shared/ui/shortcuts-modal/shortcuts-modal.component";

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
  activePopover: "toasts" | "modals" | "clock" | null = null;

  fps = 60;
  memoryMB: number | null = null;
  viewportWidth = window.innerWidth;
  breakpoint = "desktop";
  currentRoute = "";

  clockDate: Date | null = null;

  private animFrameId: number | null = null;
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private memoryIntervalId: any = null;
  private clockTickerId: any = null;
  private routerSub: Subscription | null = null;
  private clockSub: Subscription | null = null;

  constructor(
    public devFlagsService: DevFlagsService,
    public mockGitlabInstanceService: MockGitlabInstanceService,
    public toastService: ToastService,
    public themeService: ThemeService,
    public githubAuthService: GithubAuthService,
    public clockService: ClockService,
    private translateService: TranslateService,
    private customModalService: CustomModalService,
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

    /* Listen to route changes */
    this.currentRoute = this.router.url;
    this.routerSub = this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event: any) => {
      this.currentRoute = event.urlAfterRedirects || event.url;
    });

    /* Reflect simulated clock shifts immediately in the dev bar display */
    this.clockSub = this.clockService.offsetMs$.subscribe(() => {
      this.clockDate = this.clockService.now();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrameId);
    clearInterval(this.memoryIntervalId);
    clearInterval(this.clockTickerId);
    this.routerSub?.unsubscribe();
    this.clockSub?.unsubscribe();
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.closePopover();
    try {
      localStorage.setItem("git4school_dev_bar_collapsed", String(this.isCollapsed));
    } catch (e) {}
  }

  togglePopover(name: "toasts" | "modals" | "clock"): void {
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

  /* Modals Quick Open */
  openAccountsModal(): void {
    window.dispatchEvent(new CustomEvent("git4school:open-accounts-modal"));
    this.closePopover();
  }

  openShortcutsModal(): void {
    this.customModalService.open(ShortcutsModalComponent, { size: "lg" });
    this.closePopover();
  }

  /* Mock GitLab Instance */
  async toggleMockGitlab(): Promise<void> {
    const active = await this.mockGitlabInstanceService.toggleMock();
    const state = active ? "activé (prof.turing @ gitlab.univ-tlse3.fr)" : "désactivé";
    this.toastService.success("Mock GitLab", `Mock d'instance GitLab ${state}`);
  }

  /* Quick Utilities */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  clearStorage(): void {
    try {
      localStorage.clear();
      this.toastService.warning("Dev Bar", "LocalStorage intégralement vidé.");
    } catch (e) {
      this.toastService.error("Dev Bar", "Impossible de vider le LocalStorage.");
    }
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
