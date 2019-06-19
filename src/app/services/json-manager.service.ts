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
  downloadJsonHref;
  json;

  constructor(private sanitizer: DomSanitizer) {}

  generateDownloadUrlFromJson() {
    console.log('this.json: ', this.json);
    const blob = new Blob([JSON.stringify(this.json)], {
      type: 'application/octet-stream'
    });

    this.downloadJsonHref = this.sanitizer.bypassSecurityTrustResourceUrl(
      window.URL.createObjectURL(blob)
    );
  }

  generateJson(
    repositories: Repository[],
    sessions?: Session[],
    corrections?: Jalon[],
    reviews?: Jalon[],
    startDate?: string,
    endDate?: string
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

    if (sessions) {
      json['sessions'] = sessions.map(session => session.json());
    }
    if (corrections) {
      json['corrections'] = corrections.map(correction => correction.json());
    }
    if (reviews) {
      json['reviews'] = reviews.map(review => review.json());
    }
    if (startDate) {
      json['startDate'] = startDate;
    }
    if (endDate) {
      json['endDate'] = endDate;
    }

    this.json = json;
  }

  updateJSONWithCorrection(correction) {
    if (this.json.corrections) {
      this.json.corrections.push(correction.json());
    } else {
      this.json.corrections = [correction];
    }
  }

  updateJSONWithReview(review) {
    if (this.json.reviews) {
      this.json.reviews.push(review.json());
    } else {
      this.json.reviews = [review];
    }
  }

  updateJSONWithOther(other) {
    if (this.json.others) {
      this.json.others.push(other.json());
    } else {
      this.json.others = [other];
    }
  }
}
