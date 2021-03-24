import { Injectable } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { Assignment } from "@models/Assignment.model";
import { CommitColor } from "@models/Commit.model";
import { Metadata } from "@models/Metadata.model";
import { Repository } from "@models/Repository.model";
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

  readFile(file: Blob): Promise<string> {
    return file.text();
  }

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
  private generateJson(assignment: Assignment) {
    let dataJson = {};

    dataJson["repositories"] = this.generateRepositoriesJson(
      assignment.repositories
    );

    dataJson["sessions"] = assignment.sessions?.map((session) =>
      session.json()
    );
    dataJson["corrections"] = assignment.corrections?.map((correction) =>
      correction.json()
    );
    dataJson["reviews"] = assignment.reviews?.map((review) => review.json());
    dataJson["others"] = assignment.others?.map((other) => other.json());

    const metadataJson = this.generateMetadataJson(assignment.metadata);

    this.json = {
      ...dataJson,
      ...metadataJson,
    };
  }

  private generateCurrentAssignmentJson() {
    this.generateJson(this.dataService.assignment);
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

  private generateRepositoriesJson(repositories: Repository[]) {
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
    return repos;
  }

  private generateMetadataJson(metadata: Metadata) {
    let json = Object.keys(metadata)
      .filter((key) => metadata[key] != null)
      .reduce((acc, key) => ({ ...acc, [key]: metadata[key] }), {});
    return json;
  }
}
