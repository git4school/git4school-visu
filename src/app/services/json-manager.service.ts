import { Injectable } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Repository } from '@models/Repository.model';
import { Milestone } from '@models/Milestone.model';
import { Session } from '@models/Session.model';

/**
 * This service manages the configuration file
 */
@Injectable({
  providedIn: 'root'
})
export class JsonManagerService {
  /**
   * The configuration file
   */
  file = null;

  /**
   * The configuration file name
   */
  filename: string;

  /**
   * The generated json
   */
  json;

  /**
   * JsonManagerService constructor
   */
  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Generates a updated configuration file
   *
   * @param title The document title
   * @param questions The questions that will be handled by the application
   * @param repositories The repositories
   * @param sessions The practical sessions
   * @param corrections The correction milestones
   * @param reviews The review milestones
   * @param others The others milestones
   * @param startDate A date before which commits are not retrieved from Github
   * @param endDate A date after which commits are not retrieved from Github
   * @param course The course associated with the configuration file
   * @param program The program associated with the configuration file
   * @param year The year associated with the configuration file
   */
  generateJson(
    title: string,
    questions: string[],
    repositories: Repository[],
    sessions?: Session[],
    corrections?: Milestone[],
    reviews?: Milestone[],
    others?: Milestone[],
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
