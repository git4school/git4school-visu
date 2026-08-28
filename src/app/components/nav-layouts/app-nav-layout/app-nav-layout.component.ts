import {
  Component,
  HostListener,
  OnInit,
} from "@angular/core";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { AuthService } from "@services/auth.service";
import { ConfigurationService } from "@services/configuration.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { ThemeService } from "@services/theme.service";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { ShortcutsModalComponent } from "@shared/ui/shortcuts-modal/shortcuts-modal.component";
import { OsUtils } from "../../../utils/os.utils";

@Component({
  selector: "app-app-nav-layout",
  templateUrl: "./app-nav-layout.component.html",
  styleUrls: ["./app-nav-layout.component.scss"],
})
export class AppNavLayoutComponent implements OnInit {
  constructor(
    public authService: AuthService,
    public dataService: DataService,
    public translateService: TranslateService,
    private assignmentsService: AssignmentsService,
    private databaseService: DatabaseService,
    private configurationService: ConfigurationService,
    public themeService: ThemeService,
    private router: Router,
    private customModalService: CustomModalService
  ) {}

  isSidebarPinned = false;
  isSidebarHovered = false;
  pressedShortcut: string = null;
  sidebarWidth: number = 310;
  isResizing: boolean = false;
  private shortcutsModalRef: CustomModalRef | null = null;

  ngOnInit(): void {
    const savedPin = localStorage.getItem("sidebarPinned");
    if (savedPin) {
      this.isSidebarPinned = savedPin === "true";
    }
    const savedWidth = localStorage.getItem("sidebarWidth");
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed)) {
        this.sidebarWidth = parsed;
      }
    }
  }

  toggleSidebarPin() {
    this.isSidebarPinned = !this.isSidebarPinned;
    localStorage.setItem("sidebarPinned", String(this.isSidebarPinned));
  }

  closeSidebar() {
    this.isSidebarHovered = false;
  }

  hoverTimeout: any;

  onSidebarEnter() {
    clearTimeout(this.hoverTimeout);
    this.isSidebarHovered = true;
  }

  onSidebarLeave() {
    this.hoverTimeout = setTimeout(() => {
      this.isSidebarHovered = false;
    }, 200);
  }

  @HostListener("document:keydown", ["$event"])
  handleKeyDown(event: KeyboardEvent) {
    if (OsUtils.isTypingInInput(event)) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "1") {
      this.triggerShortcutAndNavigate("1", "overview");
    } else if (key === "2") {
      this.triggerShortcutAndNavigate("2", "students-commits");
    } else if (key === "3") {
      this.triggerShortcutAndNavigate("3", "questions-completion");
    } else if (key === "?") {
      this.triggerShortcut("?");
      this.toggleShortcutsModal();
    } else if (key === "c") {
      if (this.dataService.dataLoaded() && !this.isHome && this.dataService.assignment) {
        const hasActiveModal =
          this.customModalService.hasOpenModals() ||
          document.body.classList.contains("modal-open");

        if (!hasActiveModal) {
          event.preventDefault();
          this.triggerShortcut("c");
          this.openCurrentAssignmentConfig();
        }
      }
    }
  }

  onResizeStart(event: MouseEvent) {
    event.preventDefault(); // Prevent text selection during drag
    this.isResizing = true;
  }

  @HostListener("document:mousemove", ["$event"])
  onResize(event: MouseEvent) {
    if (!this.isResizing) return;
    
    // Calculate new width based on mouse X position
    let newWidth = event.clientX;
    
    // Apply constraints
    const minWidth = 250;
    const maxWidth = Math.min(600, window.innerWidth * 0.85);
    
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;
    
    this.sidebarWidth = newWidth;
  }

  @HostListener("document:mouseup")
  onResizeEnd() {
    if (this.isResizing) {
      this.isResizing = false;
      localStorage.setItem("sidebarWidth", this.sidebarWidth.toString());
    }
  }

  private triggerShortcutAndNavigate(key: string, route: string) {
    if (!this.dataService.dataLoaded()) return;
    this.triggerShortcut(key);
    this.router.navigate([route]);
  }

  private triggerShortcut(key: string) {
    this.pressedShortcut = key;
    setTimeout(() => {
      if (this.pressedShortcut === key) this.pressedShortcut = null;
    }, 150);
  }

  toggleShortcutsModal() {
    if (this.shortcutsModalRef) {
      this.shortcutsModalRef.dismiss("Toggle close");
      this.shortcutsModalRef = null;
      return;
    }

    const hasActiveModal =
      this.customModalService.hasOpenModals() ||
      document.body.classList.contains("modal-open");

    if (hasActiveModal) {
      return;
    }

    this.shortcutsModalRef = this.customModalService.open(
      ShortcutsModalComponent,
      { size: "lg" }
    );

    this.shortcutsModalRef.result.finally(() => {
      this.shortcutsModalRef = null;
    });
  }

  openShortcutsModal() {
    this.toggleShortcutsModal();
  }

  get isHome(): boolean {
    return this.router.url.includes('/home');
  }

  get truncatedTitle(): string {
    const title = this.dataService.title;
    if (!title) return "";
    return title.length > 30 ? title.substring(0, 27) + "..." : title;
  }

  openCurrentAssignmentConfig() {
    this.configurationService
      .openConfigurationModal(this.dataService.assignment)
      .finally(() => {
        if (this.dataService.repoToLoad) {
          this.databaseService
            .getAssignmentById(this.dataService.assignment.id)
            .then((assignment) => {
              this.dataService.assignment = assignment;
              this.assignmentsService.assignmentModified.next();
            });
        }
      });
  }
}
