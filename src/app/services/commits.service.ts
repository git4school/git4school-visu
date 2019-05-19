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

  getRepositoriesCommits(repoTab, date?: Date) {
    console.log('date getRepositoriesCommits', date);
    const tab = [];
    repoTab.forEach(repo => {
      tab.push(this.getCommits(repo, date));
    });
    return forkJoin(tab);
  }

  getCommits(repoURL, date?: Date): Observable<Commit[]> {
    console.log('date getComits', date);
    let url = repoURL + '?per_page=100';
    if (date) {
      url = url.concat('&since=' + date.toISOString());
    }
    console.log(url);
    return this.http.get<Commit[]>(url,
      this.httpOptions).pipe(map(
        response => {
          const array = response.map(data => Commit.withJSON(data));
          return array;
        }
      ));
  }
}
