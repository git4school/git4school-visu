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
        console.log(`[Performance] getRepositories (GraphQL Batched) took ${Math.round(t1 - t0)} ms for ${repoTab.length} repos`);
      })
    );
  }

  private getBatchedRepositories(
    repoTab: Repository[],
    startDate?: string,
    endDate?: string
  ): Observable<any[]> {
    const repoInfos = repoTab.map((repo, index) => {
      const parts = repo.url.split('/');
      return { alias: `repo${index}`, owner: parts[3], name: parts[4], repository: repo };
    });

    const hasSince = !!startDate;
    const hasUntil = !!endDate;

    let query = `query`;
    const queryParams = [];
    if (hasSince) queryParams.push(`$since: GitTimestamp!`);
    if (hasUntil) queryParams.push(`$until: GitTimestamp!`);
    if (queryParams.length > 0) {
      query += `(` + queryParams.join(', ') + `)`;
    }
    query += ` {\n`;

    repoInfos.forEach((info) => {
      let historyArgs = `first: 100`;
      if (hasSince) historyArgs += `, since: $since`;
      if (hasUntil) historyArgs += `, until: $until`;

      query += `
        ${info.alias}: repository(owner: "${info.owner}", name: "${info.name}") {
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
          }
          identity: object(expression: "HEAD:IDENTITY.json") {
            ... on Blob { text }
          }
          readme: object(expression: "HEAD:README.md") {
            ... on Blob { text }
          }
        }
      `;
    });
    query += '}';

    let sinceMoment = startDate ? moment(startDate).toDate().toISOString() : null;
    let untilMoment = endDate ? moment(endDate).toDate().toISOString() : null;

    const variables: any = {};
    if (sinceMoment) variables.since = sinceMoment;
    if (untilMoment) variables.until = untilMoment;

    return this.http
      .post<{ data?: any, errors?: any[] }>('https://api.github.com/graphql', { query, variables }, { headers: this.headers })
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
              commits = history.nodes.map((node) => Commit.withGraphQLJSON(node));
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
              reposWithNextPage.push({ repository: info.repository, owner: info.owner, name: info.name, cursor: endCursor });
            }
          });

          if (reposWithNextPage.length > 0) {
            return this.fetchRemainingCommits(reposWithNextPage, startDate, endDate).pipe(
              map(() => results)
            );
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
    reposWithNextPage: { repository: Repository; owner: string; name: string; cursor: string }[],
    startDate?: string,
    endDate?: string
  ): Observable<any> {
    let query = 'query($since: GitTimestamp, $until: GitTimestamp) {\n';
    
    reposWithNextPage.forEach((info, index) => {
      query += `
        repo${index}: repository(owner: "${info.owner}", name: "${info.name}") {
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 100, after: "${info.cursor}", since: $since, until: $until) {
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
          }
        }
      `;
    });
    query += '}';

    let sinceMoment = startDate ? moment(startDate).toDate().toISOString() : null;
    let untilMoment = endDate ? moment(endDate).toDate().toISOString() : null;

    const variables: any = {};
    if (sinceMoment) variables.since = sinceMoment;
    if (untilMoment) variables.until = untilMoment;

    return this.http
      .post<{ data?: any, errors?: any[] }>('https://api.github.com/graphql', { query, variables }, { headers: this.headers })
      .pipe(
        switchMap((response) => {
          if (response.errors) {
            console.error("GraphQL fetchRemainingCommits errors:", response.errors);
          }

          const nextReposWithNextPage = [];

          reposWithNextPage.forEach((info, index) => {
            const history = response?.data?.[`repo${index}`]?.defaultBranchRef?.target?.history;
            if (history) {
              const moreCommits = history.nodes.map((node) => Commit.withGraphQLJSON(node));
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
   * @param questions The quesitons to handle
   * @returns A map with all the data needed by the "questions-completion" graph
   */
  loadQuestions(dict, colors, questions: string[], translations): any[] {
    let data = [];
    colors.forEach((color) => {
      data.push({
        label: color.label,
        backgroundColor: color.color,
        hoverBackgroundColor: color.color,
        borderColor: "grey",
        data: questions.map((question) => {
          return {
            y: dict[question][color.label].percentage,
            data: dict[question][color.label],
            translations,
          };
        }),
      });
    });

    return data;
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
   * @returns A map with all the data needed by the "students-commits" graph
   */
  loadStudents(dict: Object, colors, translations): any[] {
    let data = [];

    data.push({
      label: "# of commits",
      yAxisID: "C",
      type: "line",
      pointHitRadius: 0,
      fill: false,
      borderWidth: 2,
      datalabels: {
        display: true,
      },
      borderColor: "lightblue",
      hoverBackgroundColor: "lightblue",
      backgroundColor: "lightblue",
      data: Object.entries(dict).map((studentData) => {
        return {
          y: studentData[1]["commitsCount"],
          data: studentData[1],
          translations,
        };
      }),
    });

    data.push({
      label: "Question progression",
      borderColor: "blue",
      type: "line",
      fill: false,
      hitRadius: 0,
      hoverRadius: 0,
      datalabels: {
        display: true,
      },
      yAxisID: "B",
      data: Object.entries(dict).map((studentData) => {
        return {
          y: studentData[1]["lastQuestionDone"],
          data: studentData[1],
        };
      }),
    });

    colors.forEach((color) => {
      data.push({
        label: color.label,
        backgroundColor: color.color,
        hoverBackgroundColor: color.color,
        borderColor: "grey",
        yAxisID: "A",
        data: Object.entries(dict).map((student) => {
          return {
            y: student[1]["commitTypes"][color.label].percentage,
            data: student[1]["commitTypes"][color.label],
            translations,
          };
        }),
      });
    });

    return data;
  }

  /**
   * Compares the level of progress between two questions
   * @returns A number representing the difference in progress between two questions. If the number is positive, q1 is more advanced, otherwise, q2 is more advanced
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
  ): Observable<{ completed: boolean; repositories: Repository[]; cursor?: string }> {
    const query = `
      query($cursor: String, $pageLimit: Int!) {
        viewer {
          repositories(first: $pageLimit, after: $cursor, affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], orderBy: {field: CREATED_AT, direction: DESC}) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              name
              url
            }
          }
        }
      }
    `;
    const variables = { cursor, pageLimit };
    return this.http
      .post<{ data: any }>("https://api.github.com/graphql", { query, variables }, { headers: this.headers })
      .pipe(
        map((response) => {
          const repositoriesData = response.data.viewer.repositories;
          const repositories = repositoriesData.nodes.map(
            (node) => new Repository(node.url, node.name)
          );
          return {
            completed: !repositoriesData.pageInfo.hasNextPage,
            repositories: repositories,
            cursor: repositoriesData.pageInfo.endCursor,
          };
        })
      );
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
  ): Observable<{ completed: boolean; repositories: Repository[]; cursor?: string }> {
    const query = `
      query($queryString: String!, $cursor: String, $pageLimit: Int!) {
        search(query: $queryString, type: REPOSITORY, first: $pageLimit, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            ... on Repository {
              name
              url
            }
          }
        }
      }
    `;
    // We append fork:true because GitHub search excludes forks by default, 
    // which hides many student assignment repositories.
    const variables = { queryString: searchFilter + " fork:true", cursor, pageLimit };
    return this.http
      .post<{ data: any }>("https://api.github.com/graphql", { query, variables }, { headers: this.headers })
      .pipe(
        map((response) => {
          const searchData = response.data.search;
          const repositories = searchData.nodes.map(
            (node) => new Repository(node.url, node.name)
          );
          return {
            completed: !searchData.pageInfo.hasNextPage,
            repositories: repositories,
            cursor: searchData.pageInfo.endCursor,
          };
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


}
