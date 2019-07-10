import { Injectable } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Repository } from '../models/Repository.model';
import { Jalon } from '../models/Jalon.model';
import { Session } from '../models/Session.model';

@Injectable({
  providedIn: 'root'
})
export class JsonManagerService {
  file = null;
  filename: string;
  json;

  constructor(private sanitizer: DomSanitizer) {}

  generateJson(
    title: string,
    questions: string[],
    repositories: Repository[],
    sessions?: Session[],
    corrections?: Jalon[],
    reviews?: Jalon[],
    others?: Jalon[],
    startDate?: string,
    endDate?: string,
    course?: string,
    program?: string,
    year?: string
  ) {
    let json = {};
    let repos = [];
    repositories.forEach(repository => {
      let repo = {};
      repo['url'] = repository.url;
      if (repository.name) {
        repo['name'] = repository.name;
      }
      if (repository.tpGroup) {
        repo['tpGroup'] = repository.tpGroup;
      }
      repos.push(repo);
    });
    json['repositories'] = repos;

    sessions && (json['sessions'] = sessions.map(session => session.json()));
    corrections &&
      (json['corrections'] = corrections.map(correction => correction.json()));
    reviews && (json['reviews'] = reviews.map(review => review.json()));
    others && (json['others'] = others.map(other => other.json()));
    json['startDate'] = startDate;
    json['endDate'] = endDate;
    json['title'] = title;
    json['course'] = course;
    json['program'] = program;
    json['year'] = year;
    json['questions'] = questions;

    this.json = json;
  }
}
