import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ViewChildren,
  QueryList,
  ChangeDetectorRef,
  OnDestroy,
  HostListener,
  ElementRef,
} from "@angular/core";
import { Router } from "@angular/router";
import { Assignment } from "@models/Assignment.model";
import { GitProviderType } from "@models/GitAuthProvider.model";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { buildDuplicateAssignment } from "@services/assignment-duplicate.util";
import {
  AssignmentDropdownField,
  buildProviderFilterPills,
  countActiveFilters,
  filterAssignments,
  isArchivedAssignment,
  ProviderFilterPill,
} from "@services/assignment-filters.util";
import {
  computePillIndicatorGeometry,
  readChooserPreferences,
  readLastProviderContext,
  sortAssignments,
  writeChooserPreferences,
} from "./assignment-chooser.util";
import { AccountsService } from "@services/accounts.service";
import { GithubAuthService } from "@services/github-auth.service";
import { ConfigurationService } from "@services/configuration.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { OverlayManagerService } from "@services/overlay-manager.service";
import { ToastService } from "@services/toast.service";
import { ClockService } from "@services/clock.service";
import { Utils } from "@services/utils";
import { Subscription } from "rxjs";
import moment from "moment";

@Component({
  selector: "assignment-chooser",
  templateUrl: "./assignment-chooser.component.html",
  styleUrls: ["./assignment-chooser.component.scss"],
  standalone: false,
})
export class AssignmentChooserComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("searchInput") searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChildren("pillBtn") pillButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  indicatorLeft = 0;
  indicatorWidth = 100;

  assignments: any[]; // Using any to attach UI-specific properties temporarily

  sortField = "lastModificationDate";
  sortDirection: "asc" | "desc" = "desc";

  viewMode: "list" | "folders" = "list";

  filterType = "all";

  searchQuery = "";
  searchFocused = false;

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
  lastUsedHost = "github.com";
  lastUsedInstanceName = "";

  // Inline edit state
  editingAssignment: Assignment | null = null;
  isCreatingNew = false;

  /**
   * Champ que l'éditeur inline doit focaliser à son ouverture : l'année quand la carte
   * provient d'une duplication (seul champ qu'elle ne recopie pas), le titre sinon.
   */
  inlineFocusField: "title" | "year" = "title";

  // Assignment card whose liquid actions menu is open (raises the card z-index)
  openActionsAssignmentId: number | null = null;

  private dbSubscription?: Subscription;
  private overlaySub: Subscription | null = null;
  private accountsSub?: Subscription;
  private pillButtonsSub?: Subscription;
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
    private clockService: ClockService,
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

  @HostListener("window:resize")
  onWindowResize(): void {
    this.updateIndicator();
  }

  get isSearchExpanded(): boolean {
    return this.searchFocused || Boolean(this.searchQuery && this.searchQuery.trim().length > 0);
  }

  get providerFilterPills(): ProviderFilterPill[] {
    return buildProviderFilterPills({
      assignments: this.assignments,
      isGithubConnected: this.accountsService.isGithubConnected,
      isGitlabConnected: this.accountsService.isGitlabConnected,
      customAccounts: this.connectedCustomGitlabAccounts,
      hasAccountForHost: (provider, host) => this.accountsService.hasAccountForHost(provider, host),
    });
  }

  get selectedFilterPill(): ProviderFilterPill | undefined {
    return this.providerFilterPills.find((p) => p.key === this.filterType);
  }

  get isCustomLastUsed(): boolean {
    return this.lastUsedProvider === "gitlab" && Boolean(this.lastUsedHost && this.lastUsedHost !== "gitlab.com");
  }

  get canCreateLastUsed(): boolean {
    return this.accountsService.hasAccountForHost(this.lastUsedProvider, this.lastUsedHost);
  }

  get createButtonLabel(): string {
    if (this.lastUsedProvider === "github") {
      return this.translateService.instant("HOME.CREATE-ASSIGNMENT-GITHUB");
    }
    if (this.lastUsedProvider === "gitlab") {
      if (this.isCustomLastUsed) {
        return this.translateService.instant("HOME.CREATE-ASSIGNMENT-GITLAB-CUSTOM", {
          host: this.lastUsedInstanceName || this.lastUsedHost,
        });
      }
      return this.translateService.instant("HOME.CREATE-ASSIGNMENT-GITLAB");
    }
    return this.translateService.instant("HOME.CREATE-ASSIGNMENT");
  }

  get createButtonTooltip(): string {
    if (!this.canCreateLastUsed) {
      if (this.lastUsedProvider === "gitlab") {
        if (this.isCustomLastUsed) {
          return this.translateService.instant("HOME.MUST-LOGIN-ASSIGNMENT-GITLAB-CUSTOM", {
            host: this.lastUsedInstanceName || this.lastUsedHost,
          });
        }
        return this.translateService.instant("HOME.MUST-LOGIN-GITLAB");
      }
      return this.translateService.instant("HOME.MUST-LOGIN-GITHUB");
    }
    return "";
  }

  get connectedCustomGitlabAccounts(): any[] {
    return this.accountsService.gitlabCustomAuthService?.getAccounts() || [];
  }

  get filteredAssignments() {
    return filterAssignments(this.assignments, {
      filterType: this.filterType,
      searchQuery: this.searchQuery,
      advancedFilters: this.advancedFilters,
    });
  }

  /** Devoirs de la vue dossiers : les brouillons de création (id -1) n'existent qu'en liste. */
  get folderAssignments(): any[] {
    return this.filteredAssignments.filter((a) => a.id !== -1);
  }

  /** Bascule liste ↔ dossiers ; ferme d'abord l'édition inline en cours (sauvegarde garantie). */
  setView(mode: "list" | "folders") {
    if (this.viewMode === mode) {
      return;
    }
    if (this.editingAssignment || this.isCreatingNew) {
      this.closeEdit();
    }
    this.viewMode = mode;
    this.savePreferences();
    this.cdr.markForCheck();
  }

  /** Devoir archivé : visible uniquement dans l'onglet « Archivés ». */
  isArchived(assignment: any): boolean {
    return isArchivedAssignment(assignment);
  }

  /** Valeur d'un filtre avancé (cours / programme / année) sélectionnée dans un dropdown. */
  setAdvancedFilter(field: AssignmentDropdownField, value: string): void {
    this.advancedFilters[field] = value;
    this.savePreferences();
  }

  /** Message d'état vide, contextualisé pour l'onglet « Archivés ». */
  get emptyStateMessageKey(): string {
    return this.filterType === "archived" ? "HOME.NO-ARCHIVED-ASSIGNMENTS" : "HOME.NO-ASSIGNMENTS";
  }

  getActiveFiltersCount(): number {
    return countActiveFilters(this.advancedFilters);
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

  onSearchContainerClick(event: MouseEvent): void {
    if (!this.isSearchExpanded) {
      event.preventDefault();
      this.searchFocused = true;
      this.cdr.markForCheck();
      requestAnimationFrame(() => {
        this.searchInputRef?.nativeElement?.focus();
      });
    } else if (document.activeElement !== this.searchInputRef?.nativeElement) {
      this.searchInputRef?.nativeElement?.focus();
    }
  }

  onSearchContainerEnter(event: Event): void {
    if (!this.isSearchExpanded) {
      event.preventDefault();
      this.searchFocused = true;
      this.cdr.markForCheck();
      requestAnimationFrame(() => {
        this.searchInputRef?.nativeElement?.focus();
      });
    }
  }

  onSearchFocus(): void {
    this.searchFocused = true;
  }

  onSearchBlur(): void {
    this.searchFocused = false;
  }

  onSearchEscape(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.searchQuery = "";
    this.searchFocused = false;
    this.searchInputRef?.nativeElement?.blur();
  }

  clearSearch(focusAfter = true): void {
    this.searchQuery = "";
    if (focusAfter) {
      this.searchInputRef?.nativeElement?.focus();
    } else {
      this.searchFocused = false;
      this.searchInputRef?.nativeElement?.blur();
    }
  }

  setFilter(type: string): void {
    this.filterType = type;
    this.updateIndicator();
    this.cdr.markForCheck();
  }

  updateIndicator(): void {
    if (!this.pillButtons || this.pillButtons.length === 0) {
      return;
    }
    const pills = this.providerFilterPills;
    let activeIndex = pills.findIndex((p) => p.key === this.filterType);
    if (activeIndex === -1) {
      activeIndex = 0;
    }
    const targetBtn = this.pillButtons.toArray()[activeIndex];
    if (targetBtn && targetBtn.nativeElement) {
      const geometry = computePillIndicatorGeometry(targetBtn.nativeElement, targetBtn.nativeElement.parentElement);
      this.indicatorLeft = geometry.left;
      this.indicatorWidth = geometry.width;
      this.cdr.markForCheck();
    }
  }

  isAssignmentConnected(assignment: any): boolean {
    return this.assignmentsService.isAssignmentConnected(assignment);
  }

  isCustomGitlab(assignment: any): boolean {
    return this.assignmentsService.isCustomGitlab(assignment);
  }

  getAssignmentTooltip(assignment: any): string {
    return this.assignmentsService.getAssignmentTooltip(assignment);
  }

  getAssignmentEditTooltip(assignment: any): string {
    return this.assignmentsService.getAssignmentEditTooltip(assignment);
  }

  getAssignmentDeleteTooltip(assignment: any): string {
    return this.assignmentsService.getAssignmentDeleteTooltip(assignment);
  }

  getDisconnectedTooltip(assignment: any): string {
    return this.assignmentsService.getDisconnectedTooltip(assignment);
  }

  getArchiveToggleTooltip(assignment: any): string {
    return this.assignmentsService.getArchiveToggleTooltip(assignment);
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
      // While an inline editor is open, the assignment object is mutated live; reloading would
      // replace it with a fresh reference and close the editor. closeEdit() reloads on exit.
      if (!this.editingAssignment) {
        this.loadAssignments();
      }
    });

    this.overlaySub = this.overlayManager.dismiss$.subscribe(() => {
      this.closeAllCreationPopovers();
    });

    this.accountsSub = this.accountsService.accounts$.subscribe(() => {
      this.cdr.markForCheck();
      requestAnimationFrame(() => {
        this.updateIndicator();
      });
    });
  }

  ngAfterViewInit(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.updateIndicator();
      });
    });

    if (this.pillButtons) {
      this.pillButtonsSub = this.pillButtons.changes.subscribe(() => {
        requestAnimationFrame(() => {
          this.updateIndicator();
        });
      });
    }
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
    if (this.pillButtonsSub) {
      this.pillButtonsSub.unsubscribe();
    }
    if (this.statusPreviewTimeout) {
      clearTimeout(this.statusPreviewTimeout);
    }
  }

  loadPreferences() {
    const prefs = readChooserPreferences();
    if (prefs) {
      if (prefs.sortField) this.sortField = prefs.sortField;
      if (prefs.sortDirection) this.sortDirection = prefs.sortDirection;
      if (prefs.advancedFilters) this.advancedFilters = prefs.advancedFilters;
      if (prefs.viewMode === "list" || prefs.viewMode === "folders") this.viewMode = prefs.viewMode;
    }

    const last = readLastProviderContext();
    if (last.provider === "github" || last.provider === "gitlab") {
      this.lastUsedProvider = last.provider as GitProviderType;
    }
    if (last.host) {
      this.lastUsedHost = last.host;
    }
    if (last.instanceName) {
      this.lastUsedInstanceName = last.instanceName;
    }
  }

  savePreferences() {
    writeChooserPreferences({
      sortField: this.sortField,
      sortDirection: this.sortDirection,
      advancedFilters: this.advancedFilters,
      viewMode: this.viewMode,
    });
  }

  async loadAssignments() {
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
        const lastAssignment = this.assignments.find((a) => a.provider && a.id !== -1 && !a.archivedAt);
        if (lastAssignment && lastAssignment.provider) {
          this.lastUsedProvider = lastAssignment.provider;
          this.lastUsedHost = lastAssignment.instanceHost || (lastAssignment.provider === "gitlab" ? "gitlab.com" : "github.com");
          this.lastUsedInstanceName = lastAssignment.instanceName || "";
        }
      }

      // Restore new assignment if we were creating one
      if (this.isCreatingNew && this.editingAssignment && this.editingAssignment.id === -1) {
        this.assignments.unshift(this.editingAssignment);
      }
      this.cdr.detectChanges();
      requestAnimationFrame(() => {
        this.updateIndicator();
      });
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
    const now = this.clockService.moment();
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
    sortAssignments(this.assignments, this.sortField, this.sortDirection, (start, end) => this.getProgress(start, end));
  }

  getDuration(start: string, end: string): string {
    return Utils.getDuration(start, end, (key) => this.translateService.instant(key));
  }

  getProgress(start: string, end: string): number {
    if (!start || !end) return 0;
    const startM = moment(start);
    const endM = moment(end);
    const now = this.clockService.moment();

    if (now.isBefore(startM)) return 0;
    if (now.isAfter(endM)) return 100;

    const totalDuration = endM.valueOf() - startM.valueOf();
    const passedDuration = now.valueOf() - startM.valueOf();

    if (totalDuration === 0) return 100;
    return Math.round((passedDuration / totalDuration) * 100);
  }

  getProgressBarColor(progress: number): string {
    return Utils.getProgressBarColor(progress);
  }

  getProgressBarTextColor(progress: number): string {
    return Utils.getProgressBarTextColor(progress);
  }

  getRemainingTime(end: string): string {
    return Utils.getRemainingTime(end, this.clockService.moment(), (key) => this.translateService.instant(key));
  }

  formatDate(dateStr: string, format: string): string {
    return Utils.formatDate(dateStr, format, this.translateService.currentLang);
  }

  toggleSortDirection() {
    this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    this.sortAssignments();
  }

  getTruncatedText(text: string, limit: number = 30): string {
    if (!text) return "";
    return text.length > limit ? text.substring(0, limit - 3) + "..." : text;
  }

  selectAssignment(assignment: any) {
    const provider = assignment.provider || "github";
    const host = assignment.instanceHost || (assignment.resolvedInstanceHost ? assignment.resolvedInstanceHost : undefined);
    if (!this.accountsService.hasAccountForHost(provider, host)) {
      const msg = this.getDisconnectedTooltip(assignment);
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
    if (!this.isAssignmentConnected(assignment)) {
      const msg = this.getDisconnectedTooltip(assignment);
      this.toastService.warning(this.translateService.instant("WARNING"), msg);
      return;
    }
    this.databaseService.deleteAssignment(assignment.id);
  }

  /**
   * Duplique un devoir : même forge, titre suffixé « (n) », cours, programme, questions,
   * options de clôture et durée de séance par défaut (voir `buildDuplicateAssignment`).
   * La copie est persistée puis ouverte en édition, le focus placé sur l'année : le seul
   * champ métier à renseigner, l'année n'étant jamais dupliquée.
   */
  async duplicateAssignment(assignment: any) {
    if (!assignment || assignment.id === -1) {
      return;
    }
    const existingTitles = this.assignments.filter((a) => a.id !== -1).map((a) => a.title);
    const copy = buildDuplicateAssignment(assignment, existingTitles);
    copy.lastModificationDate = this.clockService.now();
    (copy as any).uiStatus = this.computeStatus(copy);
    (copy as any).uiType = this.computeType(copy);
    (copy as any).uiProgress = this.getProgress(copy.startDate, copy.endDate);

    // La copie est affichée tout de suite en liste : elle doit résister au rechargement
    // déclenché par sa propre écriture (même garde que l'édition en cours).
    if (this.viewMode === "list") {
      this.inlineFocusField = "year";
      this.editingAssignment = copy;
    }
    try {
      copy.id = await this.databaseService.saveAssignment(copy);
    } catch (err) {
      if (this.viewMode === "list") {
        this.editingAssignment = null;
      }
      this.toastService.error(this.translateService.instant("ERROR"), this.translateService.instant("HOME.DUPLICATE-TOAST-FAILED"));
      return;
    }
    this.rememberLastUsedProvider(copy);
    this.toastService.success(this.translateService.instant("SUCCESS"), this.translateService.instant("HOME.DUPLICATE-TOAST"));

    // Vue dossiers : pas d'éditeur inline, la suite passe par la modale (comme la création).
    if (this.viewMode === "folders") {
      this.isCreatingNew = true;
      this.configurationService.openConfigurationModal(copy, { initialFocusField: "year" }).finally(() => {
        this.isCreatingNew = false;
        this.loadAssignments();
      });
      return;
    }

    this.assignments.unshift(copy);
    this.scrollEditingCardIntoView(copy);
    this.cdr.markForCheck();
  }

  /**
   * Archive un devoir, ou le restaure : un devoir archivé n'est visible que dans l'onglet
   * « Archivés » et son action redevient « Restaurer ». La date d'archivage n'est posée que
   * par cette action et n'est jamais retouchée par l'édition de la configuration.
   */
  async toggleArchive(assignment: any) {
    if (!assignment || assignment.id === -1) {
      return;
    }
    try {
      const stored = await this.databaseService.getAssignmentById(assignment.id);
      if (!stored) {
        return;
      }
      const restoring = Boolean(stored.archivedAt);
      stored.archivedAt = restoring ? undefined : this.clockService.now();
      stored.lastModificationDate = this.clockService.now();
      await this.databaseService.saveAssignment(stored);
      this.toastService.success(
        this.translateService.instant("SUCCESS"),
        this.translateService.instant(restoring ? "HOME.RESTORE-TOAST" : "HOME.ARCHIVE-TOAST"),
      );
    } catch (err) {
      this.toastService.error(this.translateService.instant("ERROR"), this.translateService.instant("HOME.ARCHIVE-TOAST-FAILED"));
    }
  }

  /** Suit l'ouverture du menu d'actions liquides pour relever la carte concernée. */
  onActionsMenuOpenChange(assignmentId: number, isOpen: boolean) {
    this.openActionsAssignmentId = isOpen ? assignmentId : null;
  }

  createAssignment(provider?: GitProviderType, instanceHost?: string, instanceName?: string, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const targetProvider: GitProviderType = provider || (this.filterType === "github" ? "github" : this.lastUsedProvider) || "github";
    const targetHost = instanceHost || (targetProvider === "gitlab" ? this.lastUsedHost || "gitlab.com" : "github.com");

    if (!this.accountsService.hasAccountForHost(targetProvider, targetHost)) {
      if (this.accountsService.isEmpty()) {
        const msg = this.translateService.instant("HOME.MUST-LOGIN");
        this.toastService.warning(this.translateService.instant("WARNING"), msg);
        return;
      }
      let msg = "";
      if (targetProvider === "gitlab") {
        if (targetHost !== "gitlab.com") {
          msg = this.translateService.instant("HOME.MUST-LOGIN-ASSIGNMENT-GITLAB-CUSTOM", {
            host: instanceName || targetHost,
          });
        } else {
          msg = this.translateService.instant("HOME.MUST-LOGIN-GITLAB");
        }
      } else {
        msg = this.translateService.instant("HOME.MUST-LOGIN-GITHUB");
      }
      this.toastService.warning(this.translateService.instant("WARNING"), msg);
      return;
    }

    if (this.isCreatingNew) return; // Prevent multiple creates

    this.closeAllCreationPopovers();
    this.lastUsedProvider = targetProvider;
    this.lastUsedHost = targetHost;
    this.lastUsedInstanceName = instanceName || "";
    try {
      localStorage.setItem("git4school_last_provider", targetProvider);
      localStorage.setItem("git4school_last_host", targetHost);
      if (instanceName) {
        localStorage.setItem("git4school_last_instance_name", instanceName);
      } else {
        localStorage.removeItem("git4school_last_instance_name");
      }
    } catch (e) {}

    let assignment = new Assignment();
    assignment.id = -1; // Temporary ID for creation
    assignment.provider = targetProvider;
    assignment.instanceHost = targetHost;
    if (instanceName) {
      assignment.instanceName = instanceName;
    }
    (assignment as any).uiType = targetProvider;
    (assignment as any).uiStatus = "prepared";

    // Vue dossiers : pas d'éditeur inline, la création passe directement par la modale.
    if (this.viewMode === "folders") {
      this.isCreatingNew = true;
      this.configurationService.openConfigurationModal(assignment).finally(() => {
        this.isCreatingNew = false;
        this.loadAssignments();
      });
      return;
    }

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

    if (this.selectedFilterPill && this.selectedFilterPill.key !== "all") {
      this.createAssignment(this.selectedFilterPill.provider, this.selectedFilterPill.instanceHost, this.selectedFilterPill.instanceName);
      return;
    }

    this.createAssignment(this.lastUsedProvider, this.lastUsedHost, this.lastUsedInstanceName);
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

  trackByPillKey(index: number, pill: ProviderFilterPill): string {
    return pill.key;
  }

  editAssignment(assignment: any) {
    if (!this.isAssignmentConnected(assignment) && assignment.id !== -1) return;

    // If we were creating a new one and clicked edit on another, discard the new one
    if (this.isCreatingNew && assignment.id !== -1) {
      this.assignments = this.assignments.filter((a) => a.id !== -1);
      this.isCreatingNew = false;
    }

    this.inlineFocusField = "title";
    this.editingAssignment = assignment;

    this.scrollEditingCardIntoView(assignment);
  }

  /**
   * Vue dossiers : la configuration passe par la modale existante (autosave et garde de
   * fermeture de ConfigurationComponent), puis la liste est rechargée.
   */
  configureAssignment(assignment: any) {
    if (!this.isAssignmentConnected(assignment)) {
      const msg = this.getDisconnectedTooltip(assignment);
      this.toastService.warning(this.translateService.instant("WARNING"), msg);
      return;
    }
    this.databaseService.getAssignmentById(assignment.id).then((fullAssignment) => {
      this.configurationService.openConfigurationModal(fullAssignment).finally(() => this.loadAssignments());
    });
  }

  /**
   * Re-runs the "show the whole card" scroll. Called when the inline editor's height changes,
   * e.g. after switching configuration tabs, so the card fits in the viewport again.
   */
  onConfigurationTabChanged() {
    if (!this.editingAssignment) {
      return;
    }
    this.scrollEditingCardIntoView(this.editingAssignment);
  }

  closeEdit(assignment?: Assignment) {
    if (assignment) {
      this.rememberLastUsedProvider(assignment);
    }
    if (this.isCreatingNew) {
      this.assignments = this.assignments.filter((a) => a.id !== -1);
    }
    this.isCreatingNew = false;
    this.editingAssignment = null;
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

  private scrollEditingCardIntoView(assignment: any) {
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

  private rememberLastUsedProvider(assignment: Assignment): void {
    if (!assignment || !assignment.provider) {
      return;
    }
    this.lastUsedProvider = assignment.provider;
    this.lastUsedHost = assignment.instanceHost || (assignment.provider === "gitlab" ? "gitlab.com" : "github.com");
    this.lastUsedInstanceName = assignment.instanceName || "";
    try {
      localStorage.setItem("git4school_last_provider", assignment.provider);
      localStorage.setItem("git4school_last_host", this.lastUsedHost);
      if (assignment.instanceName) {
        localStorage.setItem("git4school_last_instance_name", assignment.instanceName);
      } else {
        localStorage.removeItem("git4school_last_instance_name");
      }
    } catch (e) {}
  }
}
