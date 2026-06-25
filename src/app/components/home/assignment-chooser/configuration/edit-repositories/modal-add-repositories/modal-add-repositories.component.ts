import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { Repository } from "@models/Repository.model";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { CommitsService } from "@services/commits.service";
import { Observable, Subject, Subscription } from "rxjs";
import { debounceTime, map } from "rxjs/operators";

@Component({
  selector: "app-modal-add-repositories",
  templateUrl: "./modal-add-repositories.component.html",
  styleUrls: ["./modal-add-repositories.component.scss"],
})
export class ModalAddRepositoriesComponent implements OnInit, OnDestroy {
  @ViewChild("reposTable", { read: ElementRef }) datatable: ElementRef;
  @Input() repoList: Repository[];
  rows: Repository[];
  loading: boolean;
  selected: Repository[];
  tpGroup: string;
  private cursor: string;
  private done: boolean;
  private searchSubscription: Subscription;
  private searchFilterChanged: Subject<string>;
  private searchFilter;

  sortBy: string = '';
  sortDesc: boolean = false;

  constructor(
    public modalService: NgbActiveModal,
    private commitsService: CommitsService
  ) {}

  private updateResults(repositories: Repository[]) {
    const newRepos = repositories.filter(
      (repo) => !this.repoList.some((r) => Repository.isEqual(r, repo))
    );
    this.rows = [...this.rows, ...newRepos];
    this.applySort();
    this.loading = false;
  }

  private processIntermediateResponse(
    response: Observable<{
      completed: boolean;
      repositories: Repository[];
      cursor?: string;
    }>
  ): Subscription {
    return response
      .pipe(
        map((res) => {
          this.done = res.completed;
          this.cursor = res.cursor;
          return res.repositories;
        })
      )
      .subscribe((repositories) => {
        this.updateResults(repositories);
      });
  }

  private updateResultsWithAuthenticatedUser(cursor?: string) {
    this.processIntermediateResponse(
      this.commitsService.getRepositoriesByAuthenticatedUser(cursor)
    );
  }

  private updateResultsWithSearchFilter(searchFilter: string, cursor?: string) {
    this.processIntermediateResponse(
      this.commitsService.getRepositoriesBySearch(searchFilter, cursor)
    );
  }

  private loadResults() {
    this.loading = true;
    if (this.searchFilter) {
      this.updateResultsWithSearchFilter(this.searchFilter, this.cursor);
    } else {
      this.updateResultsWithAuthenticatedUser(this.cursor);
    }
  }

  getId(row): string {
    return row.url;
  }

  onScroll(event: Event) {
    const target = event.target as HTMLElement;
    const endOfScrolling = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;

    if (!this.loading && !this.done && endOfScrolling) {
      this.loadResults();
    }
  }

  onClose() {
    this.selected.forEach((repo) => {
      repo.tpGroup = this.tpGroup;
      repo.name = "";
    });
    this.modalService.close(this.selected);
  }

  isSelected(repo: Repository): boolean {
    return this.selected.some((r) => Repository.isEqual(r, repo));
  }

  toggleSelection(repo: Repository) {
    const index = this.selected.findIndex((r) => Repository.isEqual(r, repo));
    if (index > -1) {
      this.selected.splice(index, 1);
    } else {
      this.selected.push(repo);
    }
  }

  isAllSelected(): boolean {
    return this.rows.length > 0 && this.selected.length === this.rows.length;
  }

  toggleSelectAll() {
    if (this.isAllSelected()) {
      this.selected = [];
    } else {
      this.selected = [...this.rows];
    }
  }

  clearSelection() {
    this.selected = [];
  }

  onSearch(event) {
    this.searchFilter = event.target.value.toLowerCase();
    this.searchFilterChanged.next(this.searchFilter);
  }

  sort(column: string) {
    if (this.sortBy === column) {
      this.sortDesc = !this.sortDesc;
    } else {
      this.sortBy = column;
      this.sortDesc = false;
    }
    this.applySort();
  }

  applySort() {
    if (!this.sortBy) return;
    this.rows.sort((a, b) => {
      let valA = a[this.sortBy] ? a[this.sortBy].toLowerCase() : '';
      let valB = b[this.sortBy] ? b[this.sortBy].toLowerCase() : '';
      if (valA < valB) return this.sortDesc ? 1 : -1;
      if (valA > valB) return this.sortDesc ? -1 : 1;
      return 0;
    });
  }

  getAvatarUrl(repo: Repository): string | null {
    if (repo.url && repo.url.includes('github.com')) {
      const parts = repo.url.split('/');
      if (parts.length >= 4) {
        return `https://github.com/${parts[3]}.png?size=40`;
      }
    }
    return null;
  }

  private initAttributes() {
    this.selected = [];
    this.rows = [];
    this.loading = false;
    this.tpGroup = "";
    this.cursor = undefined;
    this.done = false;
    this.searchFilterChanged = new Subject<string>();
    this.searchFilter = "";
    this.searchSubscription = this.searchFilterChanged
      .pipe(debounceTime(1000))
      .subscribe((searchFilter) => {
        this.cursor = undefined;
        this.rows = [];
        this.loadResults();
      });
  }

  ngOnInit() {
    this.initAttributes();
    this.loadResults();
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
  }
}
