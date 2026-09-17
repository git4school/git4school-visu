import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { GitProviderType } from "@models/Account.model";
import { Commit } from "@models/Commit.model";
import { GitDataSearchResult, GitDataService } from "@models/GitDataService.model";
import { Error, ErrorType, Repository } from "@models/Repository.model";
import { TranslateService } from "@ngx-translate/core";
import * as moment from "moment";
import { forkJoin, Observable, of } from "rxjs";
import { catchError, map, shareReplay, switchMap, tap } from "rxjs/operators";
import { GithubAuthService } from "./github-auth.service";
import { Utils } from "./utils";

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

  getRepositoriesByAuthenticatedUser(cursor?: string, pageLimit = 100): Observable<GitDataSearchResult> {
    const query = `
      query($cursor: String, $pageLimit: Int!) {
        viewer {
          repositories(
            first: $pageLimit
            after: $cursor
            affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
            orderBy: { field: CREATED_AT, direction: DESC }
          ) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              name
              url
              description
              isFork
              parent {
                name
                url
              }
              forks(first: 100) {
                nodes {
                  name
                  url
                  description
                  isFork
                }
              }
            }
          }
        }
      }
    `;
    const variables = { cursor, pageLimit };
    return this.http
      .post<{ data: any; errors?: any[] }>("https://api.github.com/graphql", { query, variables }, { headers: this.headers })
      .pipe(
        map((response) => {
          const repositoriesData = response?.data?.viewer?.repositories;
          if (!repositoriesData) {
            return {
              completed: true,
              repositories: [],
              cursor: undefined,
            };
          }

          const reposMap = this.extractRepositoriesFromNodes(repositoriesData.nodes || []);

          return {
            completed: !repositoriesData.pageInfo?.hasNextPage,
            repositories: Array.from(reposMap.values()),
            cursor: repositoriesData.pageInfo?.endCursor,
          };
        }),
        catchError((err) => {
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

      const scopedQuery = `
        query($owner: String!, $name: String!, $qOrg: String!, $pageLimit: Int!, $cursor: String) {
          repository(owner: $owner, name: $name) {
            name
            url
            description
            isFork
            parent {
              name
              url
            }
            forks(first: 100) {
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
          orgSearch: search(query: $qOrg, type: REPOSITORY, first: $pageLimit, after: $cursor) {
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
        }
      `;
      const variables = {
        owner,
        name,
        qOrg,
        pageLimit,
        cursor: cursor || null,
      };
      return this.http
        .post<{ data?: any; errors?: any[] }>(
          "https://api.github.com/graphql",
          { query: scopedQuery, variables },
          { headers: this.headers },
        )
        .pipe(
          map((response) => {
            const reposMap = new Map<string, Repository>();

            if (response?.data) {
              if (response.data.repository) {
                this.extractRepositoriesFromNodes([response.data.repository], reposMap);
              }
              if (response.data.orgSearch?.nodes) {
                this.extractRepositoriesFromNodes(response.data.orgSearch.nodes, reposMap);
              }
            }

            return {
              completed: !response?.data?.orgSearch?.pageInfo?.hasNextPage,
              repositories: Array.from(reposMap.values()),
              cursor: response?.data?.orgSearch?.pageInfo?.endCursor,
            };
          }),
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
      const query = `
        query($queryString: String!, $cursor: String, $pageLimit: Int!) {
          globalSearch: search(query: $queryString, type: REPOSITORY, first: $pageLimit, after: $cursor) {
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
        }
      `;
      const variables = {
        queryString: (searchKeyword ? `${searchKeyword} ` : "") + "fork:true",
        cursor,
        pageLimit,
      };
      return this.http
        .post<{ data: any; errors?: any[] }>("https://api.github.com/graphql", { query, variables }, { headers: this.headers })
        .pipe(
          map((response) => {
            const searchData = response?.data?.globalSearch;
            const reposMap = this.extractRepositoriesFromNodes(searchData?.nodes || []);
            return {
              completed: !searchData?.pageInfo?.hasNextPage,
              repositories: Array.from(reposMap.values()),
              cursor: searchData?.pageInfo?.endCursor,
            };
          }),
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
          .post<{ data: any; errors?: any[] }>("https://api.github.com/graphql", { query: fullQuery, variables }, { headers: this.headers })
          .pipe(
            map((response) => {
              const reposMap = new Map<string, Repository>();

              if (response?.data) {
                Object.keys(response.data).forEach((key) => {
                  const field = response.data[key];
                  if (key === "repositoryOwner") {
                    this.extractRepositoriesFromNodes(field?.repositories?.nodes || [], reposMap);
                  } else if (field?.nodes) {
                    this.extractRepositoriesFromNodes(field.nodes, reposMap);
                  }
                });
              }

              return {
                completed: !response?.data?.globalSearch?.pageInfo?.hasNextPage,
                repositories: Array.from(reposMap.values()),
                cursor: response?.data?.globalSearch?.pageInfo?.endCursor,
              };
            }),
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
    const query = `
      query {
        viewer {
          organizations(first: 100) {
            nodes {
              login
            }
          }
        }
      }
    `;
    this.userOrganizations$ = this.http
      .post<{ data?: any; errors?: any[] }>("https://api.github.com/graphql", { query }, { headers: this.headers })
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
${this.getCommitHistoryQueryFragment(historyArgs)}
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

    return this.http
      .post<{ data?: any; errors?: any[] }>("https://api.github.com/graphql", { query, variables }, { headers: this.headers })
      .pipe(
        switchMap((response) => {
          if (response.errors) {
            console.error("GraphQL reported errors:", response.errors);
          }

          const results: Repository[] = [];
          const reposWithNextPage = [];

          repoInfos.forEach((info) => {
            const repoData = response?.data?.[info.alias];
            if (!repoData) {
              info.repository.errors.push(new Error(ErrorType.COMMITS_NOT_FOUND));
              results.push(info.repository);
              return;
            }

            const identityData = repoData.identity?.text;
            const readmeData = repoData.readme?.text;
            let name = "";
            let tpGroup = "";

            if (identityData) {
              try {
                const identityParsed = JSON.parse(identityData);
                name = Utils.getNameFromIdentity(identityParsed);
                tpGroup = identityParsed.group;
              } catch (e) {}
            } else if (readmeData) {
              name = Utils.getNameFromReadMe(
                readmeData,
                this.translateService.instant("TOKEN-LAST-NAME"),
                this.translateService.instant("TOKEN-FIRST-NAME"),
              );
              tpGroup = Utils.getTPGroupFromReadMe(readmeData);
            }

            const history = repoData.defaultBranchRef?.target?.history;
            let commits = [];
            let hasNextPage = false;
            let endCursor = null;

            if (history) {
              commits = history.nodes.map((node: any) => Commit.withGraphQLJSON(node));
              hasNextPage = history.pageInfo.hasNextPage;
              endCursor = history.pageInfo.endCursor;
            }

            info.repository.commits = commits;
            info.repository.provider = "github";

            if (!info.repository.name) {
              info.repository.name = name || info.repository.getNameFromUrl();
            }
            if (!info.repository.tpGroup) {
              info.repository.tpGroup = tpGroup || Utils.DEFAULT_TP_GROUP;
            }

            results.push(info.repository);

            if (hasNextPage) {
              reposWithNextPage.push({
                repository: info.repository,
                owner: info.owner,
                name: info.name,
                cursor: endCursor,
              });
            }
          });

          if (reposWithNextPage.length > 0) {
            return this.fetchRemainingCommits(reposWithNextPage, startDate, endDate).pipe(map(() => results));
          } else {
            return of(results);
          }
        }),
        catchError((error) => {
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
${this.getCommitHistoryQueryFragment(`first: 100, after: "${info.cursor}", since: $since, until: $until`)}
        }
      `;
    });
    query += "}";

    let sinceMoment = startDate ? moment(startDate).toDate().toISOString() : null;
    let untilMoment = endDate ? moment(endDate).toDate().toISOString() : null;

    const variables: any = {};
    if (sinceMoment) variables.since = sinceMoment;
    if (untilMoment) variables.until = untilMoment;

    return this.http
      .post<{ data?: any; errors?: any[] }>("https://api.github.com/graphql", { query, variables }, { headers: this.headers })
      .pipe(
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
          console.error("fetchRemainingCommits batch error", error);
          return of(null);
        }),
      );
  }

  private extractRepositoriesFromNodes(
    nodes: any[],
    reposMap: Map<string, Repository> = new Map<string, Repository>(),
  ): Map<string, Repository> {
    if (!nodes) return reposMap;

    nodes.forEach((node: any) => {
      if (!node || !node.url) return;

      const parentUrl = node.parent?.url || undefined;
      const isFork = Boolean(node.isFork || parentUrl);

      if (!reposMap.has(node.url)) {
        const repo = new Repository(node.url, node.name, undefined, undefined, undefined, node.description, isFork, parentUrl);
        repo.provider = "github";
        reposMap.set(node.url, repo);
      } else {
        const existing = reposMap.get(node.url);
        if (!existing.parentUrl && parentUrl) {
          existing.parentUrl = parentUrl;
          existing.isFork = true;
        }
      }

      if (node.forks?.nodes) {
        node.forks.nodes.forEach((fork: any) => {
          if (fork && fork.url) {
            if (!reposMap.has(fork.url)) {
              const forkRepo = new Repository(fork.url, fork.name, undefined, undefined, undefined, fork.description, true, node.url);
              forkRepo.provider = "github";
              reposMap.set(fork.url, forkRepo);
            } else {
              const existingFork = reposMap.get(fork.url);
              existingFork.parentUrl = node.url;
              existingFork.isFork = true;
            }
          }
        });
      }
    });

    return reposMap;
  }

  private getCommitHistoryQueryFragment(historyArgs: string): string {
    return `
          defaultBranchRef {
            target {
              ... on Commit {
                history(${historyArgs}) {
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                  nodes {
                    message
                    author {
                      name
                    }
                    committedDate
                    url
                  }
                }
              }
            }
          }`;
  }
}
