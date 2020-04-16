import {Injectable} from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpErrorResponse
} from '@angular/common/http';
import {AuthService} from './auth.service';
import {Observable, of} from 'rxjs';
import {map, catchError} from 'rxjs/operators';
import {forkJoin} from 'rxjs';
import moment from 'moment/src/moment';
import {CommitColor} from '@models/Commit.model';
import {Commit} from '@models/Commit.model';
import {Repository} from '@models/Repository.model';
import {TranslateService} from '@ngx-translate/core';

/**
 * This service retrieves repository data from Github
 */
@Injectable({
  providedIn: 'root'
})
export class CommitsService {
  /**
   * Options to use when sending HTTP requests
   */
  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: 'token ' + this.authService.token
    })
  };

  /**
   * CommitsService constructor
   * @param http
   * @param authService
   * @param translate
   */
  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private translate: TranslateService
  ) {
  }

  /**
   * Gets readMe and commits of every repository
   * @param repoTab The repositories to get data from
   * @param startDate The date before which commits are not retrieved
   * @param endDate The date after which commits are not retrieved
   */
  getRepositories(
    repoTab,
    startDate?: String,
    endDate?: String
  ): Observable<any[]> {
    const tab = [];
    repoTab.forEach(repo => {
      tab.push(this.getRepository(repo, startDate, endDate));
    });
    return forkJoin(tab);
  }

  /**
   * Updates repository name, tp group and commits from raw response from Github
   * @param repo The repository to update
   * @param response The response from Github
   * @param translations The translations to use if an error occurs
   */
  getRepositoryFromRaw(repo, response, translations) {
    let tab;

    if (response[1] instanceof HttpErrorResponse) {
      throw new Error(translations['ERRORS.REPOSITORY-NOT-FOUND'] +
        ' : ' +
        repo.url +
        '<br><i>' +
        translations['ERRORS.DETAILS'] +
        ': ' +
        response[1].message +
        '</i>');
    }

    if (!repo.name || !repo.tpGroup) {
      if (response[0] instanceof HttpErrorResponse) {
        throw new Error(translations['ERRORS.README-NOT-FOUND'] +
          ' : ' +
          repo.url +
          '<br><i>' +
          translations['ERRORS.DETAILS'] +
          ': ' +
          response[0].message +
          '</i>');
      }

      const readme = decodeURIComponent(
        escape(window.atob(response[0].content))
      );
      tab = readme
        .split(/(### NOM :)|(### Prénom :)|(### Groupe de TP :)|\n/g)
        .filter(values => Boolean(values) === true);
    }

    if (!repo.name) {
      if (!tab[4] || !tab[2]) {
        const repoName = repo.url.split('/');
        repo.name = repoName[4];
      } else {
        repo.name = tab[4].trim() + ' ' + tab[2].trim();
      }
    }
    if (!repo.tpGroup && tab[6]) {
      repo.tpGroup = tab[6].trim();
    }

    repo.commits = response[1];
  }

  /**
   * Gets the readMe and commits for a given repository
   * @param repo The repository from which data is retrieved
   * @param startDate The date before which commits are not retrieved
   * @param endDate The date after which commits are not retrieved
   */
  getRepository(
    repo: Repository,
    startDate?: String,
    endDate?: String
  ): Observable<any[]> {
    return forkJoin(
      this.getReadMe(repo).pipe(catchError(error => of(error))),
      this.getCommits(repo, startDate, endDate).pipe(
        catchError(error => of(error))
      )
    );
  }

  /**
   * Gets the commits for a given repository and updates it
   * @param repo The repository from which the commits are retrieved
   * @param startDate The date before which commits are not retrieved
   * @param endDate The date after which commits are not retrieved
   */
  getCommits(repo: Repository, startDate?, endDate?): Observable<Commit[]> {
    const repoHashURL = repo.url.split('/');
    let url =
      'https://api.github.com/repos/' +
      repoHashURL[3] +
      '/' +
      repoHashURL[4] +
      '/commits?per_page=100';
    if (startDate) {
      startDate = moment(startDate).toDate();
      url = url.concat('&since=' + startDate.toISOString());
    }
    if (endDate) {
      endDate = moment(endDate).toDate();
      url = url.concat('&until=' + endDate.toISOString());
    }
    return this.http.get<Commit[]>(url, this.httpOptions).pipe(
      map(response => {
        //
        const array = response.map(data => Commit.withJSON(data));
        //
        return array;
      })
    );
  }

  /**
   * Retrieves the readMe for a given repository
   * @param repo The repository from which the readMe is retrieved
   */
  getReadMe(repo: Repository): Observable<any> {
    const tabHashURL = repo.url.split('/');
    const url =
      'https://api.github.com/repos/' +
      tabHashURL[3] +
      '/' +
      tabHashURL[4] +
      '/readme';
    return this.http.get(url, this.httpOptions);
  }

  /**
   * Inits a map for "questions-completion" graph
   * @param questions The questions to handle
   * @param colors The commit colors to handle
   * @returns A map ready for to receive data about questions
   */
  initQuestionsDict(questions: string[], colors): Object {
    const dict = {};
    questions.forEach(question => {
      dict[question] = {};
      colors.forEach(color => {
        dict[question][color.label] = {
          count: 0,
          percentage: 0,
          students: []
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
    repositories,
    questions: string[],
    colors,
    tpGroup?,
    date?,
    translations?
  ): Object {
    const repos = repositories.filter(
      repository => !tpGroup || repository.tpGroup === tpGroup
    );
    repos.forEach(repository => {
      const studentQuestions = [];
      repository.commits
        .filter(commit => !date || commit.commitDate.getTime() < date)
        .forEach(commit => {
          if (commit.question) {
            let students = [];
            for (const commitColor in dict[commit.question]) {
              students = students.concat(
                dict[commit.question][commitColor].students.map(
                  student => student.name
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
                url: repository.url
              });
              studentQuestions.push(commit.question);
            }
          }
        });
      questions.forEach(question => {
        if (!studentQuestions.includes(question)) {
          dict[question][CommitColor.NOCOMMIT.label].count++;
          dict[question][CommitColor.NOCOMMIT.label].students.push({
            name: repository.name,
            tpGroup: repository.tpGroup,
            url: repository.url
          });
        }
      });
    });
    for (const question in dict) {
      for (const commitColor in dict[question]) {
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
    const data = [];
    colors.forEach(color => {
      data.push({
        label: color.label,
        backgroundColor: color.color,
        hoverBackgroundColor: color.color,
        borderColor: 'grey',
        data: questions.map(question => {
          return {
            y: dict[question][color.label].percentage,
            data: dict[question][color.label],
            translations
          };
        })
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
  initStudentsDict(course: string,
                   program: string,
                   year: string,
                   repository: Repository,
                   dict,
                   questions: string[],
                   colors) {
    dict[repository.name] = {
      name: repository.name,
      course: course,
      program: program,
      year: year,
      // commitTypes: {},
      lastQuestionDone: questions[0],
      commitsClotureCount: 0,
      commitsCount: 0
    };
    // colors.forEach(color => {
    //   dict[repository.name].commitTypes[color.label] = {
    //     commitsCount: 0
    //   };
    // });
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
    course: string,
    program: string,
    year: string,
    repositories: Repository[],
    questions: string[],
    colors,
    tpGroup?: string,
    date?: number
  ): Object {
    const dict = {};
    const repos = repositories.filter(
      repository => !tpGroup || repository.tpGroup === tpGroup
    );
    repos.forEach(repository => {
      this.initStudentsDict(course, program, year, repository, dict, questions, colors);
      repository.commits
        .filter(commit => !date || commit.commitDate.getTime() < date)
        .forEach(commit => {
          if(commit.isCloture) dict[repository.name].commitsClotureCount++;
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
      // dict[repository.name].commits = repository.commits.map(commit => {
      //   const modifiedCommit = {...commit};
      //   modifiedCommit.commitType = modifiedCommit.color.label;
      //   delete modifiedCommit.color;
      //   return modifiedCommit;
      // });
      // colors.forEach(color => {
      //   dict[repository.name].commitTypes[color.label].percentage = dict[
      //     repository.name
      //     ].commitsCount
      //     ? (dict[repository.name].commitTypes[color.label].commitsCount /
      //     dict[repository.name].commitsCount) *
      //     100
      //     : 0;
      // });
    });

    return dict;
  }

  /**
   * Returns a list containing data about students commits
   * @param repositories The repositories to handle
   * @param questions The questions to handle
   * @param colors The commit colors to handle
   * @param tpGroup The tp group to filter the repositories with if specified
   * @param date The date to filter the commits with if specified
   * @returns A list with data about students commits
   */
  loadStudentsList(
    course: string,
    program: string,
    year: string,
    repositories: Repository[],
    questions: string[],
    colors,
    tpGroup?: string,
    date?: number
  ): any[] {
    const dict = this.loadStudentsDict(
      course,
      program,
      year,
      repositories,
      questions,
      colors,
      tpGroup,
      date
    )
    return Object.keys(dict).map(key => dict[key])
  }


  /**
   * Returns the data to use in the "students-commits" graph
   * @param dict The data about students
   * @param colors The commit colors to handle
   * @returns A map with all the data needed by the "students-commits" graph
   */
  loadStudents(dict: Object, colors, translations): any[] {
    console.log('dict: ', dict);
    const data = [];

    data.push({
      label: '# of commits',
      yAxisID: 'C',
      type: 'line',
      pointHitRadius: 0,
      fill: false,
      borderWidth: 2,
      datalabels: {
        display: true
      },
      borderColor: 'lightblue',
      hoverBackgroundColor: 'lightblue',
      backgroundColor: 'lightblue',
      data: Object.entries(dict).map(studentData => {
        return {
          y: studentData[1].commitsCount,
          data: studentData[1],
          translations
        };
      })
    });

    data.push({
      label: 'Question progression',
      borderColor: 'blue',
      type: 'line',
      fill: false,
      hitRadius: 0,
      hoverRadius: 0,
      datalabels: {
        display: true
      },
      yAxisID: 'B',
      data: Object.entries(dict).map(studentData => {
        return {
          y: studentData[1].lastQuestionDone,
          data: studentData[1]
        };
      })
    });

    colors.forEach(color => {
      data.push({
        label: color.label,
        backgroundColor: color.color,
        hoverBackgroundColor: color.color,
        borderColor: 'grey',
        yAxisID: 'A',
        data: Object.entries(dict).map(student => {
          return {
            y: student[1].commitTypes[color.label].percentage,
            data: student[1].commitTypes[color.label],
            translations
          };
        })
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
}
