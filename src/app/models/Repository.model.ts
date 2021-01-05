import { Commit } from "@models/Commit.model";
import { Type } from "class-transformer";

/**
 * This class modelizes a Github repository
 */
export class Repository {
  @Type(() => Commit)
  commits: Commit[];
  /**
   * Repository constructor
   * @param url The URL of the repository
   * @param name The student name associated with the repository
   * @param commits The repository commits
   * @param tpGroup The student tp group
   */
  constructor(
    public url: string,
    public name?: string,
    commits?: Commit[],
    public tpGroup?: string,
    public errors?: Error[]
  ) {
    this.commits = commits || [];
    this.errors = errors || [];
  }

  getNameFromUrl(): string {
    return this.url.split("/")[4];
  }

  static isEqual(repository1: Repository, repository2: Repository): boolean {
    return repository1.url.toLowerCase() === repository2.url.toLowerCase();
  }

  /**
   * Initialize a Repository from the json configuration file
   * @param json The json configuration file
   * @returns A Repository
   */
  static withJSON(json) {
    return new Repository(json.url, json.name, json.commits, json.tpGroup);
  }
}

export class Error {
  constructor(public type: ErrorType, public message = "") {}
}

export const enum ErrorType {
  COMMITS_NOT_FOUND = "COMMITS-NOT-FOUND",
  README_NOT_FOUND = "README-NOT-FOUND",
  README_NAME_NOT_FOUND = "README-NAME-NOT-FOUND",
  README_TPGROUP_NOT_FOUND = "README-TPGROUP-NOT-FOUND",
}
