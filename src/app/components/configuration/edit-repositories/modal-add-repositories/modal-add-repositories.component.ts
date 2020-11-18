import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { Repository } from "@models/Repository.model";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { CommitsService } from "@services/commits.service";
import { DataService } from "@services/data.service";
import { DatatableComponent } from "@swimlane/ngx-datatable";
import { map } from "rxjs/operators";

@Component({
  selector: "app-modal-add-repositories",
  templateUrl: "./modal-add-repositories.component.html",
  styleUrls: ["./modal-add-repositories.component.scss"],
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalAddRepositoriesComponent implements AfterViewInit, OnDestroy {
  @ViewChild("reposTable", { read: ElementRef }) datatable: ElementRef;
  @ViewChild(DatatableComponent) ngxDatatable: DatatableComponent;
  @Input() repoList: Repository[];
  rows: Repository[] = [];
  temp: Repository[];
  loading = false;
  selected = [];
  tpGroup: string = "";
  page = 1;
  pageLimit = 10;
  totalElements: number;
  headerHeight = 50;
  footerHeight = 50;
  rowHeight = 50;
  length = 0;

  constructor(
    public modalService: NgbActiveModal,
    private commitsService: CommitsService,
    private dataService: DataService
  ) {}

  onScroll(offsetY) {
    console.log(this.datatable);
    const viewHeight =
      this.datatable.nativeElement.getBoundingClientRect().height -
      this.headerHeight -
      this.footerHeight;
    console.log("event: ", offsetY + viewHeight, this.length * this.rowHeight);
    // const viewHeight =
    //   this.el.nativeElement.getBoundingClientRect().height - this.headerHeight;

    if (
      !this.loading &&
      offsetY + viewHeight >= this.rows.length * this.rowHeight
    ) {
      let limit = this.pageLimit;
      if (this.rows.length === 0) {
        const pageSize = Math.ceil(viewHeight / this.rowHeight);
        limit = Math.max(pageSize, this.pageLimit);
      }
      this.updateResults(this.page);
      this.page++;
    }
  }

  updateResults(page: number) {
    this.loading = true;
    this.commitsService
      .getRepositoriesByAuthenticatedUser(page, this.pageLimit)
      .pipe(
        map((res) => {
          // console.log("res: ", res);
          let filteredRepositories = res.repositories?.filter(
            (repo1) =>
              !this.repoList.some((repo2, index, array) =>
                Repository.isEqual(repo1, repo2)
              )
          );
          this.temp = filteredRepositories.slice();

          this.length = filteredRepositories.length;
          // console.log("ROWS", this.rows);
          return filteredRepositories;
        })
      )
      .subscribe((results) => {
        const rows = [...this.rows, ...results];
        this.rows = rows;
        this.loading = false;
      });
  }

  ngOnInit() {
    this.updateResults(this.page);
    this.page++;
  }

  ngOnDestroy(): void {}

  ngAfterViewInit() {
    // this.ngxDatatable.columnMode = ColumnMode.force;
    // setTimeout(() => {
    //   this.onScroll(0);
    // });
  }

  close() {
    this.selected.forEach((repo) => (repo.tpGroup = this.tpGroup));
    this.modalService.close(this.selected);
  }

  onSelect({ selected }) {
    console.log("Select Event", selected, this.selected);

    this.selected.splice(0, this.selected.length);
    this.selected.push(...selected);
  }

  updateFilter(event) {
    const val = event.target.value.toLowerCase();

    this.rows = this.temp.filter(
      (repo) => repo.url.toLowerCase().indexOf(val) !== -1 || !val
    );
  }
}
