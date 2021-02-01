import { Injectable } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { CommitColor } from "@models/Commit.model";
import { Milestone } from "@models/Milestone.model";
import { Repository } from "@models/Repository.model";
import { Session } from "@models/Session.model";
import { CommitsService } from "@services/commits.service";
import { DataService } from "@services/data.service";
import { saveAs } from "file-saver";
import * as JSZip from "jszip";

/**
 * This service manages the configuration file
 */
@Injectable({
  providedIn: "root",
})
export class JsonManagerService {
  /**
   * The generated json
   */
  json;

  /**
   * JsonManagerService constructor
   */
  constructor(
    private sanitizer: DomSanitizer,
    private dataService: DataService,
    private commitsService: CommitsService
  ) {}

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
  private generateJson(
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
    repositories.forEach((repository) => {
      let repo = {};
      repo["url"] = repository.url;
      if (repository.name) {
        repo["name"] = repository.name;
      }
      if (repository.tpGroup) {
        repo["tpGroup"] = repository.tpGroup;
      }
      repos.push(repo);
    });
    json["repositories"] = repos;

    sessions && (json["sessions"] = sessions.map((session) => session.json()));
    corrections &&
      (json["corrections"] = corrections.map((correction) =>
        correction.json()
      ));
    reviews && (json["reviews"] = reviews.map((review) => review.json()));
    others && (json["others"] = others.map((other) => other.json()));
    json["startDate"] = startDate;
    json["endDate"] = endDate;
    json["title"] = title;
    json["course"] = course;
    json["program"] = program;
    json["year"] = year;
    json["questions"] = questions;

    this.json = json;
  }

  private generateCurrentAssignmentJson() {
    this.generateJson(
      this.dataService.title,
      this.dataService.questions,
      this.dataService.repositories,
      this.dataService.sessions,
      this.dataService.corrections,
      this.dataService.reviews,
      this.dataService.others,
      this.dataService.startDate,
      this.dataService.endDate,
      this.dataService.course,
      this.dataService.program,
      this.dataService.year
    );
  }

  download() {
    this.generateCurrentAssignmentJson();
    let colors = [
      CommitColor.BEFORE,
      CommitColor.BETWEEN,
      CommitColor.AFTER,
      CommitColor.NOCOMMIT,
    ];

    let questionsDict = this.commitsService.initQuestionsDict(
      this.dataService.questions,
      colors
    );
    questionsDict = this.commitsService.loadQuestionsDict(
      questionsDict,
      this.dataService.repositories,
      this.dataService.questions,
      colors
    );
    questionsDict["date"] = this.dataService.lastUpdateDate;

    colors = [
      CommitColor.INTERMEDIATE,
      CommitColor.BEFORE,
      CommitColor.BETWEEN,
      CommitColor.AFTER,
    ];

    let studentsDict = {
      date: this.dataService.lastUpdateDate,
      students: this.commitsService.loadStudentsDict(
        this.dataService.repositories,
        this.dataService.questions,
        colors
      ),
    };

    let zip = new JSZip();
    zip.file("conf.json", JSON.stringify(this.json, null, 2));
    zip.file(
      "questions-completion.json",
      JSON.stringify(questionsDict, null, 2)
    );
    zip.file("students-commits.json", JSON.stringify(studentsDict, null, 2));

    let filename = this.dataService.title;
    zip.generateAsync({ type: "blob" }).then(function (content) {
      saveAs(content, filename + ".zip");
    });
  }
}
