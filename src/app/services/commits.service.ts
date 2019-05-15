import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Commit } from '../models/Commit.model';


@Injectable({
  providedIn: 'root'
})
export class CommitsService {
  httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json',
    Authorization: 'token ' + this.authService.token})
  };

  constructor(private http: HttpClient, private authService: AuthService) { }

  getCommits(): Observable<Commit[]> {
    return this.http.get<Commit[]>('https://api.github.com/repos/BilelJegham/LastMate/commits',
      this.httpOptions).pipe(map(
        response => {
          let array = response.map(data => Commit.withJSON(data));
          return array;
        }
      ));
  }
}
