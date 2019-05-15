import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class CommitsService {
  httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json',
    Authorization: 'token ' + this.authService.token})
  };

  constructor(private http: HttpClient, private authService: AuthService) { }

  getCommits(): Observable<any[]> {
    console.log('fegergerg', this.httpOptions);
    return this.http.get<any[]>('https://api.github.com/repos/BilelJegham/LastMate/commits',
                         this.httpOptions);
  }
}
