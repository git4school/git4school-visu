import { Injectable } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { Milestone } from "@models/Milestone.model";
import { Repository } from "@models/Repository.model";
import { Session } from "@models/Session.model";
import { DatabaseService } from "@services/database.service";
import { JsonManagerService } from "@services/json-manager.service";

/**
 * This service is used to store data
 */
@Injectable({
  providedIn: "root",
})
export class DataService {
  /**
   * The practical course, represents the data from the configuration file
   */
  _assignment: Assignment;

  /**
   * The TP groups of the class
   */
  tpGroups: string[];

  /**
   * The date on which the data was last recovered from Github
   */
  lastUpdateDate: Date;

  /**
   * The index of the threshold bar of the graph "questions-completion"
   */
  barIndex: number;

  repoToLoad: boolean;

  /**
   * DataService constructor
   * @param jsonManager
   */
  constructor(
    private jsonManager: JsonManagerService,
    private databaseService: DatabaseService
  ) {
    this.repoToLoad = false;
    this.barIndex = 5;
    this.tpGroups = [];
  }

  saveData(assignment: Assignment = this.assignment): Promise<number> {
    return this.databaseService
      .saveAssignment(assignment)
      .then((id) => (assignment.id = id));
  }

  /**
   * Generates the json of the initial configuration file, updated with modified values during the use of the application
   */
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

  /**
   * Returns a boolean indicating if data is fully loaded
   * @return true if data is fully loaded, false otherwise
   */
  dataLoaded(): boolean {
    return !!this.assignment;
  }

  get assignment(): Assignment {
    return this._assignment;
  }

  set assignment(assignment: Assignment) {
    this._assignment = assignment;
    this.repoToLoad = true;
  }

  get title(): string {
    return this.assignment?.title;
  }

  set title(title: string) {
    this.assignment.title = title;
  }

  get questions(): string[] {
    return this.assignment?.questions;
  }

  set questions(questions: string[]) {
    this.assignment.questions = questions;
  }

  get repositories(): Repository[] {
    return this.assignment?.repositories;
  }

  set repositories(repos: Repository[]) {
    this.repoToLoad = true;
    this.assignment.repositories = repos;
  }

  get sessions(): Session[] {
    return this.assignment?.sessions;
  }

  set sessions(sessions: Session[]) {
    this.assignment.sessions = sessions;
  }

  get corrections(): Milestone[] {
    return this.assignment?.corrections;
  }

  set corrections(corrections: Milestone[]) {
    this.assignment.corrections = corrections;
  }

  get reviews(): Milestone[] {
    return this.assignment?.reviews;
  }

  set reviews(reviews: Milestone[]) {
    this.assignment.reviews = reviews;
  }

  get others(): Milestone[] {
    return this.assignment?.others;
  }

  set others(others: Milestone[]) {
    this.assignment.others = others;
  }

  get startDate(): string {
    return this.assignment?.startDate;
  }

  set startDate(startDate: string) {
    this.repoToLoad = true;
    this.assignment.startDate = startDate;
  }

  get endDate(): string {
    return this.assignment?.endDate;
  }

  set endDate(endDate: string) {
    this.repoToLoad = true;
    this.assignment.endDate = endDate;
  }

  get course(): string {
    return this.assignment?.course;
  }

  set course(course: string) {
    this.assignment.course = course;
  }

  get program(): string {
    return this.assignment?.program;
  }

  set program(program: string) {
    this.assignment.program = program;
  }

  get year(): string {
    return this.assignment?.year;
  }

  set year(year: string) {
    this.assignment.year = year;
  }
}
