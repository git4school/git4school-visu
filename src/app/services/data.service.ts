import { Injectable } from '@angular/core';
import { Jalon } from '../models/Jalon.model';
import { Session } from '../models/Session.model';
import { Repository } from '../models/Repository.model';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  corrections: Jalon[];
  sessions: Session[];
  reviews: Jalon[];
  others: Jalon[];
  repositories: Repository[];
  tpGroups: Set<string>;
  lastUpdateDate: Date;

  constructor() {}
}
