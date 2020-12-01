import { Injectable } from "@angular/core";
import { Milestone } from "@models/Milestone.model";
import { Repository } from "@models/Repository.model";
import { TranslateService } from "@ngx-translate/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { CommitsService } from "./commits.service";
import { DataService } from "./data.service";
import { ToastService } from "./toast.service";

/**
 * This service is used to load data into the application
 */
@Injectable({
  providedIn: "root",
})
export class LoaderService {
  /**
   * @param {CommitsService} commitsService The service that retrieves repositories and their commits from Github
   * @param {DataService} dataService The service that stores the data
   * @param {TranslateService} translateService The translation service
   * @param {ToastService} toastService The service displaying error or warning toasts
   */
  constructor(
    private commitsService: CommitsService,
    private dataService: DataService,
    private translateService: TranslateService,
    private toastService: ToastService
  ) {}

  /**
   * Loads the commits to be displayed in the graphs.
   *
   * Updates the commits metadata with associated milestones, such as their color.
   *
   * @param {Repository[]} repositories
   * @param {Milestone[]} reviews
   * @param {Milestone[]} corrections
   * @param {string[]} questions
   */
  loadCommitsMetadata(
    repositories: Repository[],
    reviews: Milestone[],
    corrections: Milestone[],
    questions: string[]
  ) {
    repositories.forEach((repository) => {
      let filteredReviews = reviews?.filter(
        (review) => review.tpGroup === repository.tpGroup || !review.tpGroup
      );
      let filteredCorrections = corrections?.filter(
        (correction) =>
          correction.tpGroup === repository.tpGroup || !correction.tpGroup
      );

      repository.commits?.forEach((commit) =>
        commit.updateMetadata(filteredReviews, filteredCorrections, questions)
      );
    });
  }

  /**
   * Fetch the repositories from Github and loads their commits with [loadCommitsMetadata]{@link LoaderService#loadCommitsMetadata}
   * @param startDate The date from which commits are retrieved
   * @param endDate The date up to which commits are retrieved
   */
  loadRepositories(startDate?: string, endDate?: string): Observable<void> {
    let translations = this.translateService.instant([
      "ERRORS.REPOSITORY-NOT-FOUND",
      "ERRORS.README-NOT-FOUND",
      "ERRORS.DETAILS",
      "GIT-ERROR",
    ]);
    return this.commitsService
      .getRepositories(this.dataService.repositories, startDate, endDate)
      .pipe(
        map((repositories) => {
          try {
            let tpGroups = new Set<string>();
            let hasError = false;
            repositories.forEach((repository) => {
              tpGroups.add(repository.tpGroup);
              if (repository.errors.length) {
                hasError = true;
              }
            });
            if (hasError) {
              let error = this.translateService.instant([
                "ERROR-TITLE-ERROR-OCCURED",
                "ERROR-MESSAGE-ERROR-OCCURED",
              ]);
              this.toastService.warning(
                error["ERROR-TITLE-ERROR-OCCURED"],
                error["ERROR-MESSAGE-ERROR-OCCURED"]
              );
            }
            this.dataService.repositories = repositories.slice();
            this.dataService.tpGroups = Array.from(tpGroups).filter(Boolean);
            this.loadCommitsMetadata(
              this.dataService.repositories,
              this.dataService.reviews,
              this.dataService.corrections,
              this.dataService.questions
            );
            this.dataService.lastUpdateDate = new Date();
            this.dataService.dataLoaded = true;
            this.dataService.repoToLoad = false;
          } catch (err) {
            this.toastService.error(translations["GIT-ERROR"], err);
          }
        })
      );
  }
}
