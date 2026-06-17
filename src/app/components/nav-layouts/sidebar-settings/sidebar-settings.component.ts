import { Component, EventEmitter, OnInit, OnDestroy, Output, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { Assignment } from '@models/Assignment.model';
import { AssignmentsService } from '@services/assignments.service';
import { ConfigurationService } from '@services/configuration.service';
import { DataService } from '@services/data.service';
import { DatabaseService } from '@services/database.service';
import { ThemeService } from '@services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar-settings',
  templateUrl: './sidebar-settings.component.html',
  styleUrls: ['./sidebar-settings.component.scss']
})
export class SidebarSettingsComponent implements OnInit, OnDestroy, OnChanges {

  @Input() isOpen: boolean = false;
  @Output() onClose = new EventEmitter<void>();

  isHovered: boolean = false;
  wasClicked: boolean = false;
  recentAssignments: Assignment[] = [];
  private dbSubscription: Subscription;

  constructor(
    public themeService: ThemeService,
    private databaseService: DatabaseService,
    private dataService: DataService,
    private router: Router,
    private configurationService: ConfigurationService,
    private assignmentsService: AssignmentsService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadRecentAssignments();
    this.dbSubscription = this.databaseService.dbChanged.subscribe(() => {
      this.loadRecentAssignments();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue === true) {
      this.loadRecentAssignments();
    }
  }

  ngOnDestroy(): void {
    if (this.dbSubscription) {
      this.dbSubscription.unsubscribe();
    }
  }

  async loadRecentAssignments() {
    let all = await this.databaseService.getAllAssignments();
    // Sort by lastModificationDate descending (most recently modified or opened)
    all.sort((a, b) => {
      const dateA = a.lastModificationDate ? new Date(a.lastModificationDate).getTime() : 0;
      const dateB = b.lastModificationDate ? new Date(b.lastModificationDate).getTime() : 0;
      return dateB - dateA;
    });
    this.recentAssignments = all.slice(0, 5);
    this.cdr.detectChanges();
  }

  getTruncatedText(text: string, limit: number = 30): string {
    if (!text) return '';
    return text.length > limit ? text.substring(0, limit - 3) + '...' : text;
  }

  openAssignment(assignment: Assignment) {
    this.databaseService.getAssignmentById(assignment.id).then((fullAssignment) => {
      this.dataService.assignment = fullAssignment;
      this.dataService.groupFilter = "";
      this.onClose.emit();
      this.assignmentsService.assignmentModified.next();
      this.router.navigate(["/overview"]);
    });
  }

  editAssignment(assignment: Assignment) {
    this.databaseService.getAssignmentById(assignment.id).then((fullAssignment) => {
      this.configurationService
        .openConfigurationModal(fullAssignment)
        .finally(() => {
          this.loadRecentAssignments();
          if (this.dataService.assignment && this.dataService.assignment.id === fullAssignment.id) {
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

}
