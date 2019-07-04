import { Injectable } from '@angular/core';
import { Jalon } from '../models/Jalon.model';
import { Session } from '../models/Session.model';
import { Repository } from '../models/Repository.model';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  title: string;
  corrections: Jalon[];
  sessions: Session[];
  reviews: Jalon[];
  others: Jalon[];
  repositories: Repository[];
  tpGroups: Set<string>;
  lastUpdateDate: Date;

  constructor() {}

  getQuestionsSet() {
    let questions = [];
    this.reviews &&
      this.reviews.forEach(review => {
        questions.push(...review.questions);
      });
    this.corrections &&
      this.corrections.forEach(correction => {
        questions.push(...correction.questions);
      });
    this.others &&
      this.others.forEach(other => {
        questions.push(...other.questions);
      });
    return Array.from(new Set(questions));
  }
}
