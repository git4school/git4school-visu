import {
  Component,
  OnInit,
  TemplateRef,
  ViewChild,
  ChangeDetectorRef,
  OnDestroy
} from "@angular/core";
import { Router } from "@angular/router";
import { Assignment } from "@models/Assignment.model";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { AuthService } from "@services/auth.service";
import { ConfigurationService } from "@services/configuration.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
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
  private dbSubscription: Subscription;

  sortField = "lastModificationDate";
  sortDirection: "asc" | "desc" = "desc";

  filterType: "all" | "github" | "gitlab" = "all";

  searchQuery = "";

  advancedFilters = {
    status: {
      prepared: true,
      ongoing: true,
      finished: true,
      default: true
    },
    course: "",
    program: "",
    year: ""
  };

  availableCourses: string[] = [];
  availablePrograms: string[] = [];
  availableYears: string[] = [];

  // Selection state
  selectionMode = false;
  selectedAssignments: Set<number> = new Set();
  hoveredAssignment: number | null = null;

  // Inline edit state
  editingAssignmentId: number | null = null;
  isCreatingNew = false;

  get filteredAssignments() {
    let result = this.assignments;

    // Always show the assignment currently being created at the top, even if it doesn't match filters
    const newAssignment = this.assignments.find((a) => a.id === -1);

    // Apply old filterType
    if (this.filterType !== "all") {
      result = result.filter(
        (a) => (a as any).uiType === this.filterType || a.id === -1
      );
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
          (a.year && a.year.toLowerCase().includes(q))
      );
    }

    // Apply advanced status filters
    const statusFilters = this.advancedFilters.status;
    const isAnyStatusFilterActive =
      statusFilters.prepared ||
      statusFilters.ongoing ||
      statusFilters.finished ||
      statusFilters.default;

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
      result = result.filter(
        (a) => a.id === -1 || a.course === this.advancedFilters.course
      );
    }

    // Apply program filter
    if (this.advancedFilters.program) {
      result = result.filter(
        (a) => a.id === -1 || a.program === this.advancedFilters.program
      );
    }

    // Apply year filter
    if (this.advancedFilters.year) {
      result = result.filter(
        (a) => a.id === -1 || a.year === this.advancedFilters.year
      );
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
      year: ""
    };
    this.searchQuery = "";
    this.savePreferences();
  }

  setFilter(type: "all" | "github" | "gitlab") {
    this.filterType = type;
  }

  constructor(
    private databaseService: DatabaseService,
    private dataService: DataService,
    private router: Router,
    public authService: AuthService,
    private translateService: TranslateService,
    private toastService: ToastService,
    private assignmentsService: AssignmentsService,
    private configurationService: ConfigurationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.assignments = [];
    this.loadPreferences();
    this.loadAssignments();
    this.dbSubscription = this.databaseService.dbChanged.subscribe(() => {
      this.loadAssignments();
    });
  }

  loadPreferences() {
    const prefs = localStorage.getItem("assignment-chooser-prefs");
    if (prefs) {
      try {
        const parsed = JSON.parse(prefs);
        if (parsed.sortField) this.sortField = parsed.sortField;
        if (parsed.sortDirection) this.sortDirection = parsed.sortDirection;
        if (parsed.advancedFilters)
          this.advancedFilters = parsed.advancedFilters;
      } catch (e) {
        console.error("Could not load preferences", e);
      }
    }
  }

  savePreferences() {
    localStorage.setItem(
      "assignment-chooser-prefs",
      JSON.stringify({
        sortField: this.sortField,
        sortDirection: this.sortDirection,
        advancedFilters: this.advancedFilters
      })
    );
  }

  ngOnDestroy(): void {
    if (this.dbSubscription) {
      this.dbSubscription.unsubscribe();
    }
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
    const visibleIds = this.filteredAssignments
      .filter((a) => a.id !== -1)
      .map((a) => a.id);
    if (visibleIds.length === 0) return false;
    return visibleIds.every((id) => this.selectedAssignments.has(id));
  }

  toggleSelectAll() {
    const visibleIds = this.filteredAssignments
      .filter((a) => a.id !== -1)
      .map((a) => a.id);
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
      this.toastService.success(
        this.translateService.instant("SUCCESS"),
        `Supprimé ${idsToDelete.length} devoir(s)`
      );
      this.cancelSelection();
      this.loadAssignments();
    } catch (err) {
      this.toastService.error(
        this.translateService.instant("ERROR"),
        "Erreur lors de la suppression"
      );
    }
  }

  computeStatus(
    assignment: Assignment
  ): "prepared" | "ongoing" | "finished" | "default" {
    const now = moment();
    const startDate = assignment.startDate
      ? moment(assignment.startDate)
      : null;
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
    // Mock logic: Assign gitlab if title contains 'gitlab', else github
    if (assignment.title && assignment.title.toLowerCase().includes("gitlab")) {
      return "gitlab";
    }
    return "github";
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
        return `${diffMinutes} ${this.translateService.instant(
          "HOME.DURATION.MINUTES"
        )}`;
      }
      return `${diffHours} ${this.translateService.instant(
        "HOME.DURATION.HOURS"
      )}`;
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
    return `linear-gradient(90deg, hsl(${
      hue + 15
    }, 85%, 65%) 0%, hsl(${hue}, 85%, 55%) 100%)`;
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
        return `${diffMinutes} ${this.translateService.instant(
          "HOME.DURATION.MINUTES"
        )}`;
      }
      return `${diffHours} ${this.translateService.instant(
        "HOME.DURATION.HOURS"
      )}`;
    }
    return `${diffDays} ${this.translateService.instant("HOME.DURATION.DAYS")}`;
  }

  formatDate(dateStr: string, format: string): string {
    if (!dateStr) return "";
    moment.locale(this.translateService.currentLang || "en");
    return moment(dateStr).format(format);
  }

  isSortHovered = false;
  sortWasClicked = false;

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
    if (!this.authService.isSignedIn()) return;
    this.dataService.assignment = assignment;
    this.dataService.groupFilter = "";
    if (this.dataService.repoToLoad) {
      this.router.navigate(["overview"]);
    }
  }

  deleteAssignment(assignment: any) {
    if (!this.authService.isSignedIn()) return;
    this.databaseService.deleteAssignment(assignment.id);
  }

  createAssignment() {
    if (!this.authService.isSignedIn()) return;
    if (this.isCreatingNew) return; // Prevent multiple creates

    let assignment = new Assignment();
    assignment.id = -1; // Temporary ID for creation
    this.assignments.unshift(assignment); // Add to the top
    this.isCreatingNew = true;
    this.editAssignment(assignment);
  }

  editAssignment(assignment: any) {
    if (!this.authService.isSignedIn()) return;

    // If we were creating a new one and clicked edit on another, discard the new one
    if (this.isCreatingNew && assignment.id !== -1) {
      this.assignments = this.assignments.filter((a) => a.id !== -1);
      this.isCreatingNew = false;
    }

    this.editingAssignmentId = assignment.id;

    setTimeout(() => {
      const el = document.getElementById('assignment-card-' + assignment.id);
      if (el) {
        el.style.setProperty('scroll-margin-top', '80px');
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
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
    this.isCreatingNew = false;
    this.editingAssignmentId = null;
    this.loadAssignments();
  }

  exportDB() {
    let assignmentsToExport;
    if (this.selectionMode && this.selectedAssignments.size > 0) {
      assignmentsToExport = this.assignments.filter((a) =>
        this.selectedAssignments.has(a.id)
      );
    } else {
      assignmentsToExport = this.filteredAssignments;
    }
    this.assignmentsService.exportAssignments(assignmentsToExport);
  }

  importDB(blob: Blob) {
    let translations = this.translateService.instant([
      "SUCCESS",
      "ERROR",
      "IMPORT-SUCCESS",
      "IMPORT-ERROR",
    ]);
    this.assignmentsService
      .importAssignments(blob)
      .then(() => {
        this.loadAssignments();
        this.toastService.success(
          translations["SUCCESS"],
          translations["IMPORT-SUCCESS"]
        );
      })
      .catch((err) => {
        this.toastService.error(
          translations["ERROR"],
          translations["IMPORT-ERROR"] + " : " + err
        );
      });
  }

  changeListener($event): void {
    let file = $event.target.files[0];
    if (file) {
      this.importDB(file);
    }
  }
}
