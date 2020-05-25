import { AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, ViewChild } from '@angular/core';
import { Repository } from '@models/Repository.model';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommitsService } from '@services/commits.service';
import { DatatableComponent } from '@swimlane/ngx-datatable';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';


@Component({
  selector: 'app-modal-add-repositories',
  templateUrl: './modal-add-repositories.component.html',
  styleUrls: ['./modal-add-repositories.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalAddRepositoriesComponent implements AfterViewInit, OnDestroy {
  @ViewChild(DatatableComponent) ngxDatatable: DatatableComponent;
  rows: Observable<Repository[]>;
  temp: Repository[];
  loading = false;
  selected = [];

  constructor(public modalService: NgbActiveModal, private commitsService: CommitsService) {
    this.loading = true;
    this.rows = this.commitsService.getRepositoriesByAuthenticatedUser().pipe(
      map(res => {
        this.loading = false;
        this.temp = res.slice();
        return res;
      })
    );
  }

  ngOnDestroy(): void { }

  ngAfterViewInit() {
    this.ngxDatatable.columnMode = 'force';
  }

  close() {
    this.modalService.close(this.selected);
  }

  onSelect({ selected }) {
    console.log('Select Event', selected, this.selected);

    this.selected.splice(0, this.selected.length);
    this.selected.push(...selected);
  }

  updateFilter(event) {
    const val = event.target.value.toLowerCase();

    this.rows = of(this.temp.filter(repo => repo.url.toLowerCase().indexOf(val) !== -1 || !val));
  }
}
