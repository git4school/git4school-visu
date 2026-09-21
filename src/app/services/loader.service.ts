import { Injectable } from "@angular/core";
import { Milestone } from "@models/Milestone.model";
import { QuestionClosingMode } from "@models/Metadata.model";
import { Repository } from "@models/Repository.model";
import { TranslateService } from "@ngx-translate/core";
import { Observable, of } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { AccountsService } from "./accounts.service";
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
   * @param commitsService The service that retrieves repositories and their commits from Github
   * @param dataService The service that stores the data
   * @param translateService The translation service
   * @param toastService The service displaying error or warning toasts
   * @param accountsService The service managing accounts and token status
   */
  constructor(
    private commitsService: CommitsService,
    private dataService: DataService,
    private translateService: TranslateService,
    private toastService: ToastService,
    private accountsService: AccountsService,
  ) {}

  /**
   * Loads the commits to be displayed in the graphs.
   *
   * Updates the commits metadata with associated milestones, such as their color.
   *
   * @param repositories
   * @param reviews
   * @param corrections
   * @param questions
   */
  loadCommitsMetadata(
    repositories: Repository[],
    reviews: Milestone[],
    corrections: Milestone[],
    questions: string[],
    closingMode?: QuestionClosingMode,
    customKeywords?: string[],
  ) {
    const mode = closingMode || this.dataService.closingMode;
    const keywords = customKeywords !== undefined ? customKeywords : this.dataService.customClosingKeywords;

    repositories.forEach((repository) => {
      let filteredReviews = reviews?.filter((review) => review.tpGroup === repository.tpGroup || !review.tpGroup);
      let filteredCorrections = corrections?.filter((correction) => correction.tpGroup === repository.tpGroup || !correction.tpGroup);

      repository.commits?.forEach((commit) => commit.updateMetadata(filteredReviews, filteredCorrections, questions, mode, keywords));
    });
  }

  /**
   * Fetch the repositories from Git provider and loads their commits with [loadCommitsMetadata]{@link LoaderService#loadCommitsMetadata}
   * @param startDate The date from which commits are retrieved
   * @param endDate The date up to which commits are retrieved
   */
  loadRepositories(startDate?: string, endDate?: string): Observable<void> {
    const firstRepo = this.dataService.repositories?.[0];
    if (!firstRepo) {
      return of(undefined);
    }

    const provider = firstRepo.provider || "github";
    let instanceHost: string | undefined;
    if (firstRepo.url) {
      try {
        instanceHost = new URL(firstRepo.url).hostname;
      } catch {}
    }

    const tokenStatus = this.accountsService.getTokenStatus(provider, instanceHost);

    if (tokenStatus === "invalid") {
      this.showInvalidTokenToast(provider);
      return of(undefined);
    }

    if (tokenStatus === "unknown") {
      return this.accountsService.checkTokenValidity(provider, instanceHost).pipe(
        switchMap((isValid) => {
          if (!isValid) {
            this.showInvalidTokenToast(provider);
            return of(undefined);
          }
          return this.executeLoadRepositories(startDate, endDate);
        }),
      );
    }

    return this.executeLoadRepositories(startDate, endDate);
  }

  private executeLoadRepositories(startDate?: string, endDate?: string): Observable<void> {
    let translations = this.translateService.instant([
      "ERRORS.REPOSITORY-NOT-FOUND",
      "ERRORS.README-NOT-FOUND",
      "ERRORS.DETAILS",
      "GIT-ERROR",
    ]);
    return this.commitsService.getRepositories(this.dataService.repositories, startDate, endDate).pipe(
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
            let error = this.translateService.instant(["ERROR-TITLE-ERROR-OCCURED", "ERROR-MESSAGE-ERROR-OCCURED"]);
            this.toastService.warning(error["ERROR-TITLE-ERROR-OCCURED"], error["ERROR-MESSAGE-ERROR-OCCURED"]);
          }
          this.dataService.repositories = repositories.slice();
          this.dataService.tpGroups = Array.from(tpGroups).filter(Boolean);
          this.loadCommitsMetadata(
            this.dataService.repositories,
            this.dataService.reviews,
            this.dataService.corrections,
            this.dataService.questions,
          );
          this.dataService.lastUpdateDate = new Date();
          this.dataService.repoToLoad = false;
          this.dataService.saveData();
        } catch (err) {
          this.toastService.error(translations["GIT-ERROR"], err);
        }
      }),
    );
  }

  private showInvalidTokenToast(provider: string): void {
    const title = this.translateService.instant("TOKEN_HEALTH.ERROR_TITLE");
    const messageKey = provider === "gitlab" ? "TOKEN_HEALTH.ERROR_MSG_GITLAB" : "TOKEN_HEALTH.ERROR_MSG_GITHUB";
    const message = this.translateService.instant(messageKey);
    this.toastService.error(title, message);
  }
}
