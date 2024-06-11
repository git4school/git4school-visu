import { Commit } from "@models/Commit.model";
import * as assert from "assert";
import { Exclude, Type } from "class-transformer";
import { Utils } from "../services/utils";

/**
 * This class modelizes a Github repository
 */
export class Repository {
  @Exclude()
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


  /**
   * Returns a formatted version of the fusion of last_name and first_name such 
   * that the length of the final string is no bigger than max_length
   * 
   * Example : 
   * last_name: "ABRA", first_name: "Merlin" => ABRA Merlin
   * last_name: "ABRA", first_name: ""  => ABRA
   * last_name: "", first_name: "Merlin" => Merlin
   * last_name: "ABRACADABRABRACADABRA", first_name: "Merlin" => ABRACADABRABRACA. M.
   * 
   * @param last_name 
   * @param first_name 
   * @param max_length
   * @returns A string with length below max_length
   */
  static getFormattedName(last_name: string, first_name: string, max_length: number): string {
    assert(max_length > 0);

    if (!last_name && !first_name) {
      return "";
    }

    let full = [last_name, first_name].filter(Boolean).join(" ");
    if (full.length <= max_length) {
      return full;
    }

    if (!last_name) {
      return first_name.substring(0, max_length - 1) + ".";
    }

    if (!first_name) {
      return last_name.substring(0, max_length - 1) + ".";
    }

    let last_name_final_length = Math.min(max_length - 4, last_name.length);

    return last_name.substring(0, last_name_final_length) +
      (last_name_final_length < last_name.length ? "." : "") + " " +
      first_name.substring(0, max_length - last_name_final_length - 3) + ".";
  }


  getDisplayName() {
    let displayName = this.name || "";
    if (displayName.length > Utils.OVERVIEW_NAME_LENGTH_LIMIT) {
      let numberOfSpace = (displayName.match(/ /g) || []).length
      if (numberOfSpace === 0) {
        displayName = displayName.substring(0, Utils.OVERVIEW_NAME_LENGTH_LIMIT - 1) + ".";
      } else if (numberOfSpace == 1) {
        let [lastName, firstName] = displayName.split(" ");
        displayName = Repository.getFormattedName(firstName, lastName, Utils.OVERVIEW_NAME_LENGTH_LIMIT);
      } else {
        let findLastName = displayName.match(/^([A-Z\-]+ )*/g)
        if (findLastName.length === 1 && findLastName[0].trim().length !== 0) {
          displayName = Repository.getFormattedName(findLastName[0].trim(), displayName.substring(findLastName[0].length), Utils.OVERVIEW_NAME_LENGTH_LIMIT);
        } else {
          let lastspace = displayName.lastIndexOf(" ");
          let [lastName, firstName] = [displayName.substring(0, lastspace), displayName.substring(lastspace + 1)];
          displayName = Repository.getFormattedName(lastName, firstName, Utils.OVERVIEW_NAME_LENGTH_LIMIT)
        }
      }
    }

    return displayName;
  }

  static isEqual(repository1: Repository, repository2: Repository): boolean {
    return repository1.url?.toLowerCase() === repository2.url?.toLowerCase();
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
  constructor(public type: ErrorType, public message = "") { }
}

export const enum ErrorType {
  COMMITS_NOT_FOUND = "COMMITS-NOT-FOUND",
  IDENTITY_NOT_FOUND = "IDENTITY-NOT-FOUND",
  README_NOT_FOUND = "README-NOT-FOUND",
  README_NAME_NOT_FOUND = "README-NAME-NOT-FOUND",
  README_TPGROUP_NOT_FOUND = "README-TPGROUP-NOT-FOUND",
}
