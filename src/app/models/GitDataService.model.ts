import { Observable } from "rxjs";
import { GitProviderType } from "@models/Account.model";
import { Repository } from "@models/Repository.model";

export interface GitDataSearchResult {
  completed: boolean;
  repositories: Repository[];
  cursor?: string;
}

/**
 * Interface representing a Git data provider service (GitHub, GitLab, etc.)
 */
export interface GitDataService {
  readonly provider: GitProviderType;

  /**
   * Retrieves repository metadata (README.md, IDENTITY.json) and commits for a list of repositories
   */
  getRepositories(repoTab: Repository[], startDate?: string, endDate?: string): Observable<Repository[]>;

  /**
   * Fetches repositories accessible by or belonging to the authenticated user
   */
  getRepositoriesByAuthenticatedUser(cursor?: string, pageLimit?: number): Observable<GitDataSearchResult>;

  /**
   * Searches repositories matching the search filter (search keyword, org/group name, repo path)
   */
  getRepositoriesBySearch(searchFilter: string, cursor?: string, pageLimit?: number): Observable<GitDataSearchResult>;

  /**
   * Verifies that the authenticated user has access to the specified repository URL
   */
  verifyUserAccess(repoUrl: string): Observable<any>;
}
