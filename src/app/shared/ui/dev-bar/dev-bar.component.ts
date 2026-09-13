import { Component, HostListener, OnDestroy, OnInit } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { environment } from "@environments/environment";
import { DevFlagsService } from "@services/dev-flags.service";
import { ToastService } from "@services/toast.service";
import { ThemeService } from "@services/theme.service";
import { AuthService } from "@services/auth.service";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { ShortcutsModalComponent } from "@shared/ui/shortcuts-modal/shortcuts-modal.component";

@Component({
  selector: "app-dev-bar",
  templateUrl: "./dev-bar.component.html",
  styleUrls: ["./dev-bar.component.scss"],
})
export class DevBarComponent implements OnInit, OnDestroy {
  readonly isProduction = environment.production;

  isCollapsed = false;
  activePopover: "toasts" | "modals" | "perf" | null = null;

  fps = 60;
  memoryMB: number | null = null;
  viewportWidth = window.innerWidth;
  breakpoint = "desktop";
  currentRoute = "";

  private animFrameId: number | null = null;
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private memoryIntervalId: any = null;
  private routerSub: Subscription | null = null;

  constructor(
    public devFlagsService: DevFlagsService,
    public toastService: ToastService,
    public themeService: ThemeService,
    public authService: AuthService,
    private customModalService: CustomModalService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.isProduction) {
      return;
    }

    // Restore collapsed preference
    try {
      this.isCollapsed = localStorage.getItem("git4school_dev_bar_collapsed") === "true";
    } catch (e) {
      // Ignore localstorage error
    }

    this.updateViewport();
    this.startFpsLoop();
    this.startMemoryMonitoring();

    // Listen to route changes
    this.currentRoute = this.router.url;
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute = event.urlAfterRedirects || event.url;
      });
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.memoryIntervalId) {
      clearInterval(this.memoryIntervalId);
    }
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
  }

  @HostListener("window:resize")
  onResize(): void {
    this.updateViewport();
  }

  private updateViewport(): void {
    this.viewportWidth = window.innerWidth;
    if (this.viewportWidth < 576) {
      this.breakpoint = "xs";
    } else if (this.viewportWidth < 768) {
      this.breakpoint = "sm";
    } else if (this.viewportWidth < 992) {
      this.breakpoint = "md";
    } else if (this.viewportWidth < 1200) {
      this.breakpoint = "lg";
    } else {
      this.breakpoint = "xl";
    }
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

  private startMemoryMonitoring(): void {
    const updateMem = () => {
      const perf = performance as any;
      if (perf && perf.memory && perf.memory.usedJSHeapSize) {
        this.memoryMB = Math.round(perf.memory.usedJSHeapSize / (1024 * 1024));
      } else {
        this.memoryMB = null;
      }
    };
    updateMem();
    this.memoryIntervalId = setInterval(updateMem, 2500);
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.activePopover = null;
    try {
      localStorage.setItem("git4school_dev_bar_collapsed", String(this.isCollapsed));
    } catch (e) {}
  }

  togglePopover(name: "toasts" | "modals" | "perf"): void {
    this.activePopover = this.activePopover === name ? null : name;
  }

  closePopover(): void {
    this.activePopover = null;
  }

  // Toasts Testing Triggers
  triggerToast(type: "success" | "warning" | "error" | "copy"): void {
    switch (type) {
      case "success":
        this.toastService.success("Succès (Test)", "L'opération de test s'est déroulée avec succès.");
        break;
      case "warning":
        this.toastService.warning("Attention (Test)", "Avertissement : validation ou quota intermédiaire.");
        break;
      case "error":
        this.toastService.error("Erreur (Test)", "Échec simulé lors de la communication réseau.");
        break;
      case "copy":
        this.toastService.copy("Copié (Test)", "Identifiant copié dans le presse-papier.");
        break;
    }
  }

  // Modals Quick Open
  openAccountsModal(): void {
    window.dispatchEvent(new CustomEvent("git4school:open-accounts-modal"));
    this.closePopover();
  }

  openShortcutsModal(): void {
    this.customModalService.open(ShortcutsModalComponent, { size: "lg" });
    this.closePopover();
  }

  // Feature Flags
  toggleGitlabCloud(): void {
    this.devFlagsService.toggleGitlabCloud();
    const state = this.devFlagsService.gitlabCloudEnabled ? "activé" : "désactivé";
    this.toastService.success("Feature Flag", `GitLab Cloud ${state}`);
  }

  toggleGitlabCustom(): void {
    this.devFlagsService.toggleGitlabCustom();
    const state = this.devFlagsService.gitlabCustomEnabled ? "activé" : "désactivé";
    this.toastService.success("Feature Flag", `GitLab Auto-hébergé ${state}`);
  }

  // Quick Utilities
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
}
