import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Commit } from '../models/Commit.model';
import { forkJoin } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class CommitsService {
  httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json',
    Authorization: 'token ' + this.authService.token})
  };

  constructor(private http: HttpClient, private authService: AuthService) { }

  getRepositoriesCommits(repoTab) {
    const tab = [];
    repoTab.forEach(repo => {
      tab.push(this.getCommits(repo));
    });
    return forkJoin(tab);
  }

  getCommits(repoURL): Observable<Commit[]> {
    return this.http.get<Commit[]>(repoURL + '?per_page=100',
      this.httpOptions).pipe(map(
        response => {
          const array = response.map(data => Commit.withJSON(data));
          return array;
        }
      ));
  }
}
