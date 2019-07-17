import { Injectable } from '@angular/core';
import { Jalon } from '../models/Jalon.model';
import { Session } from '../models/Session.model';
import { Repository } from '../models/Repository.model';
import { JsonManagerService } from './json-manager.service';
import { start } from 'repl';

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
  startDate: string;
  endDate: string;
  course: string;
  program: string;
  year: string;
  tpGroups: string[];
  lastUpdateDate: Date;
  questions: string[];

  constructor(private jsonManager: JsonManagerService) {}

  generateJSON() {
    this.jsonManager.generateJson(
      this.title,
      this.questions,
      this.repositories,
      this.sessions,
      this.corrections,
      this.reviews,
      this.others,
      this.startDate,
      this.endDate,
      this.course,
      this.program,
      this.year
    );
  }

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
