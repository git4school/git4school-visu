import { HttpClient, HttpHeaders, HttpResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { GitProviderType } from "@models/Account.model";
import { Commit } from "@models/Commit.model";
import { GitDataSearchResult, GitDataService, RepositoryMetadata } from "@models/GitDataService.model";
import { Error, ErrorType, Repository } from "@models/Repository.model";
import { TranslateService } from "@ngx-translate/core";
import * as moment from "moment";
import { forkJoin, Observable, of } from "rxjs";
import { catchError, map, switchMap, tap } from "rxjs/operators";
import { GitlabAuthService } from "./gitlab-auth.service";
import { Utils } from "./utils";

@Injectable({
  providedIn: "root",
})
export class GitlabDataService implements GitDataService {
  public readonly provider: GitProviderType = "gitlab";

  constructor(private http: HttpClient, private gitlabAuthService: GitlabAuthService, private translateService: TranslateService) {}

  get headers(): HttpHeaders {
    return new HttpHeaders({
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.gitlabAuthService.token}`,
    });
  }

  getRepositories(repoTab: Repository[], startDate?: string, endDate?: string): Observable<Repository[]> {
    const t0 = performance.now();
    if (!repoTab || repoTab.length === 0) {
      return of([]);
    }

    const observables = repoTab.map((repo) => this.fetchSingleRepositoryData(repo, startDate, endDate));

    return forkJoin(observables).pipe(
      tap(() => {
        const t1 = performance.now();
        console.log(`[Performance] GitlabDataService getRepositories took ${Math.round(t1 - t0)} ms for ${repoTab.length} repos`);
      }),
    );
  }

  fetchRepositoriesMetadata(repoTab: Repository[]): Observable<RepositoryMetadata[]> {
    if (!repoTab || repoTab.length === 0) {
      return of([]);
    }

    const observables = repoTab.map((repo) => this.fetchSingleRepositoryMetadata(repo));
    return forkJoin(observables);
  }

  private fetchSingleRepositoryMetadata(repo: Repository): Observable<RepositoryMetadata> {
    const { origin, path } = this.extractRepoPathAndOrigin(repo.url);
    if (!path) {
      return of({ url: repo.url, name: "", tpGroup: "" });
    }

    const projectUrl = `${origin}/api/v4/projects/${encodeURIComponent(path)}`;

    return this.http.get<any>(projectUrl, { headers: this.headers }).pipe(
      switchMap((project) => {
        const defaultBranch = project?.default_branch || "main";
        const readmeUrl = `${origin}/api/v4/projects/${encodeURIComponent(path)}/repository/files/README%2Emd/raw?ref=${encodeURIComponent(
          defaultBranch,
        )}`;
        const identityUrl = `${origin}/api/v4/projects/${encodeURIComponent(
          path,
        )}/repository/files/IDENTITY%2Ejson/raw?ref=${encodeURIComponent(defaultBranch)}`;

        return forkJoin({
          readme: this.http.get(readmeUrl, { headers: this.headers, responseType: "text" }).pipe(catchError(() => of(null))),
          identity: this.http.get(identityUrl, { headers: this.headers, responseType: "text" }).pipe(catchError(() => of(null))),
        }).pipe(
          map(({ readme, identity }) => {
            const { name, tpGroup } = Utils.extractRepositoryMetadata(identity, readme);
            return {
              url: repo.url,
              name,
              tpGroup,
            };
          }),
        );
      }),
      catchError((err) => {
        console.error(`Error fetching GitLab repo metadata for ${repo.url}`, err);
        return of({ url: repo.url, name: "", tpGroup: "" });
      }),
    );
  }

  getRepositoriesByAuthenticatedUser(cursor?: string, pageLimit = 100): Observable<GitDataSearchResult> {
    const baseApi = this.getBaseApi();
    const page = cursor ? parseInt(cursor, 10) : 1;
    const url = `${baseApi}/projects?membership=true&order_by=created_at&sort=desc&per_page=${pageLimit}&page=${page}`;

    return this.http.get<any[]>(url, { headers: this.headers, observe: "response" }).pipe(
      map((response: HttpResponse<any[]>) => {
        const nextPage = response.headers.get("x-next-page");
        const projects = response.body || [];
        const repositories = projects.map((p) => this.mapProjectToRepository(p));

        return {
          completed: !nextPage || nextPage.trim() === "",
          repositories,
          cursor: nextPage && nextPage.trim() !== "" ? nextPage.trim() : undefined,
        };
      }),
      catchError((err) => {
        console.error("Error fetching authenticated GitLab user repositories", err);
        return of({
          completed: true,
          repositories: [],
          cursor: undefined,
        });
      }),
    );
  }

  getRepositoriesBySearch(searchFilter: string, cursor?: string, pageLimit = 100): Observable<GitDataSearchResult> {
    const cleanFilter = searchFilter ? searchFilter.trim() : "";
    if (!cleanFilter) {
      return this.getRepositoriesByAuthenticatedUser(cursor, pageLimit);
    }

    const baseApi = this.getBaseApi();
    const page = cursor ? parseInt(cursor, 10) : 1;

    // Check if filter is a full URL or owner/name
    const repoInfo = this.extractRepoPathAndOrigin(cleanFilter);
    if (repoInfo.path) {
      const projectApiUrl = `${repoInfo.origin}/api/v4/projects/${encodeURIComponent(repoInfo.path)}`;
      const forksUrl = `${repoInfo.origin}/api/v4/projects/${encodeURIComponent(repoInfo.path)}/forks?per_page=${pageLimit}&page=${page}`;

      return forkJoin({
        project: this.http.get<any>(projectApiUrl, { headers: this.headers }).pipe(catchError(() => of(null))),
        forks: this.http.get<any[]>(forksUrl, { headers: this.headers, observe: "response" }).pipe(catchError(() => of(null))),
      }).pipe(
        map(({ project, forks }) => {
          const reposMap = new Map<string, Repository>();
          if (project && project.web_url) {
            const r = this.mapProjectToRepository(project);
            reposMap.set(r.url.toLowerCase(), r);
          }
          let nextPage: string | null = null;
          if (forks) {
            nextPage = forks.headers?.get("x-next-page");
            (forks.body || []).forEach((f: any) => {
              const r = this.mapProjectToRepository(f, project?.web_url);
              reposMap.set(r.url.toLowerCase(), r);
            });
          }

          if (reposMap.size > 0) {
            return {
              completed: !nextPage || nextPage.trim() === "",
              repositories: Array.from(reposMap.values()),
              cursor: nextPage && nextPage.trim() !== "" ? nextPage.trim() : undefined,
            };
          }
          return null;
        }),
        switchMap((result) => {
          if (result) {
            return of(result);
          }
          return this.searchProjectsByKeyword(cleanFilter, page, pageLimit, baseApi);
        }),
      );
    }

    return this.searchProjectsByKeyword(cleanFilter, page, pageLimit, baseApi);
  }

  verifyUserAccess(repoUrl: string): Observable<any> {
    const { origin, path } = this.extractRepoPathAndOrigin(repoUrl);
    if (!path) {
      return of({ valid: false });
    }
    const url = `${origin}/api/v4/projects/${encodeURIComponent(path)}`;
    return this.http.get<any>(url, { headers: this.headers }).pipe(
      map((project) => ({
        ...project,
        owner: {
          avatar_url: project.avatar_url || project.namespace?.avatar_url || null,
        },
        avatar_url: project.avatar_url || project.namespace?.avatar_url || null,
      })),
    );
  }

  private searchProjectsByKeyword(keyword: string, page: number, pageLimit: number, baseApi: string): Observable<GitDataSearchResult> {
    const memberUrl = `${baseApi}/projects?search=${encodeURIComponent(keyword)}&membership=true&per_page=${pageLimit}&page=${page}`;
    const allUrl = `${baseApi}/projects?search=${encodeURIComponent(keyword)}&per_page=${pageLimit}&page=${page}`;

    return forkJoin({
      memberRes: this.http.get<any[]>(memberUrl, { headers: this.headers, observe: "response" }).pipe(catchError(() => of(null))),
      allRes: this.http.get<any[]>(allUrl, { headers: this.headers, observe: "response" }).pipe(catchError(() => of(null))),
    }).pipe(
      map(({ memberRes, allRes }) => {
        const reposMap = new Map<string, Repository>();
        const nextPage = memberRes?.headers?.get("x-next-page") || allRes?.headers?.get("x-next-page");

        const memberProjects = memberRes?.body || [];
        const allProjects = allRes?.body || [];

        [...memberProjects, ...allProjects].forEach((p) => {
          if (p && p.web_url) {
            const r = this.mapProjectToRepository(p);
            reposMap.set(r.url.toLowerCase(), r);
          }
        });

        return {
          completed: !nextPage || nextPage.trim() === "",
          repositories: Array.from(reposMap.values()),
          cursor: nextPage && nextPage.trim() !== "" ? nextPage.trim() : undefined,
        };
      }),
      catchError((err) => {
        console.error("Error searching GitLab projects", err);
        return of({
          completed: true,
          repositories: [],
          cursor: undefined,
        });
      }),
    );
  }

  private fetchSingleRepositoryData(repo: Repository, startDate?: string, endDate?: string): Observable<Repository> {
    const { origin, path } = this.extractRepoPathAndOrigin(repo.url);
    if (!path) {
      repo.errors.push(new Error(ErrorType.COMMITS_NOT_FOUND));
      return of(repo);
    }

    const projectUrl = `${origin}/api/v4/projects/${encodeURIComponent(path)}`;

    return this.http.get<any>(projectUrl, { headers: this.headers }).pipe(
      switchMap((project) => {
        const defaultBranch = project?.default_branch || "main";
        const readmeUrl = `${origin}/api/v4/projects/${encodeURIComponent(path)}/repository/files/README%2Emd/raw?ref=${encodeURIComponent(
          defaultBranch,
        )}`;
        const identityUrl = `${origin}/api/v4/projects/${encodeURIComponent(
          path,
        )}/repository/files/IDENTITY%2Ejson/raw?ref=${encodeURIComponent(defaultBranch)}`;

        return forkJoin({
          readme: this.http.get(readmeUrl, { headers: this.headers, responseType: "text" }).pipe(catchError(() => of(null))),
          identity: this.http.get(identityUrl, { headers: this.headers, responseType: "text" }).pipe(catchError(() => of(null))),
          commits: this.fetchAllCommits(origin, path, defaultBranch, startDate, endDate),
        }).pipe(
          map(({ readme, identity, commits }) => {
            const { name, tpGroup } = Utils.extractRepositoryMetadata(identity, readme);

            repo.commits = commits;
            repo.provider = "gitlab";

            if (!repo.name) {
              repo.name = name || repo.getNameFromUrl();
            }
            if (!repo.tpGroup) {
              repo.tpGroup = tpGroup || Utils.DEFAULT_TP_GROUP;
            }

            return repo;
          }),
        );
      }),
      catchError((err) => {
        console.error(`Error fetching GitLab repo data for ${repo.url}`, err);
        repo.errors.push(new Error(ErrorType.COMMITS_NOT_FOUND));
        return of(repo);
      }),
    );
  }

  private fetchAllCommits(origin: string, path: string, defaultBranch: string, startDate?: string, endDate?: string): Observable<Commit[]> {
    let url = `${origin}/api/v4/projects/${encodeURIComponent(path)}/repository/commits?ref_name=${encodeURIComponent(
      defaultBranch,
    )}&per_page=100`;
    if (startDate) {
      url += `&since=${encodeURIComponent(moment(startDate).toDate().toISOString())}`;
    }
    if (endDate) {
      url += `&until=${encodeURIComponent(moment(endDate).toDate().toISOString())}`;
    }

    return this.fetchCommitsPage(url, 1, []);
  }

  private fetchCommitsPage(baseUrl: string, page: number, accumulated: Commit[]): Observable<Commit[]> {
    const pageUrl = `${baseUrl}&page=${page}`;
    return this.http.get<any[]>(pageUrl, { headers: this.headers, observe: "response" }).pipe(
      switchMap((response: HttpResponse<any[]>) => {
        const nodes = response.body || [];
        const commits = nodes.map((n) => Commit.withGitlabJSON(n));
        const allCommits = [...accumulated, ...commits];

        const nextPage = response.headers.get("x-next-page");
        if (nextPage && nextPage.trim() !== "" && nodes.length > 0) {
          return this.fetchCommitsPage(baseUrl, parseInt(nextPage, 10), allCommits);
        }
        return of(allCommits);
      }),
      catchError((err) => {
        console.error(`Error fetching commits page ${page}`, err);
        return of(accumulated);
      }),
    );
  }

  private mapProjectToRepository(project: any, parentUrl?: string): Repository {
    const resolvedParent = project.forked_from_project?.web_url || parentUrl || undefined;
    const isFork = Boolean(project.forked_from_project || resolvedParent);
    const repo = new Repository(
      project.web_url,
      project.path_with_namespace || project.name,
      undefined,
      undefined,
      undefined,
      project.description,
      isFork,
      resolvedParent,
    );
    repo.provider = "gitlab";
    return repo;
  }

  private extractRepoPathAndOrigin(repoUrl: string): { origin: string; path: string } {
    if (!repoUrl) {
      return { origin: this.getBaseOrigin(), path: "" };
    }
    let clean = repoUrl.trim();
    // Handle SSH format e.g. git@gitlab.com:group/subgroup/project.git
    const sshMatch = clean.match(/^git@([^:]+):(.+?)(?:\.git|\/)?$/);
    if (sshMatch) {
      return {
        origin: `https://${sshMatch[1]}`,
        path: sshMatch[2].replace(/^\//, "").replace(/\/$/, ""),
      };
    }

    try {
      const url = new URL(clean.startsWith("http") ? clean : `https://${this.gitlabAuthService.instanceHost}/${clean}`);
      const path = url.pathname
        .replace(/^\//, "")
        .replace(/\.git$/, "")
        .replace(/\/$/, "");
      return { origin: url.origin, path };
    } catch (e) {
      return {
        origin: this.getBaseOrigin(),
        path: clean
          .replace(/^\//, "")
          .replace(/\.git$/, "")
          .replace(/\/$/, ""),
      };
    }
  }

  private getBaseOrigin(): string {
    const host = this.gitlabAuthService.instanceHost || "gitlab.com";
    return `https://${host.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")}`;
  }

  private getBaseApi(): string {
    return `${this.getBaseOrigin()}/api/v4`;
  }
}
