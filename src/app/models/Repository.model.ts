import { Commit } from './Commit.model';

export class Repository {
  constructor(
    public url: string,
    public name?: string,
    public commits?: Commit[],
    public groupeTP?: string
  ) {}

  static withJSON(json) {
    return new Repository(json.url, json.name, json.commits, json.groupeTP);
  }
}
