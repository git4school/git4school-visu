import { Injectable } from "@angular/core";
import { DatabaseService } from "./database.service";
import { Assignment } from "../models/Assignment.model";
import { DataService } from "./data.service";
import { Repository } from "../models/Repository.model";
import { Commit } from "../models/Commit.model";

@Injectable({
  providedIn: "root",
})
export class EmotionService {
  /**
   * The filtered repository selected during the session
   */
  selection: string;

  repository_by_name: Map<
    string,
    {
      repository: Repository;
      data: { difficulty: number; emotion: number; commit: Commit }[];
    }
  >;

  constructor(public dataService: DataService) {}

  getSelection(): Repository | undefined {
    if (!this.repository_by_name) {
      this.repository_by_name = new Map(
        this.dataService.repositories.map((v) => [
          v.getDisplayName(),
          { repository: v, data: undefined },
        ])
      );
    }

    return this.repository_by_name.get(this.selection)?.repository;
  }

  private generateDataForRepository(repository: Repository) {
    let obj = this.repository_by_name.get(repository.getDisplayName());

    obj.data = obj.repository.commits
      .filter(
        (v) =>
          v.message.startsWith("Fix") &&
          v.message.indexOf("\nD=") != -1 &&
          v.message.indexOf("\nE=") != -1
      )
      .map((v) => {
        let raw_data = v.message
          .substring(v.message.indexOf("\nD=") + "\nD=".length)
          .replace("\nE=", " ")
          .trim();

        let message = v.message.substring(0, v.message.indexOf("\n"));

        let split = raw_data.split(" ");

        return {
          difficulty: Number.parseInt(split[0]),
          emotion: Number.parseInt(split[1]),
          message: message,
          commit: v,
        };
      });
  }

  getData(repository: Repository) {
    let obj = this.repository_by_name.get(repository.getDisplayName());

    if (obj.data == null) this.generateDataForRepository(repository);
    return obj.data;
  }

  containsEmotionReport(repository: Repository): boolean {
    let obj = this.repository_by_name.get(repository.getDisplayName());

    if (obj.data != null) return obj.data.length > 0;

    this.generateDataForRepository(repository);

    return obj.data.length > 0;
  }
}
