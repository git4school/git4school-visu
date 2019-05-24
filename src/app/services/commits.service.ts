import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Commit } from '../models/Commit.model';
import { forkJoin } from 'rxjs';
import { Repository } from '../models/Repository.model';
import moment from 'moment/src/moment';

@Injectable({
  providedIn: 'root'
})
export class CommitsService {
  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: 'token ' + this.authService.token
    })
  };

  constructor(private http: HttpClient, private authService: AuthService) {}

  getRepositoriesCommits(repoTab, date?: Date) {
    const tab = [];
    repoTab.forEach(repo => {
      tab.push(this.getCommits(repo, date));
    });
    return forkJoin(tab);
  }

  getRepositories(repoTab, date?: Date) {
    const tab = [];
    repoTab.forEach(repo => {
      tab.push(this.getRepository(repo, date));
    });
    return forkJoin(tab);
  }

  getRepository(repo: Repository, date?: Date) {
    return new Observable(observer => {
      this.getRepositoryObservable(repo, date).subscribe(
        response => {
          const readme = decodeURIComponent(
            escape(window.atob(response[0].content))
          );
          const tab = readme
            .split(/(### NOM :)|(### Prénom :)|(### Groupe de TP :)|\n/g)
            .filter(values => Boolean(values) === true);
          if (!repo.name) {
            if (!tab[4] || !tab[2]) {
              const repoName = repo.url.split('/');
              repo.name = repoName[4];
            } else {
              repo.name = tab[4].trim() + ' ' + tab[2].trim();
            }
          }
          if (!repo.groupeTP && tab[6]) {
            repo.groupeTP = tab[6].trim();
          }
          repo.commits = response[1];
          observer.next(repo);
          observer.complete();
        },
        err => {}
      );
    });
  }

  getRepositoryObservable(repo: Repository, date?: Date) {
    return forkJoin(this.getReadMe(repo), this.getCommits(repo, date)).pipe(
      catchError(error => of(error))
    );
  }

  getCommits(repo: Repository, date?: Date): Observable<Commit[]> {
    const repoHashURL = repo.url.split('/');
    let url =
      'https://api.github.com/repos/' +
      repoHashURL[3] +
      '/' +
      repoHashURL[4] +
      '/commits?per_page=100';
    if (date) {
      date = moment(date, 'DD/MM/YYYY HH:mm').toDate();
      url = url.concat('&since=' + date.toISOString());
    }
    return this.http.get<Commit[]>(url, this.httpOptions).pipe(
      map(
        response => {
          //
          const array = response.map(data => Commit.withJSON(data));
          //
          return array;
        },
        err => {}
      )
    );
  }

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
}
