import { Injectable } from "@angular/core";
import { GitProviderType } from "@models/Account.model";
import { Commit, CommitColor } from "@models/Commit.model";
import { GitDataSearchResult } from "@models/GitDataService.model";
import { Repository } from "@models/Repository.model";
import { TranslateService } from "@ngx-translate/core";
import { Observable, of } from "rxjs";
import { AccountsService } from "./accounts.service";
import { GitlabDataService } from "./gitlab-data.service";
import { Utils } from "./utils";

/**
 * Façade service retrieving repository data from Git providers (GitHub, GitLab, etc.)
 * and computing graph statistics.
 */
@Injectable({
  providedIn: "root",
})
export class CommitsService {
  constructor(private accountsService: AccountsService, private translateService: TranslateService) {}

  /**
   * Gets readMe and commits of every repository by delegating to the appropriate GitDataService
   * @param repoTab The repositories to get data from
   * @param startDate The date before which commits are not retrieved
   * @param endDate The date after which commits are not retrieved
   */
  getRepositories(repoTab: Repository[], startDate?: string, endDate?: string): Observable<any[]> {
    if (!repoTab || repoTab.length === 0) {
      return of([]);
    }

    const firstRepo = repoTab[0];
    const provider = firstRepo?.provider || "github";
    return this.accountsService.getDataService(provider).getRepositories(repoTab, startDate, endDate);
  }

  /**
   * Fetch authenticated user's repositories from the Git provider
   *
   * @param cursor The cursor of repositories to fetch
   * @param pageLimit The number of repositories to fetch per page
   * @param provider The provider to query ("github" or "gitlab")
   * @param instanceHost The optional instance host for custom gitlab instances
   * @return An object containing the repositories, a boolean indicating if the results are complete and the next cursor
   */
  getRepositoriesByAuthenticatedUser(
    cursor?: string,
    pageLimit = 100,
    provider: GitProviderType = "github",
    instanceHost?: string,
  ): Observable<GitDataSearchResult> {
    const dataService = this.accountsService.getDataService(provider);
    if (provider === "gitlab" && dataService instanceof GitlabDataService) {
      return dataService.getRepositoriesByAuthenticatedUser(cursor, pageLimit, instanceHost);
    }
    return dataService.getRepositoriesByAuthenticatedUser(cursor, pageLimit);
  }

  /**
   * Fetch repositories from the Git provider according to the given search filter
   *
   * @param searchFilter The search filter used to fetch the repositories
   * @param cursor The cursor of repositories to fetch
   * @param pageLimit The number of repositories to fetch per page
   * @param provider The provider to query ("github" or "gitlab")
   * @param instanceHost The optional instance host for custom gitlab instances
   * @return An object containing the repositories, a boolean indicating if the results are complete and the next cursor
   */
  getRepositoriesBySearch(
    searchFilter: string,
    cursor?: string,
    pageLimit = 100,
    provider: GitProviderType = "github",
    instanceHost?: string,
  ): Observable<GitDataSearchResult> {
    const dataService = this.accountsService.getDataService(provider);
    if (provider === "gitlab" && dataService instanceof GitlabDataService) {
      return dataService.getRepositoriesBySearch(searchFilter, cursor, pageLimit, instanceHost);
    }
    return dataService.getRepositoriesBySearch(searchFilter, cursor, pageLimit);
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
  loadQuestionsDict(dict, repositories: Repository[], questions: string[], colors, tpGroup?, date?, translations?): Object {
    let repos = repositories.filter((repository) => !tpGroup || repository.tpGroup === tpGroup);
    repos.forEach((repository) => {
      let studentQuestions = [];
      repository?.commits
        .filter((commit) => !date || commit.commitDate.getTime() < date)
        .forEach((commit) => {
          if (commit.question) {
            let questionKey = commit.question;
            if (!dict[questionKey]) {
              questionKey = questions.find((q) => q.toLowerCase() === commit.question.toLowerCase());
            }
            if (questionKey && dict[questionKey]) {
              let students = [];
              for (let commitColor in dict[questionKey]) {
                students = students.concat(dict[questionKey][commitColor].students.map((student) => student.name));
              }
              if (!students.includes(repository.name) && colors.includes(commit.color)) {
                if (dict[questionKey][commit.color.label]) {
                  dict[questionKey][commit.color.label].count++;
                  dict[questionKey][commit.color.label].students.push({
                    name: repository.name,
                    tpGroup: repository.tpGroup,
                    url: repository.url,
                  });
                }
                studentQuestions.push(questionKey);
              }
            }
          }
        });
      questions.forEach((question) => {
        if (!studentQuestions.includes(question) && dict[question] && dict[question][CommitColor.NOCOMMIT.label]) {
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
      if (dict[question] && typeof dict[question] === "object") {
        for (let commitColor in dict[question]) {
          if (dict[question][commitColor] && typeof dict[question][commitColor] === "object") {
            dict[question][commitColor].percentage = repos.length ? (dict[question][commitColor].count / repos.length) * 100 : 0;
          }
        }
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
        result[color.label] = dict[question]?.[color.label]?.percentage || 0;
        result[color.label + "_data"] = dict[question]?.[color.label] || {
          count: 0,
          percentage: 0,
          students: [],
        };
      });
      return result;
    });
  }

  /**
   * Inits a field for a repository in a map for "students" graph
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
  loadStudentsDict(repositories: Repository[], questions: string[], colors, tpGroup?: string, date?: number): Object {
    let dict = {};
    let repos = repositories.filter((repository) => !tpGroup || repository.tpGroup === tpGroup);
    repos.forEach((repository) => {
      this.initStudentsDict(repository, dict, questions, colors);
      repository.commits
        .filter((commit) => !date || commit.commitDate.getTime() < date)
        .forEach((commit) => {
          if (commit.color?.label && dict[repository.name]?.commitTypes?.[commit.color.label]) {
            dict[repository.name].commitTypes[commit.color.label].commitsCount++;
            dict[repository.name].commitsCount++;
          }
          let q = commit.question;
          if (q && !questions.includes(q)) {
            q = questions.find((canonical) => canonical.toLowerCase() === q.toLowerCase());
          }
          if (q && this.isSupThan(q, dict[repository.name].lastQuestionDone, questions)) {
            dict[repository.name].lastQuestionDone = q;
          }
        });
      dict[repository.name].name = repository.name;
      dict[repository.name].url = repository.url;
      dict[repository.name].tpGroup = repository.tpGroup;
      dict[repository.name].commits = repository.commits.map((commit) => {
        let modifiedCommit = { ...commit };
        modifiedCommit["commitType"] = modifiedCommit.color?.label || "";
        delete modifiedCommit["color"];
        return modifiedCommit;
      });
      colors.forEach((color) => {
        dict[repository.name]["commitTypes"][color.label].percentage = dict[repository.name].commitsCount
          ? (dict[repository.name]["commitTypes"][color.label].commitsCount / dict[repository.name].commitsCount) * 100
          : 0;
      });
    });

    return dict;
  }

  /**
   * Returns the data to use in the "students" graph
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
    return questions.includes(q2) && this.compareQuestions(q1, q2, questions) > 0;
  }

  getNameFromReadMe(readme: string): string {
    return Utils.getNameFromReadMe(
      readme,
      this.translateService.instant("TOKEN-LAST-NAME"),
      this.translateService.instant("TOKEN-FIRST-NAME"),
    );
  }

  getNameFromIdentity(identity: any): string {
    return Utils.getNameFromIdentity(identity);
  }

  getTPGroupFromReadMe(readme: string): string {
    return Utils.getTPGroupFromReadMe(readme);
  }

  getValueWithToken(token: string, text: string): string {
    return Utils.getValueWithToken(token, text);
  }
}
