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

  get filteredAssignments() {
    if (this.filterType === 'all') {
      return this.assignments;
    }
    return this.assignments.filter(a => (a as any).uiType === this.filterType);
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
          return a;
        });
        this.sortAssignments();
        this.cdr.detectChanges();
      });
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
    this.assignmentsService.exportAssignments();
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
