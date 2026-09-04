import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { Repository } from "@models/Repository.model";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { CommitsService } from "@services/commits.service";
import { Utils } from "@services/utils";
import { Observable, Subject, Subscription } from "rxjs";
import { debounceTime, map } from "rxjs/operators";

@Component({
  selector: "app-modal-add-repositories",
  templateUrl: "./modal-add-repositories.component.html",
  styleUrls: ["./modal-add-repositories.component.scss"],
})
export class ModalAddRepositoriesComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  @ViewChild("reposTable", { read: ElementRef }) datatable: ElementRef;
  @Input() repoList: Repository[];
  rows: Repository[];
  nameMatches: Repository[] = [];
  contentMatches: Repository[] = [];
  loading: boolean;
  selected: Repository[];
  selectedUrls: Set<string> = new Set();
  tpGroup: string;
  allUserRepositories: Repository[] = [];
  sortBy = "";
  sortDesc = false;
  private cursor: string;
  private done: boolean;
  private searchSubscription: Subscription;
  private searchFilterChanged: Subject<string>;
  private searchFilter;

  constructor(
    public activeModal: CustomModalRef,
    private commitsService: CommitsService,
    private ngZone: NgZone
  ) {}

  get hasGroupedMatches(): boolean {
    return (
      Boolean(this.searchFilter) &&
      (this.contentMatches.length > 0 || this.nameMatches.length > 0)
    );
  }

  private getTargetSourceUrl(filter: string): string | undefined {
    if (!filter) return undefined;
    const clean = filter.trim();
    const urlMatch = clean.match(
      /^(?:https?:\/\/github\.com\/|git@github\.com:)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/)?$/i
    );
    if (urlMatch) {
      return `https://github.com/${urlMatch[1]}/${urlMatch[2]}`;
    }
    return undefined;
  }

  organizeHierarchy(
    repositories: Repository[],
    targetSourceUrl?: string
  ): Repository[] {
    if (!repositories || repositories.length === 0) {
      return [];
    }

    const urlMap = new Map<string, Repository>();
    repositories.forEach((r) => {
      if (r && r.url) {
        urlMap.set(r.url.toLowerCase(), r);
      }
    });

    const parentToChildren = new Map<string, Repository[]>();
    const rootRepos: Repository[] = [];
    const targetLower = targetSourceUrl ? targetSourceUrl.toLowerCase() : null;
    const targetRepo = targetLower ? urlMap.get(targetLower) : null;
    const { owner } = targetSourceUrl
      ? this.getSearchTerms(targetSourceUrl)
      : { owner: undefined };
    const targetCore = targetRepo
      ? Utils.extractAssignmentCore(targetRepo.name, owner)
      : "";

    for (const repo of repositories) {
      const pUrl = repo.parentUrl ? repo.parentUrl.toLowerCase() : null;

      if (pUrl && urlMap.has(pUrl) && pUrl !== repo.url.toLowerCase()) {
        if (!parentToChildren.has(pUrl)) {
          parentToChildren.set(pUrl, []);
        }
        parentToChildren.get(pUrl).push(repo);
      } else if (
        targetLower &&
        targetRepo &&
        repo.url.toLowerCase() !== targetLower &&
        targetCore &&
        (repo.name.toLowerCase().includes(targetCore) ||
          Utils.extractAssignmentCore(repo.name, owner).includes(targetCore))
      ) {
        // Child fork belonging to target assignment (e.g. GitHub Classroom student repo created from template)
        if (!parentToChildren.has(targetLower)) {
          parentToChildren.set(targetLower, []);
        }
        parentToChildren.get(targetLower).push(repo);
      } else {
        rootRepos.push(repo);
      }
    }

    // If targetSourceUrl is provided, ensure target repository is at index 0
    if (targetLower) {
      const targetIdx = rootRepos.findIndex(
        (r) => r.url && r.url.toLowerCase() === targetLower
      );
      if (targetIdx > 0) {
        const [targetR] = rootRepos.splice(targetIdx, 1);
        rootRepos.unshift(targetR);
      }
    }

    // Flatten hierarchy: each root followed directly by its children
    const result: Repository[] = [];
    for (const root of rootRepos) {
      root.isChildFork = false;
      result.push(root);

      const rootUrlLower = root.url ? root.url.toLowerCase() : "";
      const children = parentToChildren.get(rootUrlLower);
      if (children && children.length > 0) {
        for (const child of children) {
          child.isChildFork = true;
          child.isFork = true;
          child.parentUrl = root.url;
          result.push(child);
        }
      }
    }

    return result;
  }

  getSearchTerms(filter: string): { owner?: string; name: string } {
    if (!filter) return { name: "" };
    const clean = filter.trim();
    // 1. URL pattern (e.g. https://github.com/UE-TOAW/repo or UE-TOAW/repo)
    const urlMatch = clean.match(
      /^(?:https?:\/\/github\.com\/|git@github\.com:)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/)?$/i
    );
    if (urlMatch) {
      return {
        owner: urlMatch[1].toLowerCase(),
        name: urlMatch[2].toLowerCase(),
      };
    }
    // 2. Org URL or single token (e.g. https://github.com/UE-TOAW or UE-TOAW)
    const singleMatch = clean.match(
      /^(?:https?:\/\/github\.com\/|git@github\.com:)?([a-zA-Z0-9_.-]+)\/?$/i
    );
    if (singleMatch) {
      return { name: singleMatch[1].toLowerCase() };
    }
    return { name: clean.toLowerCase() };
  }

  isNameMatch(repo: Repository, searchFilter: string): boolean {
    if (!searchFilter || !repo) return true;
    const { owner, name } = this.getSearchTerms(searchFilter);
    const repoName = (repo.name || "").toLowerCase();
    const repoUrl = (repo.url || "").toLowerCase();

    if (owner && !repoUrl.includes(`/${owner}/`)) {
      return false;
    }

    if (!name) return true;

    const cleanName = name.replace(/[-_]+$/, "");
    const coreSearch = Utils.extractAssignmentCore(name, owner);
    const coreRepo = Utils.extractAssignmentCore(repoName, owner);

    if (cleanName && repoName.includes(cleanName)) {
      return true;
    }
    if (cleanName && repoUrl.includes(cleanName)) {
      return true;
    }
    if (
      coreSearch &&
      (repoName.includes(coreSearch) ||
        coreRepo.includes(coreSearch) ||
        coreSearch.includes(coreRepo))
    ) {
      return true;
    }
    return false;
  }

  isContentMatch(repo: Repository, searchFilter: string): boolean {
    if (!searchFilter || !repo) return false;
    const { owner, name } = this.getSearchTerms(searchFilter);
    const repoUrl = (repo.url || "").toLowerCase();

    if (owner && !repoUrl.includes(`/${owner}/`)) {
      return false;
    }

    if (!name) return false;
    const cleanName = name.replace(/[-_]+$/, "");
    const coreSearch = Utils.extractAssignmentCore(name, owner);
    const desc = (repo.description || "").toLowerCase();
    return (
      (Boolean(cleanName) && desc.includes(cleanName)) ||
      (Boolean(coreSearch) && desc.includes(coreSearch))
    );
  }

  private updateMatchesGrouping() {
    if (!this.searchFilter) {
      this.nameMatches = this.rows;
      this.contentMatches = [];
      return;
    }

    // Group into root + children blocks
    const groups: { root: Repository; children: Repository[] }[] = [];
    let currentGroup: { root: Repository; children: Repository[] } = null;

    for (const repo of this.rows) {
      if (!repo.isChildFork) {
        currentGroup = { root: repo, children: [] };
        groups.push(currentGroup);
      } else if (currentGroup) {
        currentGroup.children.push(repo);
      } else {
        groups.push({ root: repo, children: [] });
      }
    }

    const nameGroupRows: Repository[] = [];
    const contentGroupRows: Repository[] = [];
    const { owner } = this.getSearchTerms(this.searchFilter);
    const isGlobalSearch = !owner;

    for (const group of groups) {
      const rootNameMatch = this.isNameMatch(group.root, this.searchFilter);
      const childNameMatch = group.children.some((c) =>
        this.isNameMatch(c, this.searchFilter)
      );

      if (rootNameMatch || childNameMatch) {
        nameGroupRows.push(group.root, ...group.children);
      } else {
        const rootContentMatch = this.isContentMatch(
          group.root,
          this.searchFilter
        );
        const childContentMatch = group.children.some((c) =>
          this.isContentMatch(c, this.searchFilter)
        );

        if (isGlobalSearch || rootContentMatch || childContentMatch) {
          contentGroupRows.push(group.root, ...group.children);
        }
      }
    }

    this.nameMatches = nameGroupRows;
    this.contentMatches = contentGroupRows;
  }

  private updateResults(repositories: Repository[], isFirstPage = false) {
    const filterAlreadyInAssignment = (repo: Repository) =>
      repo &&
      repo.url &&
      !this.repoList.some((r) => Repository.isEqual(r, repo));

    const targetUrl = this.getTargetSourceUrl(this.searchFilter);

    if (isFirstPage) {
      const seen = new Set<string>();
      const filtered: Repository[] = [];
      for (const repo of repositories) {
        if (filterAlreadyInAssignment(repo) && !seen.has(repo.url)) {
          seen.add(repo.url);
          filtered.push(repo);
        }
      }
      this.rows = this.organizeHierarchy(filtered, targetUrl);
    } else {
      const seenUrls = new Set(this.rows.map((r) => r.url));
      const newRepos = repositories.filter(
        (repo) => filterAlreadyInAssignment(repo) && !seenUrls.has(repo.url)
      );
      this.rows = this.organizeHierarchy(
        [...this.rows, ...newRepos],
        targetUrl
      );
    }

    if (!this.searchFilter) {
      const cachedUrls = new Set(this.allUserRepositories.map((r) => r.url));
      const newForCache = repositories.filter(
        (repo) => repo && repo.url && !cachedUrls.has(repo.url)
      );
      this.allUserRepositories = [...this.allUserRepositories, ...newForCache];
    }

    this.applySort();
    this.loading = false;
  }

  private processIntermediateResponse(
    response: Observable<{
      completed: boolean;
      repositories: Repository[];
      cursor?: string;
    }>,
    isFirstPage = false
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
        this.updateResults(repositories, isFirstPage);
      });
  }

  private updateResultsWithAuthenticatedUser(
    cursor?: string,
    isFirstPage = false
  ) {
    this.processIntermediateResponse(
      this.commitsService.getRepositoriesByAuthenticatedUser(cursor),
      isFirstPage
    );
  }

  private updateResultsWithSearchFilter(
    searchFilter: string,
    cursor?: string,
    isFirstPage = false
  ) {
    this.processIntermediateResponse(
      this.commitsService.getRepositoriesBySearch(searchFilter, cursor),
      isFirstPage
    );
  }

  private loadResults() {
    this.loading = true;
    const isFirstPage = !this.cursor;
    if (this.searchFilter) {
      this.updateResultsWithSearchFilter(
        this.searchFilter,
        this.cursor,
        isFirstPage
      );
    } else {
      this.updateResultsWithAuthenticatedUser(this.cursor, isFirstPage);
    }
  }

  getId(row): string {
    return row.url;
  }

  onScroll(event: Event) {
    const target = event.target as HTMLElement;
    const endOfScrolling =
      target.scrollHeight - target.scrollTop <= target.clientHeight + 50;

    if (!this.loading && !this.done && endOfScrolling) {
      this.ngZone.run(() => {
        this.loadResults();
      });
    }
  }

  onClose() {
    this.selected.forEach((repo) => {
      repo.tpGroup = this.tpGroup;
      repo.name = "";
    });
    this.activeModal.close(this.selected);
  }

  isSelected(repo: Repository): boolean {
    return this.selectedUrls.has(repo.url);
  }

  toggleSelection(repo: Repository) {
    const index = this.selected.findIndex((r) => Repository.isEqual(r, repo));
    if (index > -1) {
      this.selected.splice(index, 1);
      this.selectedUrls.delete(repo.url);
    } else {
      this.selected.push(repo);
      this.selectedUrls.add(repo.url);
    }
  }

  isAllSelected(): boolean {
    return this.rows.length > 0 && this.selected.length === this.rows.length;
  }

  toggleSelectAll() {
    if (this.isAllSelected()) {
      this.selected = [];
      this.selectedUrls.clear();
    } else {
      this.selected = [...this.rows];
      this.selectedUrls = new Set(this.rows.map((r) => r.url));
    }
  }

  clearSelection() {
    this.selected = [];
    this.selectedUrls.clear();
  }

  onSearch(event) {
    const rawValue = event?.target?.value ?? "";
    const cleanValue = rawValue.trim();
    if (cleanValue === this.searchFilter) {
      return;
    }
    this.searchFilter = cleanValue;
    if (!this.searchFilter) {
      this.cursor = undefined;
      this.done = false;
      const seenUrls = new Set(this.repoList.map((r) => r.url));
      const filtered = this.allUserRepositories.filter(
        (r) => !seenUrls.has(r.url)
      );
      this.rows = this.organizeHierarchy(filtered);
      this.applySort();
      this.loading = false;
    } else {
      // If a full repository URL is typed/pasted, reset sorting so target repo stays in first position
      if (
        /^(?:https?:\/\/github\.com\/|git@github\.com:)/i.test(
          this.searchFilter
        )
      ) {
        this.sortBy = "";
      }
      // Immediate client-side filter of cached repositories for instant feedback
      const query = this.searchFilter.toLowerCase();
      const parts = query.split("/");
      const targetQuery = (parts.length > 1 ? parts[1] : parts[0]).trim();
      const seenUrls = new Set(this.repoList.map((r) => r.url));
      const targetUrl = this.getTargetSourceUrl(this.searchFilter);
      const filtered = this.allUserRepositories.filter(
        (r) =>
          !seenUrls.has(r.url) &&
          (this.isNameMatch(r, this.searchFilter) ||
            this.isContentMatch(r, this.searchFilter))
      );
      this.rows = this.organizeHierarchy(filtered, targetUrl);
      this.applySort();
      this.loading = true;
    }
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
    if (this.sortBy) {
      // Group rows by root parent
      const groups: { root: Repository; children: Repository[] }[] = [];
      let currentGroup: { root: Repository; children: Repository[] } = null;

      for (const repo of this.rows) {
        if (!repo.isChildFork) {
          currentGroup = { root: repo, children: [] };
          groups.push(currentGroup);
        } else if (currentGroup) {
          currentGroup.children.push(repo);
        } else {
          groups.push({ root: repo, children: [] });
        }
      }

      // Sort root repositories
      groups.sort((a, b) => {
        let valA = a.root[this.sortBy] ? a.root[this.sortBy].toLowerCase() : "";
        let valB = b.root[this.sortBy] ? b.root[this.sortBy].toLowerCase() : "";
        if (valA < valB) return this.sortDesc ? 1 : -1;
        if (valA > valB) return this.sortDesc ? -1 : 1;
        return 0;
      });

      // Sort children within each root repository
      for (const group of groups) {
        if (group.children.length > 0) {
          group.children.sort((a, b) => {
            let valA = a[this.sortBy] ? a[this.sortBy].toLowerCase() : "";
            let valB = b[this.sortBy] ? b[this.sortBy].toLowerCase() : "";
            if (valA < valB) return this.sortDesc ? 1 : -1;
            if (valA > valB) return this.sortDesc ? -1 : 1;
            return 0;
          });
        }
      }

      // Flatten back
      const sorted: Repository[] = [];
      for (const group of groups) {
        sorted.push(group.root);
        sorted.push(...group.children);
      }
      this.rows = sorted;
    }
    this.updateMatchesGrouping();
  }

  getAvatarUrl(repo: Repository): string | null {
    if (repo.url && repo.url.includes("github.com")) {
      const parts = repo.url.split("/");
      if (parts.length >= 4) {
        return `https://github.com/${parts[3]}.png?size=40`;
      }
    }
    return null;
  }

  private initAttributes() {
    this.selected = [];
    this.selectedUrls = new Set();
    this.rows = [];
    this.allUserRepositories = [];
    this.loading = false;
    this.tpGroup = "";
    this.cursor = undefined;
    this.done = false;
    this.searchFilterChanged = new Subject<string>();
    this.searchFilter = "";
    this.searchSubscription = this.searchFilterChanged
      .pipe(debounceTime(600))
      .subscribe((searchFilter) => {
        if (searchFilter) {
          this.cursor = undefined;
          this.loadResults();
        }
      });
  }

  ngOnInit() {
    this.initAttributes();
    this.loadResults();
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      if (this.datatable && this.datatable.nativeElement) {
        this.datatable.nativeElement.addEventListener(
          "scroll",
          this.onScroll.bind(this)
        );
      }
    });
  }

  trackByUrl(index: number, repo: Repository): string {
    return repo.url;
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
    if (this.datatable && this.datatable.nativeElement) {
      this.datatable.nativeElement.removeEventListener(
        "scroll",
        this.onScroll.bind(this)
      );
    }
  }
}
