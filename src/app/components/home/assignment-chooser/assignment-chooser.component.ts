import { Component, OnInit, TemplateRef, ViewChild, ChangeDetectorRef, OnDestroy, HostListener } from "@angular/core";
import { Router } from "@angular/router";
import { Assignment } from "@models/Assignment.model";
import { GitProviderType } from "@models/GitAuthProvider.model";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { AccountsService } from "@services/accounts.service";
import { GithubAuthService } from "@services/github-auth.service";
import { ConfigurationService } from "@services/configuration.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { OverlayManagerService } from "@services/overlay-manager.service";
import { ToastService } from "@services/toast.service";
import { Subscription } from "rxjs";
import * as moment from "moment";

@Component({
  selector: "assignment-chooser",
  templateUrl: "./assignment-chooser.component.html",
  styleUrls: ["./assignment-chooser.component.scss"],
})
export class AssignmentChooserComponent implements OnInit, OnDestroy {
  assignments: any[]; // Using any to attach UI-specific properties temporarily

  sortField = "lastModificationDate";
  sortDirection: "asc" | "desc" = "desc";

  filterType: "all" | "github" | "gitlab" = "all";

  searchQuery = "";

  advancedFilters = {
    status: {
      prepared: true,
      ongoing: true,
      finished: true,
      default: true,
    },
    course: "",
    program: "",
    year: "",
  };

  availableCourses: string[] = [];
  availablePrograms: string[] = [];
  availableYears: string[] = [];

  selectionMode = false;
  selectedAssignments: Set<number> = new Set();
  hoveredAssignment: number | null = null;

  // Status hover preview state
  hoveredStatusPreview: string | null = null;

  // Provider split button dropdown state
  isProviderDropdownOpen = false;
  lastUsedProvider: GitProviderType = "github";

  // Inline edit state
  editingAssignmentId: number | null = null;
  isCreatingNew = false;

  isSortHovered = false;
  sortWasClicked = false;

  private dbSubscription?: Subscription;
  private overlaySub: Subscription | null = null;
  private accountsSub?: Subscription;
  private statusPreviewTimeout: any = null;

  constructor(
    private databaseService: DatabaseService,
    private dataService: DataService,
    private router: Router,
    public githubAuthService: GithubAuthService,
    public accountsService: AccountsService,
    private overlayManager: OverlayManagerService,
    private translateService: TranslateService,
    private toastService: ToastService,
    private assignmentsService: AssignmentsService,
    private configurationService: ConfigurationService,
    private cdr: ChangeDetectorRef,
  ) {}

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target || !target.isConnected) {
      return;
    }
    if (!target.closest(".creation-interactive-wrapper")) {
      this.closeAllCreationPopovers();
    }
  }

  @HostListener("window:keydown.escape")
  onEscape(): void {
    this.closeAllCreationPopovers();
  }

  get filteredAssignments() {
    let result = this.assignments;

    // Always show the assignment currently being created at the top, even if it doesn't match filters
    const newAssignment = this.assignments.find((a) => a.id === -1);

    // Apply old filterType
    if (this.filterType !== "all") {
      result = result.filter((a) => (a as any).uiType === this.filterType || a.id === -1);
    }

    // Apply search query
    if (this.searchQuery && this.searchQuery.trim() !== "") {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.id === -1 ||
          (a.title && a.title.toLowerCase().includes(q)) ||
          (a.course && a.course.toLowerCase().includes(q)) ||
          (a.program && a.program.toLowerCase().includes(q)) ||
          (a.year && a.year.toLowerCase().includes(q)),
      );
    }

    // Apply advanced status filters
    const statusFilters = this.advancedFilters.status;
    const isAnyStatusFilterActive = statusFilters.prepared || statusFilters.ongoing || statusFilters.finished || statusFilters.default;

    if (isAnyStatusFilterActive) {
      result = result.filter((a) => {
        if (a.id === -1) return true;
        const status = (a as any).uiStatus;
        if (status === "prepared" && statusFilters.prepared) return true;
        if (status === "ongoing" && statusFilters.ongoing) return true;
        if (status === "finished" && statusFilters.finished) return true;
        if (status === "default" && statusFilters.default) return true;
        return false;
      });
    }

    // Apply course filter
    if (this.advancedFilters.course) {
      result = result.filter((a) => a.id === -1 || a.course === this.advancedFilters.course);
    }

    // Apply program filter
    if (this.advancedFilters.program) {
      result = result.filter((a) => a.id === -1 || a.program === this.advancedFilters.program);
    }

    // Apply year filter
    if (this.advancedFilters.year) {
      result = result.filter((a) => a.id === -1 || a.year === this.advancedFilters.year);
    }

    return result;
  }

  getActiveFiltersCount(): number {
    let count = 0;
    const s = this.advancedFilters.status;
    if (!s.prepared || !s.ongoing || !s.finished || !s.default) count++;
    if (this.advancedFilters.course) count++;
    if (this.advancedFilters.program) count++;
    if (this.advancedFilters.year) count++;
    // filterType (All/Github/Gitlab) is tracked outside the new badge count to preserve its original behavior
    return count;
  }

  resetAdvancedFilters() {
    this.advancedFilters = {
      status: { prepared: true, ongoing: true, finished: true, default: true },
      course: "",
      program: "",
      year: "",
    };
    this.searchQuery = "";
    this.savePreferences();
  }

  setFilter(type: "all" | "github" | "gitlab") {
    this.filterType = type;
  }

  onStatusMouseEnter(status: string) {
    if (this.statusPreviewTimeout) {
      clearTimeout(this.statusPreviewTimeout);
    }
    this.statusPreviewTimeout = setTimeout(() => {
      this.hoveredStatusPreview = status;
      this.cdr.markForCheck();
    }, 180);
  }

  onStatusMouseLeave() {
    if (this.statusPreviewTimeout) {
      clearTimeout(this.statusPreviewTimeout);
      this.statusPreviewTimeout = null;
    }
    if (this.hoveredStatusPreview !== null) {
      this.hoveredStatusPreview = null;
      this.cdr.markForCheck();
    }
  }

  isStatusIsolated(status: string): boolean {
    const s = this.advancedFilters.status;
    const allStatuses: Array<keyof typeof s> = ["prepared", "ongoing", "finished", "default"];
    return s[status as keyof typeof s] === true && allStatuses.filter((k) => k !== status).every((k) => !s[k]);
  }

  getStatusTooltip(status: string): string {
    return this.isStatusIsolated(status) ? "HOME.STATUS-TOOLTIP-RESET" : "HOME.STATUS-TOOLTIP-ISOLATE";
  }

  toggleStatusFilterFromBadge(status: "prepared" | "ongoing" | "finished" | "default", event: MouseEvent) {
    event.stopPropagation();
    if (this.statusPreviewTimeout) {
      clearTimeout(this.statusPreviewTimeout);
      this.statusPreviewTimeout = null;
    }
    this.hoveredStatusPreview = null;

    if (this.isStatusIsolated(status)) {
      this.advancedFilters.status = {
        prepared: true,
        ongoing: true,
        finished: true,
        default: true,
      };
    } else {
      this.advancedFilters.status = {
        prepared: status === "prepared",
        ongoing: status === "ongoing",
        finished: status === "finished",
        default: status === "default",
      };
    }
    this.savePreferences();
    this.cdr.markForCheck();
  }

  isAssignmentConnected(assignment: any): boolean {
    if (!assignment) {
      return false;
    }
    const provider = (assignment.provider || assignment.uiType || "github") as GitProviderType;
    return this.accountsService.hasAccount(provider);
  }

  get isGithubConnected(): boolean {
    return this.accountsService.isGithubConnected;
  }

  get isGitlabConnected(): boolean {
    return this.accountsService.isGitlabConnected;
  }

  get canCreateAny(): boolean {
    return !this.accountsService.isEmpty();
  }

  get hasMultipleProviders(): boolean {
    return this.isGithubConnected && this.isGitlabConnected;
  }

  get singleConnectedProvider(): GitProviderType {
    return this.isGithubConnected ? "github" : "gitlab";
  }

  ngOnInit(): void {
    this.assignments = [];
    this.loadPreferences();
    this.loadAssignments();
    this.dbSubscription = this.databaseService.dbChanged.subscribe(() => {
      this.loadAssignments();
    });

    this.overlaySub = this.overlayManager.dismiss$.subscribe(() => {
      this.closeAllCreationPopovers();
    });

    this.accountsSub = this.accountsService.accounts$.subscribe(() => {
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    if (this.dbSubscription) {
      this.dbSubscription.unsubscribe();
    }
    if (this.overlaySub) {
      this.overlaySub.unsubscribe();
    }
    if (this.accountsSub) {
      this.accountsSub.unsubscribe();
    }
    if (this.statusPreviewTimeout) {
      clearTimeout(this.statusPreviewTimeout);
    }
  }

  loadPreferences() {
    const prefs = localStorage.getItem("assignment-chooser-prefs");
    if (prefs) {
      try {
        const parsed = JSON.parse(prefs);
        if (parsed.sortField) this.sortField = parsed.sortField;
        if (parsed.sortDirection) this.sortDirection = parsed.sortDirection;
        if (parsed.advancedFilters) this.advancedFilters = parsed.advancedFilters;
      } catch (e) {
        console.error("Could not load preferences", e);
      }
    }
    const savedProvider = localStorage.getItem("git4school_last_provider") as GitProviderType;
    if (savedProvider && (savedProvider === "github" || savedProvider === "gitlab")) {
      this.lastUsedProvider = savedProvider;
    }
  }

  savePreferences() {
    localStorage.setItem(
      "assignment-chooser-prefs",
      JSON.stringify({
        sortField: this.sortField,
        sortDirection: this.sortDirection,
        advancedFilters: this.advancedFilters,
      }),
    );
  }

  async loadAssignments() {
    // Preserve editing state if possible, unless it's a new assignment
    const currentEditingId = this.editingAssignmentId;
    const wasCreatingNew = this.isCreatingNew;
    let newAssignmentObj = null;

    if (wasCreatingNew) {
      newAssignmentObj = this.assignments.find((a) => a.id === -1);
    }

    await this.databaseService.getAllAssignments().then((assignments) => {
      // Map assignments to add UI-specific computed properties directly to the Assignment objects
      this.assignments = assignments.map((a) => {
        (a as any).uiStatus = this.computeStatus(a);
        (a as any).uiType = this.computeType(a);
        (a as any).uiProgress = this.getProgress(a.startDate, a.endDate);
        return a;
      });

      // Extract unique courses, programs, and years for filters
      const coursesSet = new Set<string>();
      const programsSet = new Set<string>();
      const yearsSet = new Set<string>();
      this.assignments.forEach((a) => {
        if (a.course) coursesSet.add(a.course);
        if (a.program) programsSet.add(a.program);
        if (a.year) yearsSet.add(a.year);
      });
      this.availableCourses = Array.from(coursesSet).sort();
      this.availablePrograms = Array.from(programsSet).sort();
      this.availableYears = Array.from(yearsSet).sort();

      this.sortAssignments();

      // Fallback: if no provider is explicitly stored in localStorage, use provider of most recent assignment
      if (!localStorage.getItem("git4school_last_provider")) {
        const lastAssignment = this.assignments.find((a) => a.provider && a.id !== -1);
        if (lastAssignment && lastAssignment.provider) {
          this.lastUsedProvider = lastAssignment.provider;
        }
      }

      // Restore new assignment if we were creating one
      if (wasCreatingNew && newAssignmentObj) {
        this.assignments.unshift(newAssignmentObj);
      }
      this.cdr.detectChanges();
    });
  }

  // --- Selection Logic ---

  toggleSelection(id: number) {
    if (id === -1) return; // Cannot select temporary assignment
    if (this.selectedAssignments.has(id)) {
      this.selectedAssignments.delete(id);
    } else {
      this.selectedAssignments.add(id);
    }
    this.selectionMode = this.selectedAssignments.size > 0;
  }

  isSelected(id: number): boolean {
    return this.selectedAssignments.has(id);
  }

  isAllSelected(): boolean {
    const visibleIds = this.filteredAssignments.filter((a) => a.id !== -1).map((a) => a.id);
    if (visibleIds.length === 0) return false;
    return visibleIds.every((id) => this.selectedAssignments.has(id));
  }

  toggleSelectAll() {
    const visibleIds = this.filteredAssignments.filter((a) => a.id !== -1).map((a) => a.id);
    if (this.isAllSelected()) {
      // Deselect all visible
      visibleIds.forEach((id) => this.selectedAssignments.delete(id));
    } else {
      // Select all visible
      visibleIds.forEach((id) => this.selectedAssignments.add(id));
    }
    this.selectionMode = this.selectedAssignments.size > 0;
  }

  cancelSelection() {
    this.selectedAssignments.clear();
    this.selectionMode = false;
  }

  async deleteSelected() {
    if (this.selectedAssignments.size === 0) return;

    // Convert Set to Array to process deletion
    const idsToDelete = Array.from(this.selectedAssignments);

    // We could use a specific bulk delete if AssignmentsService had one,
    // but here we just loop and delete one by one.
    try {
      for (const id of idsToDelete) {
        await this.databaseService.deleteAssignment(id);
      }
      this.toastService.success(this.translateService.instant("SUCCESS"), `Supprimé ${idsToDelete.length} devoir(s)`);
      this.cancelSelection();
      this.loadAssignments();
    } catch (err) {
      this.toastService.error(this.translateService.instant("ERROR"), "Erreur lors de la suppression");
    }
  }

  computeStatus(assignment: Assignment): "prepared" | "ongoing" | "finished" | "default" {
    const now = moment();
    const startDate = assignment.startDate ? moment(assignment.startDate) : null;
    const endDate = assignment.endDate ? moment(assignment.endDate) : null;

    if (startDate && now.isBefore(startDate)) {
      return "prepared";
    }

    if (startDate && now.isAfter(startDate)) {
      if (!endDate || now.isBefore(endDate)) {
        return "ongoing";
      }
    }

    if (endDate && now.isAfter(endDate)) {
      return "finished";
    }

    return "default";
  }

  computeType(assignment: Assignment): "github" | "gitlab" {
    return assignment.provider || "github";
  }

  getSortLabel(field: string): string {
    switch (field) {
      case "lastModificationDate":
        return "ASSIGNMENT-CHOOSER.LAST-MODIFICATION-DATE";
      case "title":
        return "ASSIGNMENT-CHOOSER.TITLE";
      case "course":
        return "ASSIGNMENT-CHOOSER.COURSE";
      case "program":
        return "ASSIGNMENT-CHOOSER.PROGRAM";
      case "year":
        return "ASSIGNMENT-CHOOSER.YEAR";
      case "daysRemaining":
        return "ASSIGNMENT-CHOOSER.DAYS-REMAINING";
      default:
        return "ASSIGNMENT-CHOOSER.LAST-MODIFICATION-DATE";
    }
  }

  sortBy(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortField = field;
      this.sortDirection = "desc"; // Default to desc when changing field
    }
    this.sortAssignments();
    this.savePreferences();
  }

  sortAssignments() {
    this.assignments.sort((a, b) => {
      // Keep new assignment at the top always
      if (a.id === -1) return -1;
      if (b.id === -1) return 1;

      if (this.sortField === "daysRemaining") {
        const getPriority = (assignment: any) => {
          if (!assignment.startDate || !assignment.endDate) return 3; // unprogrammed
          if (this.getProgress(assignment.startDate, assignment.endDate) === 100) return 2; // finished
          return 1; // active
        };

        const priorityA = getPriority(a);
        const priorityB = getPriority(b);

        if (priorityA !== priorityB) {
          return priorityA - priorityB; // Always 1 -> 2 -> 3
        }

        let valA = priorityA === 1 ? moment(a.endDate).valueOf() : a.id;
        let valB = priorityB === 1 ? moment(b.endDate).valueOf() : b.id;

        if (valA < valB) return this.sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return this.sortDirection === "asc" ? 1 : -1;
        return 0;
      }

      let valA = a[this.sortField];
      let valB = b[this.sortField];

      // fallback to empty string if undefined
      if (valA === undefined || valA === null) valA = "";
      if (valB === undefined || valB === null) valB = "";

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) {
        return this.sortDirection === "asc" ? -1 : 1;
      }
      if (valA > valB) {
        return this.sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });
  }

  getDuration(start: string, end: string): string {
    if (!start || !end) return "";
    const startM = moment(start);
    const endM = moment(end);
    const diffDays = endM.diff(startM, "days");

    if (diffDays === 0) {
      const diffHours = endM.diff(startM, "hours");
      if (diffHours === 0) {
        const diffMinutes = endM.diff(startM, "minutes");
        return `${diffMinutes} ${this.translateService.instant("HOME.DURATION.MINUTES")}`;
      }
      return `${diffHours} ${this.translateService.instant("HOME.DURATION.HOURS")}`;
    }
    return `${diffDays} ${this.translateService.instant("HOME.DURATION.DAYS")}`;
  }

  getProgress(start: string, end: string): number {
    if (!start || !end) return 0;
    const startM = moment(start);
    const endM = moment(end);
    const now = moment();

    if (now.isBefore(startM)) return 0;
    if (now.isAfter(endM)) return 100;

    const totalDuration = endM.valueOf() - startM.valueOf();
    const passedDuration = now.valueOf() - startM.valueOf();

    if (totalDuration === 0) return 100;
    return Math.round((passedDuration / totalDuration) * 100);
  }

  getProgressBarColor(progress: number): string {
    if (progress === 100) return "#9ca3af";
    const hue = 120 - progress * 1.2;
    // Gradient from slightly lighter/warmer hue to target hue
    return `linear-gradient(90deg, hsl(${hue + 15}, 85%, 65%) 0%, hsl(${hue}, 85%, 55%) 100%)`;
  }

  getProgressBarTextColor(progress: number): string {
    if (progress === 100) return "#9ca3af";
    const hue = 120 - progress * 1.2;
    const isDarkTheme = document.body.classList.contains("dark-theme");
    const lightness = isDarkTheme ? 75 : 45; // Brighter for dark mode, darker for light mode
    return `hsl(${hue}, 85%, ${lightness}%)`;
  }

  getRemainingTime(end: string): string {
    if (!end) return "";
    const now = moment();
    const endM = moment(end);

    if (now.isAfter(endM)) return "";

    const diffDays = endM.diff(now, "days");
    if (diffDays === 0) {
      const diffHours = endM.diff(now, "hours");
      if (diffHours === 0) {
        const diffMinutes = endM.diff(now, "minutes");
        return `${diffMinutes} ${this.translateService.instant("HOME.DURATION.MINUTES")}`;
      }
      return `${diffHours} ${this.translateService.instant("HOME.DURATION.HOURS")}`;
    }
    return `${diffDays} ${this.translateService.instant("HOME.DURATION.DAYS")}`;
  }

  formatDate(dateStr: string, format: string): string {
    if (!dateStr) return "";
    moment.locale(this.translateService.currentLang || "en");
    return moment(dateStr).format(format);
  }

  onSortMouseEnter() {
    this.isSortHovered = true;
    this.sortWasClicked = false;
  }

  onSortMouseLeave() {
    this.isSortHovered = false;
    this.sortWasClicked = false;
  }

  toggleSortDirection() {
    this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    this.sortWasClicked = true;
    this.sortAssignments();
  }

  getTruncatedText(text: string, limit: number = 30): string {
    if (!text) return "";
    return text.length > limit ? text.substring(0, limit - 3) + "..." : text;
  }

  selectAssignment(assignment: any) {
    const provider = assignment.provider || "github";
    if (!this.accountsService.hasAccount(provider)) {
      const errorKey = provider === "gitlab" ? "HOME.MUST-LOGIN-ASSIGNMENT-GITLAB" : "HOME.MUST-LOGIN-ASSIGNMENT-GITHUB";
      const msg = this.translateService.instant(errorKey);
      this.toastService.warning(this.translateService.instant("WARNING"), msg);
      return;
    }
    this.dataService.assignment = assignment;
    this.dataService.groupFilter = "";
    if (this.dataService.repoToLoad) {
      this.router.navigate(["commits"]);
    }
  }

  deleteAssignment(assignment: any) {
    if (!this.isAssignmentConnected(assignment)) return;
    this.databaseService.deleteAssignment(assignment.id);
  }

  createAssignment(provider?: GitProviderType, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const targetProvider: GitProviderType = provider || (this.filterType !== "all" ? this.filterType : this.lastUsedProvider) || "github";

    if (!this.accountsService.hasAccount(targetProvider)) {
      if (this.accountsService.isEmpty()) {
        const msg = this.translateService.instant("HOME.MUST-LOGIN");
        this.toastService.warning(this.translateService.instant("WARNING"), msg);
        return;
      }
      const errorKey = targetProvider === "gitlab" ? "HOME.MUST-LOGIN-GITLAB" : "HOME.MUST-LOGIN-GITHUB";
      const msg = this.translateService.instant(errorKey);
      this.toastService.warning(this.translateService.instant("WARNING"), msg);
      return;
    }

    if (this.isCreatingNew) return; // Prevent multiple creates

    this.closeAllCreationPopovers();
    this.lastUsedProvider = targetProvider;
    try {
      localStorage.setItem("git4school_last_provider", targetProvider);
    } catch (e) {}

    let assignment = new Assignment();
    assignment.id = -1; // Temporary ID for creation
    assignment.provider = targetProvider;
    (assignment as any).uiType = targetProvider;
    (assignment as any).uiStatus = "prepared";
    this.assignments.unshift(assignment); // Add to the top
    this.isCreatingNew = true;
    this.editAssignment(assignment);
    this.cdr.markForCheck();
  }

  onNewAssignmentClick(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    if (!this.canCreateAny) {
      const msg = this.translateService.instant("HOME.MUST-LOGIN");
      this.toastService.warning(this.translateService.instant("WARNING"), msg);
      return;
    }

    /* If a specific provider filter is active, create directly with that provider */
    if (this.filterType === "github") {
      this.createAssignment("github");
      return;
    }
    if (this.filterType === "gitlab") {
      this.createAssignment("gitlab");
      return;
    }

    this.createAssignment(this.lastUsedProvider);
  }

  toggleProviderDropdown(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isProviderDropdownOpen = !this.isProviderDropdownOpen;
  }

  closeAllCreationPopovers(): void {
    this.isProviderDropdownOpen = false;
    this.cdr.markForCheck();
  }

  trackByAssignmentId(index: number, item: any): any {
    return item?.id !== undefined ? item.id : index;
  }

  editAssignment(assignment: any) {
    if (!this.isAssignmentConnected(assignment) && assignment.id !== -1) return;

    // If we were creating a new one and clicked edit on another, discard the new one
    if (this.isCreatingNew && assignment.id !== -1) {
      this.assignments = this.assignments.filter((a) => a.id !== -1);
      this.isCreatingNew = false;
    }

    this.editingAssignmentId = assignment.id;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById("assignment-card-" + assignment.id);
        if (el) {
          el.style.setProperty("scroll-margin-top", "80px");
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    });
  }

  cancelEdit() {
    if (this.isCreatingNew) {
      this.assignments = this.assignments.filter((a) => a.id !== -1);
      this.isCreatingNew = false;
    }
    this.editingAssignmentId = null;
    this.loadAssignments(); // Reload to revert any unsaved changes
  }

  onAssignmentSaved(assignment: Assignment) {
    if (assignment && assignment.provider) {
      this.lastUsedProvider = assignment.provider;
      try {
        localStorage.setItem("git4school_last_provider", assignment.provider);
      } catch (e) {}
    }
    this.isCreatingNew = false;
    this.editingAssignmentId = null;
    this.loadAssignments();
  }

  exportDB() {
    let assignmentsToExport;
    if (this.selectionMode && this.selectedAssignments.size > 0) {
      assignmentsToExport = this.assignments.filter((a) => this.selectedAssignments.has(a.id));
    } else {
      assignmentsToExport = this.filteredAssignments;
    }
    this.assignmentsService.exportAssignments(assignmentsToExport);
  }

  importDB(blob: Blob) {
    let translations = this.translateService.instant(["SUCCESS", "ERROR", "IMPORT-SUCCESS", "IMPORT-ERROR"]);
    this.assignmentsService
      .importAssignments(blob)
      .then(() => {
        this.loadAssignments();
        this.toastService.success(translations["SUCCESS"], translations["IMPORT-SUCCESS"]);
      })
      .catch((err) => {
        this.toastService.error(translations["ERROR"], translations["IMPORT-ERROR"] + " : " + err);
      });
  }

  changeListener($event): void {
    let file = $event.target.files[0];
    if (file) {
      this.importDB(file);
    }
  }
}
