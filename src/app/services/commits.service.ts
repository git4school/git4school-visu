import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Commit, CommitColor } from "@models/Commit.model";
import { Error, ErrorType, Repository } from "@models/Repository.model";
import { TranslateService } from "@ngx-translate/core";
import * as moment from "moment";
import { EMPTY, forkJoin, Observable, of } from "rxjs";
import {
  catchError,
  defaultIfEmpty,
  expand,
  map,
  reduce,
  shareReplay,
  switchMap,
  tap,
} from "rxjs/operators";
import { AuthService } from "./auth.service";
import { Utils } from "./utils";

/**
 * This service retrieves repository data from Github
 */
@Injectable({
  providedIn: "root",
})
export class CommitsService {
  /**
   * Headers to use when sending HTTP requests
   */
  headers = new HttpHeaders({
    "Content-Type": "application/json",
    Authorization: "token " + this.authService.token,
  });

  /**
   * CommitsService constructor
   * @param http
   * @param authService
   * @param translateService
   */
  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private translateService: TranslateService
  ) {}

  /**
   * Gets readMe and commits of every repository
   * @param repoTab The repositories to get data from
   * @param startDate The date before which commits are not retrieved
   * @param endDate The date after which commits are not retrieved
   */
  getRepositories(
    repoTab: Repository[],
    startDate?: string,
    endDate?: string
  ): Observable<any[]> {
    const t0 = performance.now();

    const CHUNK_SIZE = 4;
    const chunks: Repository[][] = [];
    for (let i = 0; i < repoTab.length; i += CHUNK_SIZE) {
      chunks.push(repoTab.slice(i, i + CHUNK_SIZE));
    }

    if (chunks.length === 0) {
      return of([]);
    }

    const chunkObservables = chunks.map((chunk) =>
      this.getBatchedRepositories(chunk, startDate, endDate)
    );

    return forkJoin(chunkObservables).pipe(
      map((results) => results.reduce((acc, val) => acc.concat(val), [])),
      tap(() => {
        const t1 = performance.now();
        console.log(
          `[Performance] getRepositories (GraphQL Batched) took ${Math.round(
            t1 - t0
          )} ms for ${repoTab.length} repos`
        );
      })
    );
  }

  private getBatchedRepositories(
    repoTab: Repository[],
    startDate?: string,
    endDate?: string
  ): Observable<any[]> {
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
        ${info.alias}: repository(owner: "${info.owner}", name: "${
        info.name
      }") {
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

    let sinceMoment = startDate
      ? moment(startDate).toDate().toISOString()
      : null;
    let untilMoment = endDate ? moment(endDate).toDate().toISOString() : null;

    const variables: any = {};
    if (sinceMoment) variables.since = sinceMoment;
    if (untilMoment) variables.until = untilMoment;

    return this.http
      .post<{ data?: any; errors?: any[] }>(
        "https://api.github.com/graphql",
        { query, variables },
        { headers: this.headers }
      )
      .pipe(
        switchMap((response) => {
          if (response.errors) {
            console.error("GraphQL reported errors:", response.errors);
          }

          const results = [];
          const reposWithNextPage = [];

          repoInfos.forEach((info) => {
            const repoData = response?.data?.[info.alias];
            if (!repoData) {
              info.repository.errors.push(
                new Error(ErrorType.COMMITS_NOT_FOUND)
              );
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
                name = this.getNameFromIdentity(identityParsed);
                tpGroup = identityParsed.group;
              } catch (e) {}
            } else if (readmeData) {
              name = this.getNameFromReadMe(readmeData);
              tpGroup = this.getTPGroupFromReadMe(readmeData);
            }

            const history = repoData.defaultBranchRef?.target?.history;
            let commits = [];
            let hasNextPage = false;
            let endCursor = null;

            if (history) {
              commits = history.nodes.map((node) =>
                Commit.withGraphQLJSON(node)
              );
              hasNextPage = history.pageInfo.hasNextPage;
              endCursor = history.pageInfo.endCursor;
            }

            info.repository.commits = commits;

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
            return this.fetchRemainingCommits(
              reposWithNextPage,
              startDate,
              endDate
            ).pipe(map(() => results));
          } else {
            return of(results);
          }
        }),
        catchError((error) => {
          console.error("GraphQL batch error", error);
          return of(repoTab);
        })
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
    endDate?: string
  ): Observable<any> {
    let query = "query($since: GitTimestamp, $until: GitTimestamp) {\n";

    reposWithNextPage.forEach((info, index) => {
      query += `
        repo${index}: repository(owner: "${info.owner}", name: "${info.name}") {
${this.getCommitHistoryQueryFragment(
  `first: 100, after: "${info.cursor}", since: $since, until: $until`
)}
        }
      `;
    });
    query += "}";

    let sinceMoment = startDate
      ? moment(startDate).toDate().toISOString()
      : null;
    let untilMoment = endDate ? moment(endDate).toDate().toISOString() : null;

    const variables: any = {};
    if (sinceMoment) variables.since = sinceMoment;
    if (untilMoment) variables.until = untilMoment;

    return this.http
      .post<{ data?: any; errors?: any[] }>(
        "https://api.github.com/graphql",
        { query, variables },
        { headers: this.headers }
      )
      .pipe(
        switchMap((response) => {
          if (response.errors) {
            console.error(
              "GraphQL fetchRemainingCommits errors:",
              response.errors
            );
          }

          const nextReposWithNextPage = [];

          reposWithNextPage.forEach((info, index) => {
            const history =
              response?.data?.[`repo${index}`]?.defaultBranchRef?.target
                ?.history;
            if (history) {
              const moreCommits = history.nodes.map((node) =>
                Commit.withGraphQLJSON(node)
              );
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
            return this.fetchRemainingCommits(
              nextReposWithNextPage,
              startDate,
              endDate
            );
          } else {
            return of(null);
          }
        }),
        catchError((error) => {
          console.error("fetchRemainingCommits batch error", error);
          return of(null);
        })
      );
  }

  /**
   * Inits a map for "questions-completion" graph
   * @param questions The questions to handle
   * @param colors The commit colors to handle
   * @returns A map ready for to receive data about questions
   */
  initQuestionsDict(questions: string[], colors): Object {
    let dict = {};
    questions.forEach((question) => {
      dict[question] = {};
      colors.forEach((color) => {
        dict[question][color.label] = {
          count: 0,
          percentage: 0,
          students: [],
        };
      });
    });

    return dict;
  }

  /**
   * Returns a map containing data about questions
   * @param dict The initialized map to update with data
   * @param repositories The repositories to handle
   * @param questions The questions to handle
   * @param colors The commit colors to handle
   * @param tpGroup The tp group to filter the repositories with if specified
   * @param date The date to filter the commits with if specified
   * @returns A map with data about questions
   */
  loadQuestionsDict(
    dict,
    repositories: Repository[],
    questions: string[],
    colors,
    tpGroup?,
    date?,
    translations?
  ): Object {
    let repos = repositories.filter(
      (repository) => !tpGroup || repository.tpGroup === tpGroup
    );
    repos.forEach((repository) => {
      let studentQuestions = [];
      repository?.commits
        .filter((commit) => !date || commit.commitDate.getTime() < date)
        .forEach((commit) => {
          if (commit.question) {
            let students = [];
            for (let commitColor in dict[commit.question]) {
              students = students.concat(
                dict[commit.question][commitColor].students.map(
                  (student) => student.name
                )
              );
            }
            if (
              !students.includes(repository.name) &&
              colors.includes(commit.color)
            ) {
              dict[commit.question][commit.color.label].count++;
              dict[commit.question][commit.color.label].students.push({
                name: repository.name,
                tpGroup: repository.tpGroup,
                url: repository.url,
              });
              studentQuestions.push(commit.question);
            }
          }
        });
      questions.forEach((question) => {
        if (!studentQuestions.includes(question)) {
          dict[question][CommitColor.NOCOMMIT.label].count++;
          dict[question][CommitColor.NOCOMMIT.label].students.push({
            name: repository.name,
            tpGroup: repository.tpGroup,
            url: repository.url,
          });
        }
      });
    });
    for (let question in dict) {
      for (let commitColor in dict[question]) {
        dict[question][commitColor].percentage =
          (dict[question][commitColor].count / repos.length) * 100;
      }
    }

    dict.translations = translations;

    return dict;
  }

  /**
   * Returns the data to use in the "questions-completion" graph
   * @param dict The data about questions
   * @param colors The commit colors to handle
   * @param questions The questions to handle
   * @returns An array of objects optimized for D3 stacking
   */
  loadQuestions(dict, colors, questions: string[], translations): any[] {
    return questions.map((question) => {
      let result: any = {
        question: question,
        translations: translations,
      };
      colors.forEach((color) => {
        result[color.label] = dict[question][color.label].percentage;
        result[color.label + "_data"] = dict[question][color.label];
      });
      return result;
    });
  }

  /**
   * Inits a field for a repository in a map for "students-commits" graph
   * @param repository The repository to handle
   * @param dict The map to update
   * @param questions The questions to handle
   * @param colors The commit colors to handle
   */
  initStudentsDict(repository: Repository, dict, questions: string[], colors) {
    dict[repository.name] = {
      commitTypes: {},
      lastQuestionDone: questions[0],
      commitsCount: 0,
    };
    colors.forEach((color) => {
      dict[repository.name]["commitTypes"][color.label] = {
        commitsCount: 0,
      };
    });
  }

  /**
   * Returns a map containing data about students commits
   * @param repositories The repositories to handle
   * @param questions The questions to handle
   * @param colors The commit colors to handle
   * @param tpGroup The tp group to filter the repositories with if specified
   * @param date The date to filter the commits with if specified
   * @returns A map with data about students commits
   */
  loadStudentsDict(
    repositories: Repository[],
    questions: string[],
    colors,
    tpGroup?: string,
    date?: number
  ): Object {
    let dict = {};
    let repos = repositories.filter(
      (repository) => !tpGroup || repository.tpGroup === tpGroup
    );
    repos.forEach((repository) => {
      this.initStudentsDict(repository, dict, questions, colors);
      repository.commits
        .filter((commit) => !date || commit.commitDate.getTime() < date)
        .forEach((commit) => {
          dict[repository.name]["commitTypes"][commit.color.label]
            .commitsCount++;
          dict[repository.name].commitsCount++;
          this.isSupThan(
            commit.question,
            dict[repository.name].lastQuestionDone,
            questions
          ) && (dict[repository.name].lastQuestionDone = commit.question);
        });
      dict[repository.name].name = repository.name;
      dict[repository.name].url = repository.url;
      dict[repository.name].tpGroup = repository.tpGroup;
      dict[repository.name].commits = repository.commits.map((commit) => {
        let modifiedCommit = { ...commit };
        modifiedCommit["commitType"] = modifiedCommit.color.label;
        delete modifiedCommit["color"];
        return modifiedCommit;
      });
      colors.forEach((color) => {
        dict[repository.name]["commitTypes"][color.label].percentage = dict[
          repository.name
        ].commitsCount
          ? (dict[repository.name]["commitTypes"][color.label].commitsCount /
              dict[repository.name].commitsCount) *
            100
          : 0;
      });
    });

    return dict;
  }

  /**
   * Returns the data to use in the "students-commits" graph
   * @param dict The data about students
   * @param colors The commit colors to handle
   * @returns An array of objects optimized for D3 graphing
   */
  loadStudents(dict: Object, colors, translations): any[] {
    return Object.values(dict).map((studentData: any) => {
      let result: any = {
        student: studentData.name,
        commitsCount: studentData.commitsCount,
        lastQuestionDone: studentData.lastQuestionDone,
        url: studentData.url,
        tpGroup: studentData.tpGroup,
        translations: translations,
      };
      colors.forEach((color) => {
        result[color.label] = studentData.commitTypes[color.label].percentage;
        result[color.label + "_data"] = studentData.commitTypes[color.label];
      });
      return result;
    });
  }

  /**
   * Compares the level of progress between two questions
   * @returns A number representing the difference in progress between two questions.
   * If the number is positive, q1 is more advanced, otherwise, q2 is more advanced
   */
  compareQuestions(q1, q2, questions): number {
    return questions.indexOf(q1) - questions.indexOf(q2);
  }

  /**
   * Indicates if q1 is more advanced than q2, if they are both included in questions array
   * @returns A boolean, which is true if q1 is a more advanced question than q2, false otherwise
   */
  isSupThan(q1, q2, questions): boolean {
    return (
      questions.includes(q2) && this.compareQuestions(q1, q2, questions) > 0
    );
  }

  /**
   * Fetch authenticated user's repositories from Github
   *
   * @param cursor The cursor of repositories to fetch
   * @param pageLimit The number of repositories to fetch per page
   * @return An object containing the repositories, a boolean indicating if the results are complete and the next cursor
   */
  getRepositoriesByAuthenticatedUser(
    cursor?: string,
    pageLimit = 100
  ): Observable<{
    completed: boolean;
    repositories: Repository[];
    cursor?: string;
  }> {
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
      .post<{ data: any; errors?: any[] }>(
        "https://api.github.com/graphql",
        { query, variables },
        { headers: this.headers }
      )
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

          const reposMap = this.extractRepositoriesFromNodes(
            repositoriesData.nodes || []
          );

          return {
            completed: !repositoriesData.pageInfo?.hasNextPage,
            repositories: Array.from(reposMap.values()),
            cursor: repositoriesData.pageInfo?.endCursor,
          };
        }),
        catchError((err) => {
          console.error("Error fetching authenticated user repositories", err);
          return of({
            completed: true,
            repositories: [],
            cursor: undefined,
          });
        })
      );
  }

  private userOrganizations$: Observable<string[]> = null;

  /**
   * Fetch organizations the authenticated user belongs to (cached)
   */
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
      .post<{ data?: any; errors?: any[] }>(
        "https://api.github.com/graphql",
        { query },
        { headers: this.headers }
      )
      .pipe(
        map((response) => {
          const nodes = response?.data?.viewer?.organizations?.nodes || [];
          return nodes.map((org: any) => org.login).filter(Boolean);
        }),
        catchError((err) => {
          console.error("Error fetching user organizations", err);
          return of([]);
        }),
        shareReplay(1)
      );
    return this.userOrganizations$;
  }

  /**
   * Helper to extract repositories and forks from GraphQL response nodes into a Map
   */
  private extractRepositoriesFromNodes(
    nodes: any[],
    reposMap: Map<string, Repository> = new Map<string, Repository>()
  ): Map<string, Repository> {
    if (!nodes) return reposMap;

    nodes.forEach((node: any) => {
      if (!node || !node.url) return;

      const parentUrl = node.parent?.url || undefined;
      const isFork = Boolean(node.isFork || parentUrl);

      if (!reposMap.has(node.url)) {
        reposMap.set(
          node.url,
          new Repository(
            node.url,
            node.name,
            undefined,
            undefined,
            undefined,
            node.description,
            isFork,
            parentUrl
          )
        );
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
              reposMap.set(
                fork.url,
                new Repository(
                  fork.url,
                  fork.name,
                  undefined,
                  undefined,
                  undefined,
                  fork.description,
                  true,
                  node.url
                )
              );
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

  /**
   * Fetch repositories from Github according to the given search filter
   *
   * @param searchFilter The search filter used to fetch the repositories
   * @param cursor The cursor of repositories to fetch
   * @param pageLimit The number of repositories to fetch per page
   * @return An object containing the repositories, a boolean indicating if the results are complete and the next cursor
   */
  getRepositoriesBySearch(
    searchFilter: string,
    cursor?: string,
    pageLimit = 100
  ): Observable<{
    completed: boolean;
    repositories: Repository[];
    cursor?: string;
  }> {
    const cleanFilter = searchFilter ? searchFilter.trim() : "";
    if (!cleanFilter) {
      return this.getRepositoriesByAuthenticatedUser(cursor, pageLimit);
    }

    // 1. Check if the searchFilter is an organization URL (e.g. https://github.com/UE-TOAW or https://github.com/UE-TOAW/)
    const orgUrlMatch = cleanFilter.match(
      /^(?:https?:\/\/github\.com\/|git@github\.com:)([a-zA-Z0-9_.-]+)\/?$/i
    );
    let effectiveFilter = cleanFilter;
    if (orgUrlMatch) {
      effectiveFilter = orgUrlMatch[1];
    }

    // 2. Check if searchFilter is a repository URL or an "owner/name" pattern
    // (e.g. "https://github.com/UE-TOAW/repo" or "UE-TOAW/tp-m2sdl-2024-friendsofmine-")
    const repoMatch = effectiveFilter.match(
      /^(?:https?:\/\/github\.com\/|git@github\.com:|^)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/)?$/i
    );

    if (repoMatch) {
      const owner = repoMatch[1];
      const name = repoMatch[2];
      const corePattern = Utils.extractAssignmentCore(name, owner);
      const qOrg = corePattern
        ? `${corePattern} org:${owner} fork:true`
        : `org:${owner} fork:true`;

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
          { headers: this.headers }
        )
        .pipe(
          map((response) => {
            const reposMap = new Map<string, Repository>();

            if (response?.data) {
              // 1. Direct match repository is added FIRST
              if (response.data.repository) {
                this.extractRepositoriesFromNodes(
                  [response.data.repository],
                  reposMap
                );
              }
              // 2. Organization search matches (e.g. all student repos in that org)
              if (response.data.orgSearch?.nodes) {
                this.extractRepositoriesFromNodes(
                  response.data.orgSearch.nodes,
                  reposMap
                );
              }
            }

            return {
              completed: !response?.data?.orgSearch?.pageInfo?.hasNextPage,
              repositories: Array.from(reposMap.values()),
              cursor: response?.data?.orgSearch?.pageInfo?.endCursor,
            };
          }),
          catchError((err) => {
            console.error("Error searching owner/name repositories", err);
            return of({
              completed: true,
              repositories: [],
              cursor: undefined,
            });
          })
        );
    }

    // If cursor is provided for subsequent pages, query globalSearch with after cursor
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
        .post<{ data: any; errors?: any[] }>(
          "https://api.github.com/graphql",
          { query, variables },
          { headers: this.headers }
        )
        .pipe(
          map((response) => {
            const searchData = response?.data?.globalSearch;
            const reposMap = this.extractRepositoriesFromNodes(
              searchData?.nodes || []
            );
            return {
              completed: !searchData?.pageInfo?.hasNextPage,
              repositories: Array.from(reposMap.values()),
              cursor: searchData?.pageInfo?.endCursor,
            };
          }),
          catchError((err) => {
            console.error("Error searching repositories (page)", err);
            return of({
              completed: true,
              repositories: [],
              cursor: undefined,
            });
          })
        );
    }

    // 3. Free text search / Organization name: scope to authenticated user, accessible organizations and global repositories
    return this.getUserOrganizations().pipe(
      switchMap((orgs) => {
        const isUserOrg =
          orgs &&
          orgs.some((o) => o.toLowerCase() === effectiveFilter.toLowerCase());

        const cleanTerm = effectiveFilter.replace(/[-_]+$/, "");
        const coreTerm = Utils.extractAssignmentCore(cleanTerm);
        const searchKeyword = coreTerm || cleanTerm;

        const queryArgs = [
          "$qGlobal: String!",
          "$qUser: String!",
          "$pageLimit: Int!",
        ];
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
          qUser: searchKeyword
            ? `${searchKeyword} user:@me fork:true`
            : "user:@me fork:true",
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
          // Search each of the user's accessible organizations for this partial keyword
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
            variables[orgVar] = searchKeyword
              ? `${searchKeyword} org:${org} fork:true`
              : `org:${org} fork:true`;
          });
        }

        const fullQuery = `query(${queryArgs.join(", ")}) {\n${queryBody}\n}`;

        return this.http
          .post<{ data: any; errors?: any[] }>(
            "https://api.github.com/graphql",
            { query: fullQuery, variables },
            { headers: this.headers }
          )
          .pipe(
            map((response) => {
              const reposMap = new Map<string, Repository>();

              if (response?.data) {
                Object.keys(response.data).forEach((key) => {
                  const field = response.data[key];
                  if (key === "repositoryOwner") {
                    this.extractRepositoriesFromNodes(
                      field?.repositories?.nodes || [],
                      reposMap
                    );
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
              console.error(
                "Error searching repositories across user, orgs & global",
                err
              );
              return of({
                completed: true,
                repositories: [],
                cursor: undefined,
              });
            })
          );
      })
    );
  }

  getNameFromReadMe(readme: string): string {
    if (!readme) {
      return null;
    }
    let lastNameToken = this.translateService.instant("TOKEN-LAST-NAME");
    let firstNameToken = this.translateService.instant("TOKEN-FIRST-NAME");
    let lastName = this.getValueWithToken(`${lastNameToken}.*:`, readme);
    let firstName = this.getValueWithToken(`${firstNameToken}.*:`, readme);
    return [lastName, firstName].filter(Boolean).join(" ");
  }

  getNameFromIdentity(identity: any): string {
    return [identity.last_name, identity.first_name].filter(Boolean).join(" ");
  }

  getTPGroupFromReadMe(readme: string): string {
    if (!readme) {
      return null;
    }
    let tpGroup = this.getValueWithToken("-\\s*\\[\\S\\]", readme);
    return tpGroup;
  }

  getValueWithToken(token: string, text: string): string {
    let regex = new RegExp(`(?<=${token}).*`);
    let value = text.match(regex);
    return value ? value[0].trim() : null;
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
