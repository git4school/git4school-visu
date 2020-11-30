import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Commit, CommitColor } from "@models/Commit.model";
import { Error, ErrorType, Repository } from "@models/Repository.model";
import { TranslateService } from "@ngx-translate/core";
import * as moment from "moment";
import { forkJoin, Observable, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { AuthService } from "./auth.service";

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
    const tab = [];
    repoTab.forEach((repository) => {
      tab.push(
        this.getRepository(repository.url, startDate, endDate).pipe(
          map(([readMeData, commitsData]) => {
            repository.errors = [];
            let readme;
            if (commitsData.errors) {
              repository.errors.push(new Error(ErrorType.COMMITS_NOT_FOUND));
            } else {
              repository.commits = commitsData.commits;
            }

            if (readMeData.errors) {
              repository.errors.push(new Error(ErrorType.README_NOT_FOUND));
            } else {
              readme = {
                name: this.getNameFromReadMe(readMeData.readme),
                tpGroup: this.getTPGroupFromReadMe(readMeData.readme),
              };

              if (!readme.name) {
                repository.errors.push(
                  new Error(ErrorType.README_NAME_NOT_FOUND)
                );
              }
              if (!readme.tpGroup) {
                repository.errors.push(
                  new Error(ErrorType.README_TPGROUP_NOT_FOUND)
                );
              }
            }

            if (!repository.name) {
              repository.name = readme?.name || repository.getNameFromUrl();
            }
            if (!repository.tpGroup) {
              repository.tpGroup = readme?.tpGroup;
            }

            return repository;
          })
        )
      );
    });
    return forkJoin(tab);
  }

  /**
   * Gets the readMe and commits for a given repository
   * @param repo The repository from which data is retrieved
   * @param startDate The date before which commits are not retrieved
   * @param endDate The date after which commits are not retrieved
   */
  getRepository(
    repoUrl: string,
    startDate?: string,
    endDate?: string
  ): Observable<any[]> {
    return forkJoin([
      this.getReadMe(repoUrl),
      this.getCommits(repoUrl, startDate, endDate),
    ]);
  }

  getCommits(
    repoUrl: string,
    startDate?: string,
    endDate?: string
  ): Observable<any[] | any> {
    return this.getRawCommits(repoUrl, startDate, endDate).pipe(
      map((commitsData) => {
        const commits = commitsData.map((commitData) =>
          Commit.withJSON(commitData)
        );
        return {
          errors: false,
          commits: commits,
          message: null,
        };
      }),
      catchError((error) =>
        of({
          errors: true,
          commits: null,
          message: this.translateService.instant(
            "ERROR-MESSAGE-COMMITS-NOT-FOUND",
            { repo: repoUrl }
          ),
        })
      )
    );
  }

  /**
   * Gets the commits for a given repository and updates it
   * @param repo The repository from which the commits are retrieved
   * @param startDate The date before which commits are not retrieved
   * @param endDate The date after which commits are not retrieved
   */
  getRawCommits(
    repoUrl: string,
    startDate?: string,
    endDate?: string
  ): Observable<any[]> {
    const repoHashURL = repoUrl.split("/");
    let url =
      "https://api.github.com/repos/" +
      repoHashURL[3] +
      "/" +
      repoHashURL[4] +
      "/commits?per_page=100";
    if (startDate) {
      let startDateMoment = moment(startDate).toDate();
      url = url.concat("&since=" + startDateMoment.toISOString());
    }
    if (endDate) {
      let endDateMoment = moment(endDate).toDate();
      url = url.concat("&until=" + endDateMoment.toISOString());
    }
    return this.http.get<any[]>(url, { headers: this.headers });
  }

  getReadMe(repoUrl: string): Observable<any> {
    return this.getRawReadMe(repoUrl).pipe(
      map((rawReadme) => {
        let readme = decodeURIComponent(
          escape(window.atob(rawReadme["content"]))
        );

        return {
          errors: false,
          readme: readme,
          message: null,
        };
      }),
      catchError((error) =>
        of({
          errors: true,
          readme: null,
          message: this.translateService.instant(
            "ERROR-MESSAGE-README-NOT-FOUND",
            { repo: repoUrl }
          ),
        })
      )
    );
  }

  /**
   * Retrieves the readMe for a given repository
   * @param repo The repository from which the readMe is retrieved
   */
  getRawReadMe(repoUrl: string): Observable<any> {
    const tabHashURL = repoUrl.split("/");
    const url =
      "https://api.github.com/repos/" +
      tabHashURL[3] +
      "/" +
      tabHashURL[4] +
      "/readme";
    return this.http.get(url, { headers: this.headers });
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
   * Process the raw Github response to return the repositories and the boolean indicating whether the page was the last or not
   *
   * @param rawRepositories Raw repositories with a JSON format
   * @param headers Headers including "link" that we use to determine we just fetched the last page
   */
  private processRawResponse(
    rawRepositories,
    headers
  ): { completed: boolean; repositories: Repository[] } {
    const array = rawRepositories.map(
      (data) => new Repository(data["html_url"], data["name"])
    );
    return {
      completed: !headers?.get("link")?.match(/rel=\"last\"/),
      repositories: array,
    };
  }

  /**
   * Fetch authenticated user's repositories from Github
   *
   * @param {number} page The page of repositories to fetch
   * @param {number} pageLimit The number of repositories to fetch per page
   * @return {Observable<{ completed: boolean, repositories: Repository[] }} An object containing the repositories and a boolean indicating if the results are complete
   */
  getRepositoriesByAuthenticatedUser(
    page = 1,
    pageLimit = 100
  ): Observable<{ completed: boolean; repositories: Repository[] }> {
    let url = `https://api.github.com/user/repos?per_page=${pageLimit}&page=${page}&sort=created`;
    return this.http
      .get<any[]>(url, {
        headers: this.headers,
        observe: "response",
      })
      .pipe(
        map((response) => {
          return this.processRawResponse(response.body, response.headers);
        })
      );
  }

  /**
   * Fetch repositories from Github according to the given search filter
   *
   * @param {string} searchFilter The search filter used to fetch the repositories
   * @param {number} page The page of repositories to fetch
   * @param {number} pageLimit The number of repositories to fetch per page
   * @return {Observable<{ completed: boolean, repositories: Repository[] }} An object containing the repositories and a boolean indicating if the results are complete
   */
  getRepositoriesBySearch(
    searchFilter: string,
    page = 1,
    pageLimit = 100
  ): Observable<{ completed: boolean; repositories: Repository[] }> {
    let url = `https://api.github.com/search/repositories?q=${searchFilter}&per_page=${pageLimit}&page=${page}`;
    return this.http
      .get<{ items: any[]; incomplete_results: boolean }>(url, {
        headers: this.headers,
        observe: "response",
      })
      .pipe(
        map((response) => {
          return this.processRawResponse(response.body.items, response.headers);
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
