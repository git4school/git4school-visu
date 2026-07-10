import {
  Component,
  EventEmitter,
  OnInit,
  OnDestroy,
  Output,
  ChangeDetectorRef,
  Input,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { Router } from "@angular/router";
import { Assignment } from "@models/Assignment.model";
import { AssignmentsService } from "@services/assignments.service";
import { ConfigurationService } from "@services/configuration.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { ThemeService } from "@services/theme.service";
import { Subscription } from "rxjs";

import { AuthService } from "@services/auth.service";
import { TranslateService } from "@ngx-translate/core";
import { TourService } from "@services/tour.service";

@Component({
  selector: "app-sidebar-settings",
  templateUrl: "./sidebar-settings.component.html",
  styleUrls: ["./sidebar-settings.component.scss"],
})
export class SidebarSettingsComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isOpen = false;
  // eslint-disable-next-line @angular-eslint/no-output-on-prefix
  @Output() onClose = new EventEmitter<void>();

  isHovered = false;
  wasClicked = false;
  recentAssignments: Assignment[] = [];
  totalAssignmentsCount = 0;
  displayLimit: number | 'all' = 5;
  private dbSubscription: Subscription;

  constructor(
    public themeService: ThemeService,
    private databaseService: DatabaseService,
    private dataService: DataService,
    private router: Router,
    private configurationService: ConfigurationService,
    private assignmentsService: AssignmentsService,
    public authService: AuthService,
    public translateService: TranslateService,
    private tourService: TourService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const savedLimit = localStorage.getItem('recentAssignmentsLimit');
    if (savedLimit === 'all') {
      this.displayLimit = 'all';
    } else if (savedLimit) {
      this.displayLimit = parseInt(savedLimit, 10);
    }

    this.loadRecentAssignments();
    this.dbSubscription = this.databaseService.dbChanged.subscribe(() => {
      this.loadRecentAssignments();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["isOpen"] && changes["isOpen"].currentValue === true) {
      this.loadRecentAssignments();
    }
  }

  ngOnDestroy(): void {
    if (this.dbSubscription) {
      this.dbSubscription.unsubscribe();
    }
  }

  computeType(assignment: Assignment): "github" | "gitlab" {
    if (assignment.title && assignment.title.toLowerCase().includes("gitlab")) {
      return "gitlab";
    }
    return "github";
  }

  async loadRecentAssignments() {
    let all = await this.databaseService.getAllAssignments();
    this.totalAssignmentsCount = all.length;

    // Filter by connection
    const isGithubConnected = !!this.authService.isSignedIn();
    const isGitlabConnected = false; // Mock for now

    let filtered = all.filter((a) => {
      (a as any).uiType = this.computeType(a);
      if ((a as any).uiType === "github") return isGithubConnected;
      if ((a as any).uiType === "gitlab") return isGitlabConnected;
      return false;
    });

    // Sort by lastModificationDate descending (most recently modified or opened)
    filtered.sort((a, b) => {
      const dateA = a.lastModificationDate
        ? new Date(a.lastModificationDate).getTime()
        : 0;
      const dateB = b.lastModificationDate
        ? new Date(b.lastModificationDate).getTime()
        : 0;
      return dateB - dateA;
    });

    if (this.displayLimit !== 'all') {
      filtered = filtered.slice(0, this.displayLimit);
    }

    this.recentAssignments = filtered;
    this.cdr.detectChanges();
  }

  getTruncatedText(text: string, limit: number = 30): string {
    if (!text) return "";
    return text.length > limit ? text.substring(0, limit - 3) + "..." : text;
  }

  openAssignment(assignment: Assignment) {
    this.databaseService
      .getAssignmentById(assignment.id)
      .then((fullAssignment) => {
        this.dataService.assignment = fullAssignment;
        this.dataService.groupFilter = "";
        this.onClose.emit();
        this.assignmentsService.assignmentModified.next();
        this.router.navigate(["/overview"]);
      });
  }

  editAssignment(assignment: Assignment) {
    this.databaseService
      .getAssignmentById(assignment.id)
      .then((fullAssignment) => {
        this.configurationService
          .openConfigurationModal(fullAssignment)
          .finally(() => {
            this.loadRecentAssignments();
            if (
              this.dataService.assignment &&
              this.dataService.assignment.id === fullAssignment.id
            ) {
              this.databaseService
                .getAssignmentById(fullAssignment.id)
                .then((updated) => {
                  this.dataService.assignment = updated;
                  this.assignmentsService.assignmentModified.next();
                });
            }
          });
      });
  }

  onMouseEnter() {
    this.isHovered = true;
    this.wasClicked = false;
  }

  onMouseLeave() {
    this.isHovered = false;
    this.wasClicked = false;
  }

  onClickTheme() {
    this.themeService.toggleTheme();
    this.wasClicked = true;
  }

  toggleDisplayLimit() {
    if (this.displayLimit === 5) {
      this.displayLimit = 10;
    } else if (this.displayLimit === 10) {
      this.displayLimit = 'all';
    } else {
      this.displayLimit = 5;
    }
    localStorage.setItem('recentAssignmentsLimit', String(this.displayLimit));
    this.loadRecentAssignments();
  }

  langNames: { [key: string]: string } = {
    en: "English",
    fr: "Français",
    ru: "Русский",
  };

  get currentLang() {
    return this.translateService.currentLang || localStorage.getItem("language") || this.translateService.defaultLang || "en";
  }

  changeLanguage(language: string) {
    this.translateService.use(language);
    localStorage.setItem("language", language);
  }

  onSignOut() {
    this.authService.signOut();
  }

  replayTour() {
    this.onClose.emit();
    setTimeout(() => {
      this.tourService.startTour();
    }, 300);
  }

  openUserDocumentation() {
    window.open(
      "https://github.com/Fabio1210/git4school-visu/wiki/Tutoriel-d'utilisation",
      "_blank"
    );
  }
}
