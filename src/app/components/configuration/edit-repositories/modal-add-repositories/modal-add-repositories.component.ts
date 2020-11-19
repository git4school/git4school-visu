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
import { DatatableComponent } from "@swimlane/ngx-datatable";
import { map } from "rxjs/operators";

@Component({
  selector: "app-modal-add-repositories",
  templateUrl: "./modal-add-repositories.component.html",
  styleUrls: ["./modal-add-repositories.component.scss"],
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalAddRepositoriesComponent implements OnDestroy {
  @ViewChild("reposTable", { read: ElementRef }) datatable: ElementRef;
  @ViewChild(DatatableComponent) ngxDatatable: DatatableComponent;
  @Input() repoList: Repository[];
  rows: Repository[] = [];
  temp: Repository[];
  loading = false;
  selected = [];
  tpGroup: string = "";
  page = 1;
  headerHeight = 50;
  footerHeight = 50;
  rowHeight = 50;
  length = 0;
  done = false;

  constructor(
    public modalService: NgbActiveModal,
    private commitsService: CommitsService
  ) {}

  onScroll(offsetY) {
    const viewHeight =
      this.datatable.nativeElement.getBoundingClientRect().height -
      this.headerHeight -
      this.footerHeight;

    if (
      !this.loading &&
      !this.done &&
      offsetY + viewHeight >= this.rows.length * this.rowHeight
    ) {
      this.updateResults(this.page);
    }
  }

  updateResults(page: number) {
    this.loading = true;
    this.commitsService
      .getRepositoriesByAuthenticatedUser(page)
      .pipe(
        map((res) => {
          this.temp = res.repositories.slice();
          this.length = res.repositories.length;

          const link = res.link;
          this.done = !link?.match(/rel=\"last\"/);

          return res.repositories;
        })
      )
      .subscribe((results) => {
        const rows = [...this.rows, ...results];
        this.rows = rows;
        this.loading = false;
        this.page++;
      });
  }

  getId(row) {
    return row.url;
  }

  ngOnInit() {
    this.selected = this.repoList;
    this.updateResults(this.page);
  }

  ngOnDestroy(): void {}

  close() {
    this.selected.forEach((repo) => (repo.tpGroup = this.tpGroup));
    this.modalService.close(this.selected);
  }

  onSelect({ selected }) {
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
