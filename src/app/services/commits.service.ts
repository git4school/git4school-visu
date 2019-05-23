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
    headers: new HttpHeaders({ 'Content-Type': 'application/json',
    Authorization: 'token ' + this.authService.token})
  };

  constructor(private http: HttpClient, private authService: AuthService) { }

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

  getRepository(repoURL: string, date?: Date) {
    return new Observable(observer => {
      const repo = new Repository(repoURL);
      this.getRepositoryObservable(repoURL, date).subscribe(response => {
        // console.log(response);
        const readme = decodeURIComponent(escape(window.atob( response[0].content )));
        const tab = readme
          .split(/(### NOM :)|(### Prénom :)|(### Groupe de TP :)|\n/g)
          .filter((values) => Boolean(values) === true);
        if (!tab[4] || !tab[2]) {
          const repoName = repoURL.split('/');
          repo.name = repoName[4];
        } else {
          repo.name = tab[4].trim() + ' ' + tab[2].trim();
        }
        if (!tab[6]) {
          repo.groupeTP = 0;
        } else {
          repo.groupeTP = parseInt(tab[6], 10);
        }
        repo.commits = response[1];
        // console.log(repo);
        observer.next(repo);
        observer.complete();
      }, err => {
        console.log('ERROR');
      });
    });
  }


  getRepositoryObservable(repoURL: string, date?: Date) {
    return forkJoin(this.getReadMe(repoURL), this.getCommits(repoURL, date)).pipe(catchError(error => of(error)));
  }

  getCommits(repoURL: string, date?: Date): Observable<Commit[]> {
    const repo = repoURL.split('/');
    let url = 'https://api.github.com/repos/' + repo[3] + '/' + repo[4] + '/commits?per_page=100';
    if (date) {
      date = moment(date, 'DD/MM/YYYY HH:mm').toDate();
      url = url.concat('&since=' + date.toISOString());
    }
    return this.http.get<Commit[]>(url,
      this.httpOptions).pipe(map(
      response => {
        // console.log(response);
        const array = response.map(data => Commit.withJSON(data));
        // console.log(array);
        return array;
      },
      err => {
        console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      }
    ));
  }

  getReadMe(repoURL): Observable<any> {
    const repo = repoURL.split('/');
    const url = 'https://api.github.com/repos/' + repo[3] + '/' + repo[4] + '/readme';
    return this.http.get(url, this.httpOptions);
  }
}
