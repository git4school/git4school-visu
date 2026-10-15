import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { GitProviderType } from "@models/Account.model";
import { Commit } from "@models/Commit.model";
import { GitDataSearchResult, GitDataService, RepositoryMetadata } from "@models/GitDataService.model";
import { Repository } from "@models/Repository.model";
import { TranslateService } from "@ngx-translate/core";
import moment from "moment";
import { forkJoin, Observable, of } from "rxjs";
import { catchError, map, shareReplay, switchMap, tap } from "rxjs/operators";
import { GithubAuthService } from "./github-auth.service";
import {
  GITHUB_AUTHENTICATED_REPOSITORIES_QUERY,
  GITHUB_GRAPHQL_ENDPOINT,
  GITHUB_REPOSITORY_SEARCH_QUERY,
  GITHUB_SCOPED_REPOSITORY_SEARCH_QUERY,
  GITHUB_USER_ORGANIZATIONS_QUERY,
  getCommitHistoryQueryFragment,
} from "./github-queries";
import { Utils } from "./utils";
import {
  mapAuthenticatedRepositoriesResponse,
  mapGlobalSearchResponse,
  mapOrgSearchResponse,
  mapScopedSearchResponse,
  applyBatchedRepositoriesResponse,
} from "./github-mappers";

@Injectable({
  providedIn: "root",
})
export class GithubDataService implements GitDataService {
  public readonly provider: GitProviderType = "github";

  private userOrganizations$: Observable<string[]> = null;

  constructor(private http: HttpClient, private githubAuthService: GithubAuthService, private translateService: TranslateService) {}

  get headers(): HttpHeaders {
    return new HttpHeaders({
      "Content-Type": "application/json",
      Authorization: "token " + this.githubAuthService.token,
    });
  }

  getRepositories(repoTab: Repository[], startDate?: string, endDate?: string): Observable<Repository[]> {
    const t0 = performance.now();
    const CHUNK_SIZE = 4;
    const chunks: Repository[][] = [];
    for (let i = 0; i < repoTab.length; i += CHUNK_SIZE) {
      chunks.push(repoTab.slice(i, i + CHUNK_SIZE));
    }

    if (chunks.length === 0) {
      return of([]);
    }

    const chunkObservables = chunks.map((chunk) => this.getBatchedRepositories(chunk, startDate, endDate));

    return forkJoin(chunkObservables).pipe(
      map((results) => results.reduce((acc, val) => acc.concat(val), [])),
      tap(() => {
        const t1 = performance.now();
        console.log(`[Performance] GithubDataService getRepositories took ${Math.round(t1 - t0)} ms for ${repoTab.length} repos`);
      }),
    );
  }

  fetchRepositoriesMetadata(repoTab: Repository[]): Observable<RepositoryMetadata[]> {
    if (!repoTab || repoTab.length === 0) {
      return of([]);
    }

    const CHUNK_SIZE = 10;
    const chunks: Repository[][] = [];
    for (let i = 0; i < repoTab.length; i += CHUNK_SIZE) {
      chunks.push(repoTab.slice(i, i + CHUNK_SIZE));
    }

    const chunkObservables = chunks.map((chunk) => this.fetchBatchedRepositoriesMetadata(chunk));
    return forkJoin(chunkObservables).pipe(map((results) => results.reduce((acc, val) => acc.concat(val), [])));
  }

  private fetchBatchedRepositoriesMetadata(repoTab: Repository[]): Observable<RepositoryMetadata[]> {
    const repoInfos = repoTab.map((repo, index) => {
      const parts = repo.url.split("/");
      return {
        alias: `repo${index}`,
        owner: parts[3],
        name: parts[4],
        url: repo.url,
      };
    });

    let query = "query {\n";
    repoInfos.forEach((info) => {
      query += `
        ${info.alias}: repository(owner: "${info.owner}", name: "${info.name}") {
          identity: object(expression: "HEAD:IDENTITY.json") {
            ... on Blob { text }
          }
          readme: object(expression: "HEAD:README.md") {
            ... on Blob { text }
          }
        }
      `;
    });
    query += "}";

    return this.http.post<{ data?: any; errors?: any[] }>(GITHUB_GRAPHQL_ENDPOINT, { query }, { headers: this.headers }).pipe(
      map((response) => {
        return repoInfos.map((info) => {
          const repoData = response?.data?.[info.alias];
          const identityData = repoData?.identity?.text;
          const readmeData = repoData?.readme?.text;
          const { name, tpGroup } = Utils.extractRepositoryMetadata(identityData, readmeData);
          return {
            url: info.url,
            name,
            tpGroup,
          };
        });
      }),
      catchError((err) => {
        console.error("fetchBatchedRepositoriesMetadata error:", err);
        return of(
          repoInfos.map((info) => ({
            url: info.url,
            name: "",
            tpGroup: "",
          })),
        );
      }),
    );
  }

  getRepositoriesByAuthenticatedUser(cursor?: string, pageLimit = 100): Observable<GitDataSearchResult> {
    const variables = { cursor, pageLimit };
    return this.http
      .post<{ data: any; errors?: any[] }>(
        GITHUB_GRAPHQL_ENDPOINT,
        { query: GITHUB_AUTHENTICATED_REPOSITORIES_QUERY, variables },
        { headers: this.headers },
      )
      .pipe(
        map(mapAuthenticatedRepositoriesResponse),
        catchError((err) => {
          if (err?.status === 401 || err?.status === 403) {
            this.githubAuthService.markTokenInvalid();
          }
          console.error("Error fetching authenticated GitHub user repositories", err);
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

    const orgUrlMatch = cleanFilter.match(/^(?:https?:\/\/github\.com\/|git@github\.com:)([a-zA-Z0-9_.-]+)\/?$/i);
    let effectiveFilter = cleanFilter;
    if (orgUrlMatch) {
      effectiveFilter = orgUrlMatch[1];
    }

    const repoMatch = effectiveFilter.match(
      /^(?:https?:\/\/github\.com\/|git@github\.com:|^)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/)?$/i,
    );

    if (repoMatch) {
      const owner = repoMatch[1];
      const name = repoMatch[2];
      const corePattern = Utils.extractAssignmentCore(name, owner);
      const qOrg = corePattern ? `${corePattern} org:${owner} fork:true` : `org:${owner} fork:true`;

      const variables = {
        owner,
        name,
        qOrg,
        pageLimit,
        cursor: cursor || null,
      };
      return this.http
        .post<{ data?: any; errors?: any[] }>(
          GITHUB_GRAPHQL_ENDPOINT,
          { query: GITHUB_SCOPED_REPOSITORY_SEARCH_QUERY, variables },
          { headers: this.headers },
        )
        .pipe(
          map(mapScopedSearchResponse),
          catchError((err) => {
            console.error("Error searching GitHub owner/name repositories", err);
            return of({
              completed: true,
              repositories: [],
              cursor: undefined,
            });
          }),
        );
    }

    if (cursor) {
      const cleanTerm = cleanFilter.replace(/[-_]+$/, "");
      const coreTerm = Utils.extractAssignmentCore(cleanTerm);
      const searchKeyword = coreTerm || cleanTerm;
      const variables = {
        queryString: (searchKeyword ? `${searchKeyword} ` : "") + "fork:true",
        cursor,
        pageLimit,
      };
      return this.http
        .post<{ data: any; errors?: any[] }>(
          GITHUB_GRAPHQL_ENDPOINT,
          { query: GITHUB_REPOSITORY_SEARCH_QUERY, variables },
          { headers: this.headers },
        )
        .pipe(
          map(mapGlobalSearchResponse),
          catchError((err) => {
            console.error("Error searching GitHub repositories (page)", err);
            return of({
              completed: true,
              repositories: [],
              cursor: undefined,
            });
          }),
        );
    }

    return this.getUserOrganizations().pipe(
      switchMap((orgs) => {
        const isUserOrg = orgs && orgs.some((o) => o.toLowerCase() === effectiveFilter.toLowerCase());
        const cleanTerm = effectiveFilter.replace(/[-_]+$/, "");
        const coreTerm = Utils.extractAssignmentCore(cleanTerm);
        const searchKeyword = coreTerm || cleanTerm;

        const queryArgs = ["$qGlobal: String!", "$qUser: String!", "$pageLimit: Int!"];
        let queryBody = `
          globalSearch: search(query: $qGlobal, type: REPOSITORY, first: $pageLimit) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              ... on Repository {
                name
                url
                description
                isFork
                parent {
                  name
                  url
                }
              }
            }
          }
          userSearch: search(query: $qUser, type: REPOSITORY, first: $pageLimit) {
            nodes {
              ... on Repository {
                name
                url
                description
                isFork
                parent {
                  name
                  url
                }
              }
            }
          }
        `;

        const variables: any = {
          qGlobal: searchKeyword ? `${searchKeyword} fork:true` : "fork:true",
          qUser: searchKeyword ? `${searchKeyword} user:@me fork:true` : "user:@me fork:true",
          pageLimit,
        };

        if (isUserOrg) {
          queryArgs.push("$login: String!", "$qOwnerOrg: String!");
          queryBody += `
            ownerOrgSearch: search(query: $qOwnerOrg, type: REPOSITORY, first: $pageLimit) {
              nodes {
                ... on Repository {
                  name
                  url
                  description
                  isFork
                  parent {
                    name
                    url
                  }
                }
              }
            }
            repositoryOwner(login: $login) {
              repositories(first: 100, affiliations: [OWNER, COLLABORATOR]) {
                nodes {
                  name
                  url
                  description
                  isFork
                  parent {
                    name
                    url
                  }
                }
              }
            }
          `;
          variables.login = effectiveFilter;
          variables.qOwnerOrg = `org:${effectiveFilter} fork:true`;
        } else if (orgs && orgs.length > 0) {
          orgs.forEach((org, index) => {
            const orgVar = `qOrg_${index}`;
            queryArgs.push(`$${orgVar}: String!`);
            queryBody += `
              orgSearch_${index}: search(query: $${orgVar}, type: REPOSITORY, first: $pageLimit) {
                nodes {
                  ... on Repository {
                    name
                    url
                    description
                    isFork
                    parent {
                      name
                      url
                    }
                  }
                }
              }
            `;
            variables[orgVar] = searchKeyword ? `${searchKeyword} org:${org} fork:true` : `org:${org} fork:true`;
          });
        }

        const fullQuery = `query(${queryArgs.join(", ")}) {\n${queryBody}\n}`;

        return this.http
          .post<{ data: any; errors?: any[] }>(GITHUB_GRAPHQL_ENDPOINT, { query: fullQuery, variables }, { headers: this.headers })
          .pipe(
            map(mapOrgSearchResponse),
            catchError((err) => {
              console.error("Error searching GitHub repositories across user, orgs & global", err);
              return of({
                completed: true,
                repositories: [],
                cursor: undefined,
              });
            }),
          );
      }),
    );
  }

  verifyUserAccess(repoUrl: string): Observable<any> {
    const parts = repoUrl.split("/");
    const url = "https://api.github.com/repos/" + parts[3] + "/" + parts[4];
    return this.http.get(url, { headers: this.headers });
  }

  getUserOrganizations(): Observable<string[]> {
    if (this.userOrganizations$) {
      return this.userOrganizations$;
    }
    this.userOrganizations$ = this.http
      .post<{ data?: any; errors?: any[] }>(GITHUB_GRAPHQL_ENDPOINT, { query: GITHUB_USER_ORGANIZATIONS_QUERY }, { headers: this.headers })
      .pipe(
        map((response) => {
          const nodes = response?.data?.viewer?.organizations?.nodes || [];
          return nodes.map((org: any) => org.login).filter(Boolean);
        }),
        catchError((err) => {
          console.error("Error fetching GitHub user organizations", err);
          return of([]);
        }),
        shareReplay(1),
      );
    return this.userOrganizations$;
  }

  private getBatchedRepositories(repoTab: Repository[], startDate?: string, endDate?: string): Observable<Repository[]> {
    const repoInfos = repoTab.map((repo, index) => {
      const parts = repo.url.split("/");
      return {
        alias: `repo${index}`,
        owner: parts[3],
        name: parts[4],
        repository: repo,
      };
    });

    const hasSince = !!startDate;
    const hasUntil = !!endDate;

    let query = "query";
    const queryParams = [];
    if (hasSince) queryParams.push("$since: GitTimestamp!");
    if (hasUntil) queryParams.push("$until: GitTimestamp!");
    if (queryParams.length > 0) {
      query += "(" + queryParams.join(", ") + ")";
    }
    query += " {\n";

    repoInfos.forEach((info) => {
      let historyArgs = "first: 100";
      if (hasSince) historyArgs += ", since: $since";
      if (hasUntil) historyArgs += ", until: $until";

      query += `
        ${info.alias}: repository(owner: "${info.owner}", name: "${info.name}") {
${getCommitHistoryQueryFragment(historyArgs)}
          identity: object(expression: "HEAD:IDENTITY.json") {
            ... on Blob { text }
          }
          readme: object(expression: "HEAD:README.md") {
            ... on Blob { text }
          }
        }
      `;
    });
    query += "}";

    let sinceMoment = startDate ? moment(startDate).toDate().toISOString() : null;
    let untilMoment = endDate ? moment(endDate).toDate().toISOString() : null;

    const variables: any = {};
    if (sinceMoment) variables.since = sinceMoment;
    if (untilMoment) variables.until = untilMoment;

    return this.http.post<{ data?: any; errors?: any[] }>(GITHUB_GRAPHQL_ENDPOINT, { query, variables }, { headers: this.headers }).pipe(
      switchMap((response) => {
        const { results, reposWithNextPage } = applyBatchedRepositoriesResponse(response, repoInfos);

        if (reposWithNextPage.length > 0) {
          return this.fetchRemainingCommits(reposWithNextPage, startDate, endDate).pipe(map(() => results));
        } else {
          return of(results);
        }
      }),
      catchError((error) => {
        if (error?.status === 401 || error?.status === 403) {
          this.githubAuthService.markTokenInvalid();
        }
        console.error("GraphQL batch error", error);
        return of(repoTab);
      }),
    );
  }

  private fetchRemainingCommits(
    reposWithNextPage: {
      repository: Repository;
      owner: string;
      name: string;
      cursor: string;
    }[],
    startDate?: string,
    endDate?: string,
  ): Observable<any> {
    let query = "query($since: GitTimestamp, $until: GitTimestamp) {\n";

    reposWithNextPage.forEach((info, index) => {
      query += `
        repo${index}: repository(owner: "${info.owner}", name: "${info.name}") {
${getCommitHistoryQueryFragment(`first: 100, after: "${info.cursor}", since: $since, until: $until`)}
        }
      `;
    });
    query += "}";

    let sinceMoment = startDate ? moment(startDate).toDate().toISOString() : null;
    let untilMoment = endDate ? moment(endDate).toDate().toISOString() : null;

    const variables: any = {};
    if (sinceMoment) variables.since = sinceMoment;
    if (untilMoment) variables.until = untilMoment;

    return this.http.post<{ data?: any; errors?: any[] }>(GITHUB_GRAPHQL_ENDPOINT, { query, variables }, { headers: this.headers }).pipe(
      switchMap((response) => {
        if (response.errors) {
          console.error("GraphQL fetchRemainingCommits errors:", response.errors);
        }

        const nextReposWithNextPage = [];

        reposWithNextPage.forEach((info, index) => {
          const history = response?.data?.[`repo${index}`]?.defaultBranchRef?.target?.history;
          if (history) {
            const moreCommits = history.nodes.map((node: any) => Commit.withGraphQLJSON(node));
            info.repository.commits.push(...moreCommits);

            if (history.pageInfo.hasNextPage) {
              nextReposWithNextPage.push({
                ...info,
                cursor: history.pageInfo.endCursor,
              });
            }
          }
        });

        if (nextReposWithNextPage.length > 0) {
          return this.fetchRemainingCommits(nextReposWithNextPage, startDate, endDate);
        } else {
          return of(null);
        }
      }),
      catchError((error) => {
        if (error?.status === 401 || error?.status === 403) {
          this.githubAuthService.markTokenInvalid();
        }
        console.error("fetchRemainingCommits batch error", error);
        return of(null);
      }),
    );
  }
}
