import { Commit } from './Commit.model';

export class Repository {
  constructor(
    public url: string,
    public name?: string,
    public commits?: Commit[],
    public groupeTP?: number
  ) {}
}
