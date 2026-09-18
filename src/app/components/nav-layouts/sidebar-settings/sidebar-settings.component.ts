import { Component, EventEmitter, OnInit, OnDestroy, Output, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Assignment } from "@models/Assignment.model";
import { AssignmentsService } from "@services/assignments.service";
import { ConfigurationService } from "@services/configuration.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { ThemeService } from "@services/theme.service";
import { Subscription } from "rxjs";

import { GithubAuthService } from "@services/github-auth.service";
import { TranslateService } from "@ngx-translate/core";
import { TourService } from "@services/tour.service";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { ShortcutsModalComponent } from "@shared/ui/shortcuts-modal/shortcuts-modal.component";
import { AccountsService } from "@services/accounts.service";
import { environment } from "@environments/environment";

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
  displayLimit: number | "all" = 5;
  langNames: { [key: string]: string } = {
    en: "English",
    fr: "Français",
    ru: "Русский",
  };
  private dbSubscription: Subscription;
  private authSub: Subscription;

  constructor(
    public themeService: ThemeService,
    private databaseService: DatabaseService,
    private dataService: DataService,
    private router: Router,
    private route: ActivatedRoute,
    private configurationService: ConfigurationService,
    private assignmentsService: AssignmentsService,
    public githubAuthService: GithubAuthService,
    public translateService: TranslateService,
    private tourService: TourService,
    private customModalService: CustomModalService,
    public accountsService: AccountsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const savedLimit = localStorage.getItem("recentAssignmentsLimit");
    if (savedLimit === "all") {
      this.displayLimit = "all";
    } else if (savedLimit) {
      this.displayLimit = parseInt(savedLimit, 10);
    }

    this.authSub = this.accountsService.accounts$.subscribe(() => {
      this.loadRecentAssignments();
      this.cdr.markForCheck();
    });

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
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }

  computeType(assignment: Assignment): "github" | "gitlab" {
    if (assignment.provider) {
      return assignment.provider;
    }
    if (assignment.repositories && assignment.repositories.length > 0) {
      const gitlabRepo = assignment.repositories.find((r) => r.provider === "gitlab" || r.url?.includes("gitlab"));
      if (gitlabRepo) {
        return "gitlab";
      }
    }
    return "github";
  }

  async loadRecentAssignments() {
    const all = await this.databaseService.getAllAssignments();
    this.totalAssignmentsCount = all.length;

    const filtered = all.filter((a) => {
      const type = this.computeType(a);
      (a as any).uiType = type;
      return this.accountsService.hasAccountForHost(type, a.instanceHost || a.resolvedInstanceHost);
    });

    // Sort by lastModificationDate descending (most recently modified or opened)
    filtered.sort((a, b) => {
      const dateA = a.lastModificationDate ? new Date(a.lastModificationDate).getTime() : 0;
      const dateB = b.lastModificationDate ? new Date(b.lastModificationDate).getTime() : 0;
      return dateB - dateA;
    });

    if (this.displayLimit !== "all") {
      this.recentAssignments = filtered.slice(0, this.displayLimit);
    } else {
      this.recentAssignments = filtered;
    }

    this.cdr.detectChanges();
  }

  getTruncatedText(text: string, limit: number = 30): string {
    if (!text) return "";
    return text.length > limit ? text.substring(0, limit - 3) + "..." : text;
  }

  openAssignment(assignment: Assignment) {
    this.databaseService.getAssignmentById(assignment.id).then((fullAssignment) => {
      this.dataService.assignment = fullAssignment;
      this.dataService.groupFilter = "";
      this.onClose.emit();
      this.assignmentsService.assignmentModified.next();
      this.router.navigate(["/commits"]);
    });
  }

  editAssignment(assignment: Assignment) {
    this.databaseService.getAssignmentById(assignment.id).then((fullAssignment) => {
      this.configurationService.openConfigurationModal(fullAssignment).finally(() => {
        this.loadRecentAssignments();
        if (this.dataService.assignment && this.dataService.assignment.id === fullAssignment.id) {
          this.databaseService.getAssignmentById(fullAssignment.id).then((updated) => {
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
      this.displayLimit = "all";
    } else {
      this.displayLimit = 5;
    }
    localStorage.setItem("recentAssignmentsLimit", String(this.displayLimit));
    this.loadRecentAssignments();
  }

  get currentLang() {
    return this.translateService.currentLang || localStorage.getItem("language") || this.translateService.defaultLang || "en";
  }

  changeLanguage(language: string) {
    this.translateService.use(language);
    localStorage.setItem("language", language);
  }

  onSignOut() {
    this.githubAuthService.signOut();
  }

  replayTour() {
    this.onClose.emit();
    setTimeout(() => {
      this.tourService.startTour();
    }, 300);
  }

  openUserDocumentation() {
    window.open(environment.documentationUrl, "_blank");
  }

  openShortcuts() {
    this.onClose.emit();
    this.customModalService.open(ShortcutsModalComponent, { size: "lg" });
  }
}
