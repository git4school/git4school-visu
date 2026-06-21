import { Component, OnInit, TemplateRef, ViewChild, ChangeDetectorRef, OnDestroy } from "@angular/core";
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

  sortField: string = "lastModificationDate";
  sortDirection: "asc" | "desc" = "desc";

  filterType: 'all' | 'github' | 'gitlab' = 'all';

  searchQuery: string = '';
  
  advancedFilters = {
    status: {
      prepared: true,
      ongoing: true,
      finished: true,
      default: true
    },
    course: '',
    program: '',
    year: ''
  };

  availableCourses: string[] = [];
  availablePrograms: string[] = [];
  availableYears: string[] = [];

  // Selection state
  selectionMode: boolean = false;
  selectedAssignments: Set<string> = new Set();
  hoveredAssignment: string | null = null;

  get filteredAssignments() {
    let result = this.assignments;

    // Apply old filterType
    if (this.filterType !== 'all') {
      result = result.filter(a => (a as any).uiType === this.filterType);
    }

    // Apply search query
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(a => 
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.course && a.course.toLowerCase().includes(q)) ||
        (a.program && a.program.toLowerCase().includes(q)) ||
        (a.year && a.year.toLowerCase().includes(q))
      );
    }

    // Apply advanced status filters
    const statusFilters = this.advancedFilters.status;
    const isAnyStatusFilterActive = statusFilters.prepared || statusFilters.ongoing || statusFilters.finished || statusFilters.default;
    
    if (isAnyStatusFilterActive) {
      result = result.filter(a => {
        const status = (a as any).uiStatus;
        if (status === 'prepared' && statusFilters.prepared) return true;
        if (status === 'ongoing' && statusFilters.ongoing) return true;
        if (status === 'finished' && statusFilters.finished) return true;
        if (status === 'default' && statusFilters.default) return true;
        return false;
      });
    }

    // Apply course filter
    if (this.advancedFilters.course) {
      result = result.filter(a => a.course === this.advancedFilters.course);
    }

    // Apply program filter
    if (this.advancedFilters.program) {
      result = result.filter(a => a.program === this.advancedFilters.program);
    }

    // Apply year filter
    if (this.advancedFilters.year) {
      result = result.filter(a => a.year === this.advancedFilters.year);
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
      course: '',
      program: '',
      year: ''
    };
    this.searchQuery = '';
  }

  setFilter(type: 'all' | 'github' | 'gitlab') {
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
    this.loadAssignments();
    this.dbSubscription = this.databaseService.dbChanged.subscribe(() => {
      this.loadAssignments();
    });
  }

  ngOnDestroy(): void {
    if (this.dbSubscription) {
      this.dbSubscription.unsubscribe();
    }
  }

  async loadAssignments() {
    await this.databaseService
      .getAllAssignments()
      .then((assignments) => {
        // Map assignments to add UI-specific computed properties directly to the Assignment objects
        this.assignments = assignments.map(a => {
          (a as any).uiStatus = this.computeStatus(a);
          (a as any).uiType = this.computeType(a);
          (a as any).uiProgress = this.getProgress(a.startDate, a.endDate);
          return a;
        });

        // Extract unique courses, programs, and years for filters
        const coursesSet = new Set<string>();
        const programsSet = new Set<string>();
        const yearsSet = new Set<string>();
        this.assignments.forEach(a => {
          if (a.course) coursesSet.add(a.course);
          if (a.program) programsSet.add(a.program);
          if (a.year) yearsSet.add(a.year);
        });
        this.availableCourses = Array.from(coursesSet).sort();
        this.availablePrograms = Array.from(programsSet).sort();
        this.availableYears = Array.from(yearsSet).sort();

        this.sortAssignments();
        this.cdr.detectChanges();
      });
  }

  // --- Selection Logic ---

  toggleSelection(id: string) {
    if (this.selectedAssignments.has(id)) {
      this.selectedAssignments.delete(id);
    } else {
      this.selectedAssignments.add(id);
    }
    this.selectionMode = this.selectedAssignments.size > 0;
  }

  isSelected(id: string): boolean {
    return this.selectedAssignments.has(id);
  }

  isAllSelected(): boolean {
    const visibleIds = this.filteredAssignments.map(a => a.id);
    if (visibleIds.length === 0) return false;
    return visibleIds.every(id => this.selectedAssignments.has(id));
  }

  toggleSelectAll() {
    const visibleIds = this.filteredAssignments.map(a => a.id);
    if (this.isAllSelected()) {
      // Deselect all visible
      visibleIds.forEach(id => this.selectedAssignments.delete(id));
    } else {
      // Select all visible
      visibleIds.forEach(id => this.selectedAssignments.add(id));
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

  computeStatus(assignment: Assignment): 'prepared' | 'ongoing' | 'finished' | 'default' {
    const now = moment();
    const startDate = assignment.startDate ? moment(assignment.startDate) : null;
    const endDate = assignment.endDate ? moment(assignment.endDate) : null;

    if (startDate && now.isBefore(startDate)) {
      return 'prepared';
    }
    
    if (startDate && now.isAfter(startDate)) {
      if (!endDate || now.isBefore(endDate)) {
        return 'ongoing';
      }
    }

    if (endDate && now.isAfter(endDate)) {
      return 'finished';
    }

    return 'default';
  }

  computeType(assignment: Assignment): 'github' | 'gitlab' {
    // Mock logic: Assign gitlab if title contains 'gitlab', else github
    if (assignment.title && assignment.title.toLowerCase().includes('gitlab')) {
      return 'gitlab';
    }
    return 'github';
  }

  getSortLabel(field: string): string {
    switch (field) {
      case 'lastModificationDate': return 'ASSIGNMENT-CHOOSER.LAST-MODIFICATION-DATE';
      case 'title': return 'ASSIGNMENT-CHOOSER.TITLE';
      case 'course': return 'ASSIGNMENT-CHOOSER.COURSE';
      case 'program': return 'ASSIGNMENT-CHOOSER.PROGRAM';
      case 'year': return 'ASSIGNMENT-CHOOSER.YEAR';
      default: return 'ASSIGNMENT-CHOOSER.LAST-MODIFICATION-DATE';
    }
  }

  sortBy(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'desc'; // Default to desc when changing field
    }
    this.sortAssignments();
  }

  sortAssignments() {
    this.assignments.sort((a, b) => {
      let valA = a[this.sortField];
      let valB = b[this.sortField];

      // fallback to empty string if undefined
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valA > valB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  getDuration(start: string, end: string): string {
    if (!start || !end) return '';
    const startM = moment(start);
    const endM = moment(end);
    const diffDays = endM.diff(startM, 'days');
    
    if (diffDays === 0) {
      const diffHours = endM.diff(startM, 'hours');
      if (diffHours === 0) {
        const diffMinutes = endM.diff(startM, 'minutes');
        return `${diffMinutes} ${this.translateService.instant('HOME.DURATION.MINUTES')}`;
      }
      return `${diffHours} ${this.translateService.instant('HOME.DURATION.HOURS')}`;
    }
    return `${diffDays} ${this.translateService.instant('HOME.DURATION.DAYS')}`;
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
    if (progress === 100) return '#9ca3af';
    const hue = 120 - (progress * 1.2);
    // Gradient from slightly lighter/warmer hue to target hue
    return `linear-gradient(90deg, hsl(${hue + 15}, 85%, 65%) 0%, hsl(${hue}, 85%, 55%) 100%)`;
  }

  getProgressBarTextColor(progress: number): string {
    if (progress === 100) return '#9ca3af';
    const hue = 120 - (progress * 1.2);
    const isDarkTheme = document.body.classList.contains('dark-theme');
    const lightness = isDarkTheme ? 75 : 45; // Brighter for dark mode, darker for light mode
    return `hsl(${hue}, 85%, ${lightness}%)`;
  }

  getRemainingTime(end: string): string {
    if (!end) return '';
    const now = moment();
    const endM = moment(end);
    
    if (now.isAfter(endM)) return '';
    
    const diffDays = endM.diff(now, 'days');
    if (diffDays === 0) {
      const diffHours = endM.diff(now, 'hours');
      if (diffHours === 0) {
        const diffMinutes = endM.diff(now, 'minutes');
        return `${diffMinutes} ${this.translateService.instant('HOME.DURATION.MINUTES')}`;
      }
      return `${diffHours} ${this.translateService.instant('HOME.DURATION.HOURS')}`;
    }
    return `${diffDays} ${this.translateService.instant('HOME.DURATION.DAYS')}`;
  }

  formatDate(dateStr: string, format: string): string {
    if (!dateStr) return '';
    moment.locale(this.translateService.currentLang || 'en');
    return moment(dateStr).format(format);
  }

  isSortHovered: boolean = false;
  sortWasClicked: boolean = false;

  onSortMouseEnter() {
    this.isSortHovered = true;
    this.sortWasClicked = false;
  }

  onSortMouseLeave() {
    this.isSortHovered = false;
    this.sortWasClicked = false;
  }

  toggleSortDirection() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.sortWasClicked = true;
    this.sortAssignments();
  }

  getTruncatedText(text: string, limit: number = 30): string {
    if (!text) return '';
    return text.length > limit ? text.substring(0, limit - 3) + '...' : text;
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
    let assignment = new Assignment();
    this.openConfigurationModal(assignment);
  }

  openConfigurationModal(assignment: any) {
    if (!this.authService.isSignedIn()) return;
    this.configurationService.openConfigurationModal(assignment).finally(() => {
      this.loadAssignments();
      if (assignment.id && assignment.id === this.dataService.assignment?.id) {
        this.databaseService
          .getAssignmentById(assignment.id)
          .then((assignment) => (this.dataService.assignment = assignment));
      }
    });
  }

  exportDB() {
    let assignmentsToExport;
    if (this.selectionMode && this.selectedAssignments.size > 0) {
      assignmentsToExport = this.assignments.filter(a => this.selectedAssignments.has(a.id));
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
