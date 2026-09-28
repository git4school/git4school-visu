import { Injectable } from "@angular/core";
import { Commit } from "@models/Commit.model";
import { Repository } from "@models/Repository.model";
import { TranslateService } from "@ngx-translate/core";
import { DataService } from "@services/data.service";
import { BehaviorSubject, Observable } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class AnonymizationService {
  private static readonly STORAGE_KEY = "git4school_anonymous_mode";

  public isAnonymous$: Observable<boolean>;

  private isAnonymousSubject: BehaviorSubject<boolean>;

  constructor(private translateService: TranslateService, private dataService: DataService) {
    const savedState = localStorage.getItem(AnonymizationService.STORAGE_KEY) === "true";
    this.isAnonymousSubject = new BehaviorSubject<boolean>(savedState);
    this.isAnonymous$ = this.isAnonymousSubject.asObservable();
  }

  public get isAnonymous(): boolean {
    return this.isAnonymousSubject.value;
  }

  public toggleAnonymousMode(): boolean {
    const newState = !this.isAnonymous;
    this.setAnonymousMode(newState);
    return newState;
  }

  public setAnonymousMode(value: boolean): void {
    if (this.isAnonymousSubject.value === value) {
      return;
    }

    this.isAnonymousSubject.next(value);
    localStorage.setItem(AnonymizationService.STORAGE_KEY, String(value));
  }

  public getDisplayName(repository: Repository | null | undefined): string {
    if (!repository) {
      return "";
    }

    if (!this.isAnonymous) {
      return repository.name || repository.getNameFromUrl() || "";
    }

    return this.getAnonymizedName(repository);
  }

  public getAnonymizedName(repoOrName: Repository | string): string {
    if (!repoOrName) {
      return this.translateService.instant("ANONYMOUS.STUDENT_FALLBACK");
    }

    const index = this.findRepositoryIndex(repoOrName);
    const studentNumber = index >= 0 ? index + 1 : 1;
    return this.translateService.instant("ANONYMOUS.STUDENT_LABEL", { index: studentNumber });
  }

  public getCommitAuthorDisplayName(commit: Commit | null | undefined, repository?: Repository): string {
    if (!commit) {
      return "";
    }

    if (!this.isAnonymous) {
      return commit.author || "";
    }

    const targetRepo = repository || this.findRepositoryForCommit(commit);
    if (targetRepo) {
      return this.getAnonymizedName(targetRepo);
    }

    return this.translateService.instant("ANONYMOUS.ANONYMOUS_AUTHOR");
  }

  private findRepositoryIndex(repoOrName: Repository | string): number {
    const repos = this.dataService.repositories || [];
    if (typeof repoOrName === "string") {
      return repos.findIndex((r) => r.name === repoOrName || r.url === repoOrName);
    }
    return repos.findIndex((r) => Repository.isEqual(r, repoOrName) || r.name === repoOrName.name);
  }

  private findRepositoryForCommit(commit: Commit): Repository | undefined {
    const repos = this.dataService.repositories || [];
    return repos.find((r) => r.commits && r.commits.some((c) => c === commit || (commit.url && c.url === commit.url)));
  }
}
