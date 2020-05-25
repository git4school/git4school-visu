import { Injectable } from '@angular/core';
import { Milestone } from '@models/Milestone.model';
import { Repository } from '@models/Repository.model';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CommitsService } from './commits.service';
import { DataService } from './data.service';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {

  constructor(private commitsService: CommitsService,
    private dataService: DataService,
    private translateService: TranslateService,
    private toastService: ToastService
  ) { }

  loadCommitsMetadata(repositories: Repository[], reviews: Milestone[], corrections: Milestone[], questions) {

    repositories.forEach(repository => {
      let rev = !this.dataService.reviews
        ? null
        : this.dataService.reviews.filter(
          review => review.tpGroup === repository.tpGroup
        );
      let cor = !this.dataService.corrections
        ? null
        : this.dataService.corrections.filter(
          correction => correction.tpGroup === repository.tpGroup
        );

      repository.commits && repository.commits.forEach(commit =>
        commit.updateMetadata(rev, cor, questions)
      );
    });
  }

  loadRepositories(startDate?: string, endDate?: string): Observable<void> {
    let translations = this.translateService.instant([
      'ERRORS.REPOSITORY-NOT-FOUND',
      'ERRORS.README-NOT-FOUND',
      'ERRORS.DETAILS',
      'GIT-ERROR'
    ]);
    return this.commitsService
      .getRepositories(this.dataService.repositories, startDate, endDate)
      .pipe(map(repositories => {
        try {
          let tpGroups = new Set<string>();
          repositories.forEach((repository, index) => {
            this.commitsService.getRepositoryFromRaw(
              this.dataService.repositories[index],
              repository,
              translations
            );
            tpGroups.add(this.dataService.repositories[index].tpGroup);
          });
          this.dataService.tpGroups = Array.from(tpGroups);
          this.loadCommitsMetadata(repositories, this.dataService.reviews, this.dataService.corrections, this.dataService.questions);
          this.dataService.lastUpdateDate = new Date();
          this.dataService.dataLoaded = true;
          this.dataService.repoToLoad = false;
        } catch (err) {
          this.toastService.error(translations['GIT-ERROR'], err);
        }
      }));
  }
}
