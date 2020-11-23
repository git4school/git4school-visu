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
import { Subject, Subscription } from "rxjs";
import { debounceTime, map } from "rxjs/operators";

/**
 * This component is a modal that is used to add several repositories at the same time.
 *
 * To do so, a list of repositories for the authenticated user is displayed, and it is possible to use the search bar to search for repositories on Github
 */
@Component({
  selector: "app-modal-add-repositories",
  templateUrl: "./modal-add-repositories.component.html",
  styleUrls: ["./modal-add-repositories.component.scss"],
})
export class ModalAddRepositoriesComponent implements OnInit, OnDestroy {
  /**
   * A DOM element used to get the datatable view height
   */
  @ViewChild("reposTable", { read: ElementRef }) datatable: ElementRef;

  /**
   * The already-added repositories list.
   *
   * It is used to check those repositories in the list of the repositories to add
   */
  @Input() repoList: Repository[];

  /**
   * The loaded repositories to add.
   *
   * It can be from the authenticated user or from a search
   */
  rows: Repository[];

  /**
   * A boolean to indicate the repositories are being fetched
   */
  loading: boolean;

  /**
   * The to-add repositories list.
   *
   * At the component initialization, it is initialized with [repoList]{@link ModalAddRepositoriesComponent#repoList}
   */
  selected: Repository[];

  /**
   * The TP group assigned to all repositories to be added
   */
  tpGroup: string;

  /**
   * The height of the repository table header
   */
  headerHeight: number;

  /**
   * The height of the repository table footer
   */
  footerHeight: number;

  /**
   * The height of one repository row
   */
  rowHeight: number;

  /**
   * The next page of the repositories to be fetched from Github
   *
   * See [updateResults]{@link ModalAddRepositoriesComponent#updateResults} where it is incremented
   *
   * See [searchSubscription]{@link ModalAddRepositoriesComponent#searchSubscription} where it is reset
   */
  private page: number;

  /**
   * The boolean indicating that there is no more next page to fetch the repositories
   *
   * See [updateResultsWithAuthenticatedUser]{@link ModalAddRepositoriesComponent#updateResultsWithAuthenticatedUser}
   * and [updateResultsWithSearchFilter]{@link ModalAddRepositoriesComponent#updateResultsWithSearchFilter} where it is set
   */
  private done: boolean;

  /**
   * This subscription will load the repositories when a string has been entered in the search bar, after 1 second of inactivity
   *
   * See [loadResults]{@link ModalAddRepositoriesComponent#loadResults} for more information about the repositories loading
   */
  private searchSubscription: Subscription;

  /**
   * This subject is used to notify the subcription that the search filter has changed and send it
   *
   * See [searchSubscription]{@link ModalAddRepositoriesComponent#searchSubscription} for more information about the handling
   */
  private searchFilterChanged: Subject<string>;

  /**
   * The string corresponding to the repository search filter
   *
   * See [searchSubscription]{@link ModalAddRepositoriesComponent#searchSubscription} and [searchFilterChanged]{@link ModalAddRepositoriesComponent#searchFilterChanged}
   * for more information about the search process
   */
  private searchFilter;

  /**
   * @param {NgbActiveModal} modalService The service to manage the modal
   * @param {CommitsService} commitsService The service to fetch repositories
   */
  constructor(
    public modalService: NgbActiveModal,
    private commitsService: CommitsService
  ) {}

  /**
   * Add the given repositories to the datatable and increment the next [page]{@link ModalAddRepositoriesComponent#page} to fetch
   *
   * @param {Repository[]} repositories The repositories to add to the datatable
   */
  private updateResults(repositories: Repository[]) {
    this.rows = [...this.rows, ...repositories];
    this.loading = false;
    this.page++;
  }

  /**
   * Fetch the repositories for the authenticated user
   * and [update]{@link ModalAddRepositoriesComponent#updateResults} the datatable with it
   *
   * @param {number} page The page of repositories to fetch
   */
  private updateResultsWithAuthenticatedUser(page: number) {
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

  /**
   * Fetch the repositories from the [search filter]{@link ModalAddRepositoriesComponent#searchFilter} and
   * [update]{@link ModalAddRepositoriesComponent#updateResults} the datatable with it
   *
   * @param {string} searchFilter The search filter used to fetch the repositories
   * @param {number} page The page of repositories to fetch
   */
  private updateResultsWithSearchFilter(searchFilter: string, page: number) {
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

  /**
   * Fetch and load the repositories into the [datatable]{@link datatable}.
   *
   * If there is a [search filter]{@link ModalAddRepositoriesComponent#searchFilter},
   * uses [updateResultsWithSearchFilter]{@link ModalAddRepositoriesComponent#updateResultsWithSearchFilter},
   * if not, uses [updateResultsWithAuthenticatedUser]{@link ModalAddRepositoriesComponent#updateResultsWithAuthenticatedUser}
   */
  private loadResults() {
    this.loading = true;
    if (this.searchFilter) {
      this.updateResultsWithSearchFilter(this.searchFilter, this.page);
    } else {
      this.updateResultsWithAuthenticatedUser(this.page);
    }
  }

  /**
   * A function returning the repository URL.
   *
   * This identifies a row, so that the check mark assignment works well
   *
   * @param row A row element from the datatable, corresponding to a repository
   * @return {string} The URL of the corresponding repository
   */
  getId(row): string {
    return row.url;
  }

  /**
   * Called when the user scrolls through the repositories list.
   *
   * It [loads]{@link ModalAddRepositoriesComponent#loadResults} the repositories
   *
   * @param {number} offsetY An indicator of the current scroll level
   */
  onScroll(offsetY: number) {
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

  /**
   * Called when the user leaves the modal.
   *
   * It assigns to the [selected repositories]{@link ModalAddRepositoriesComponent#selected} the indicated [TP group]{@link ModalAddRepositoriesComponent#tpGroup}
   * and sends them to the parent component by closing the modal
   */
  onClose() {
    this.selected.forEach((repo) => (repo.tpGroup = this.tpGroup));
    this.modalService.close(this.selected);
  }

  /**
   * Called when a repository is checked.
   *
   * It pushes the checked repositories into the [selected repositories]{@link ModalAddRepositoriesComponent#selected} array
   *
   * @param {Repository[]} selected The repositories that has been selected
   */
  onSelect({ selected }) {
    this.selected.splice(0, this.selected.length);
    this.selected.push(...selected);
  }

  /**
   * Called when a key is entered into the search field.
   *
   * It stores the [search filter]{@link ModalAddRepositoriesComponent#searchFilter} and notify the corresponding [subject]{@link ModalAddRepositoriesComponent#searchFilterChanged}
   *
   * @param event The $event object containing the search filter
   */
  onSearch(event) {
    this.searchFilter = event.target.value.toLowerCase();
    this.searchFilterChanged.next(this.searchFilter);
  }

  /**
   * Initialize the component attributes, including the [search subscription]{@link ModalAddRepositoriesComponent#searchSubscription}
   */
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

  /**
   * When the component is initialized, we [initialize]{@link ModalAddRepositoriesComponent#initAttributes} its attributes
   * and [load]{@link ModalAddRepositoriesComponent#loadResults} the repositories
   */
  ngOnInit() {
    this.initAttributes();
    this.loadResults();
  }

  /**
   * When the component is destroyed, we unsubscribe from the [search subscription]{@link ModalAddRepositoriesComponent#searchSubscription}
   */
  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
  }
}
