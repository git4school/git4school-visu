import {
  Component,
  HostListener,
  OnInit,
  ViewChild,
  ElementRef,
} from "@angular/core";
import { Router } from "@angular/router";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { AuthService } from "@services/auth.service";
import { ConfigurationService } from "@services/configuration.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { ThemeService } from "@services/theme.service";

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
    private modalService: NgbModal
  ) {}

  isSidebarPinned = false;
  isSidebarHovered = false;
  pressedShortcut: string = null;
  @ViewChild("shortcutsModal") shortcutsModal: ElementRef;

  ngOnInit(): void {
    const savedPin = localStorage.getItem("sidebarPinned");
    if (savedPin) {
      this.isSidebarPinned = savedPin === "true";
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
    // Ignore shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    const key = event.key;
    if (key === "1") {
      this.triggerShortcutAndNavigate("1", "overview");
    } else if (key === "2") {
      this.triggerShortcutAndNavigate("2", "students-commits");
    } else if (key === "3") {
      this.triggerShortcutAndNavigate("3", "questions-completion");
    } else if (key === "?") {
      this.triggerShortcut("?");
      this.openShortcutsModal();
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

  openShortcutsModal() {
    this.modalService.open(this.shortcutsModal, { size: "lg", centered: true });
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
