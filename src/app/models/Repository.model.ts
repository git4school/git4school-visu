import { Commit } from '@models/Commit.model';

/**
 * This class modelizes a Github repository
 */
export class Repository {
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
    public commits?: Commit[],
    public tpGroup?: string
  ) {
    if (!name) {
      this.name = this.url.split('/')[4];
    }
  }

  static isEqual(repository1: Repository, repository2: Repository): boolean {
    return repository1.url === repository2.url;
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
