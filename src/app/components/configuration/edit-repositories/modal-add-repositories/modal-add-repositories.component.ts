import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { Repository } from "@models/Repository.model";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { CommitsService } from "@services/commits.service";
import { Subject, Subscription } from "rxjs";
import { debounceTime, map } from "rxjs/operators";

@Component({
  selector: "app-modal-add-repositories",
  templateUrl: "./modal-add-repositories.component.html",
  styleUrls: ["./modal-add-repositories.component.scss"],
})
export class ModalAddRepositoriesComponent implements OnDestroy {
  @ViewChild("reposTable", { read: ElementRef }) datatable: ElementRef;
  @Input() repoList: Repository[];
  rows: Repository[];
  loading: boolean;
  selected: Repository[];
  tpGroup: string;
  headerHeight: number;
  footerHeight: number;
  rowHeight: number;
  private page: number;
  private done: boolean;
  private searchSubscription: Subscription;
  private searchFilterChanged: Subject<string>;
  private searchFilter;

  constructor(
    public modalService: NgbActiveModal,
    private commitsService: CommitsService
  ) {}

  private updateResults(repositories: Repository[]) {
    this.rows = [...this.rows, ...repositories];
    this.loading = false;
    this.page++;
  }

  private updateResultsWithAuthenticatedUser(page: number) {
    this.loading = true;
    this.commitsService
      .getRepositoriesByAuthenticatedUser(page)
      .pipe(
        map((res) => {
          this.done = res.completed;
          return res.repositories;
        })
      )
      .subscribe((repositories) => {
        this.updateResults(repositories);
      });
  }

  private updateResultsWithSearchFilter(searchFilter: string, page: number) {
    this.loading = true;
    this.commitsService
      .getRepositoriesBySearch(searchFilter, page)
      .pipe(
        map((res) => {
          this.done = res.completed;
          return res.repositories;
        })
      )
      .subscribe((repositories) => {
        this.updateResults(repositories);
      });
  }

  private loadResults() {
    this.loading = true;
    if (this.searchFilter) {
      this.updateResultsWithSearchFilter(this.searchFilter, this.page);
    } else {
      this.updateResultsWithAuthenticatedUser(this.page);
    }
  }

  getId(row) {
    return row.url;
  }

  onScroll(offsetY) {
    const viewHeight =
      this.datatable.nativeElement.getBoundingClientRect().height -
      this.headerHeight -
      this.footerHeight;
    const endOfScrolling =
      offsetY + viewHeight >= this.rows.length * this.rowHeight;

    if (!this.loading && !this.done && endOfScrolling) {
      this.loadResults();
    }
  }

  onClose() {
    this.selected.forEach((repo) => (repo.tpGroup = this.tpGroup));
    this.modalService.close(this.selected);
  }

  onSelect({ selected }) {
    this.selected.splice(0, this.selected.length);
    this.selected.push(...selected);
  }

  onSearch(event) {
    this.searchFilter = event.target.value.toLowerCase();
    this.searchFilterChanged.next(this.searchFilter);
  }

  private initAttributes() {
    this.selected = this.repoList;
    this.rows = [];
    this.loading = false;
    this.tpGroup = "";
    this.headerHeight = 50;
    this.footerHeight = 50;
    this.rowHeight = 50;
    this.page = 1;
    this.done = false;
    this.searchFilterChanged = new Subject<string>();
    this.searchFilter = "";
    this.searchSubscription = this.searchFilterChanged
      .pipe(debounceTime(1000))
      .subscribe((searchFilter) => {
        this.page = 1;
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
