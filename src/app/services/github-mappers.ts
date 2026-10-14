import { Commit } from "@models/Commit.model";
import { GitDataSearchResult, RepositoryMetadata } from "@models/GitDataService.model";
import { Error as ModelError, ErrorType, Repository } from "@models/Repository.model";
import { Utils } from "@services/utils";
import { extractRepositoriesFromNodes } from "./github-queries";

/**
 * Response mapping of the GitHub GraphQL documents: every `map(…)` of `GithubDataService` lives
 * here, so the service only chains HTTP calls and the payload shapes stay in one place.
 */

/** Common shape of a paginated search payload. */
export interface GithubPageInfo {
  hasNextPage?: boolean;
  endCursor?: string;
}

/** Builds the `GitDataSearchResult` of a search answer. */
function toSearchResult(repositories: Map<string, Repository>, pageInfo: GithubPageInfo | undefined): GitDataSearchResult {
  return {
    completed: !pageInfo?.hasNextPage,
    repositories: Array.from(repositories.values()),
    cursor: pageInfo?.endCursor,
  };
}

/** Repositories of the authenticated user (`viewer.repositories`). */
export function mapAuthenticatedRepositoriesResponse(response: any): GitDataSearchResult {
  const repositoriesData = response?.data?.viewer?.repositories;
  if (!repositoriesData) {
    return { completed: true, repositories: [], cursor: undefined };
  }
  return toSearchResult(extractRepositoriesFromNodes(repositoriesData.nodes || []), repositoriesData.pageInfo);
}

/** Scoped search: the requested repository (with its forks) plus the searches inside its owner. */
export function mapScopedSearchResponse(response: any): GitDataSearchResult {
  const repositories = new Map<string, Repository>();
  if (response?.data) {
    if (response.data.repository) {
      extractRepositoriesFromNodes([response.data.repository], repositories);
    }
    if (response.data.orgSearch?.nodes) {
      extractRepositoriesFromNodes(response.data.orgSearch.nodes, repositories);
    }
  }
  return toSearchResult(repositories, response?.data?.orgSearch?.pageInfo);
}

/** Global search of the user's organizations. */
export function mapGlobalSearchResponse(response: any): GitDataSearchResult {
  const searchData = response?.data?.globalSearch;
  return toSearchResult(extractRepositoriesFromNodes(searchData?.nodes || []), searchData?.pageInfo);
}

/** Answers of the per-organization search query (one alias per organization). */
export function mapOrgSearchResponse(response: any): GitDataSearchResult {
  const repositories = new Map<string, Repository>();
  if (response?.data) {
    Object.keys(response.data).forEach((key) => {
      const field = response.data[key];
      if (key === "repositoryOwner") {
        extractRepositoriesFromNodes(field?.repositories?.nodes || [], repositories);
      } else if (field?.nodes) {
        extractRepositoriesFromNodes(field.nodes, repositories);
      }
    });
  }
  return toSearchResult(repositories, response?.data?.globalSearch?.pageInfo);
}

/** Lightweight metadata (student name + TP group) of a batch of repositories. */
export function mapRepositoriesMetadataResponse(response: any, repoInfos: Array<{ alias: string; url: string }>): RepositoryMetadata[] {
  return repoInfos.map((info) => {
    const repoData = response?.data?.[info.alias];
    const { name, tpGroup } = Utils.extractRepositoryMetadata(repoData?.identity?.text, repoData?.readme?.text);
    return { url: info.url, name, tpGroup };
  });
}

/** One repository of a GraphQL batch (its alias in the query, its owner/name and the model). */
export interface GithubRepoBatchInfo {
  alias: string;
  owner: string;
  name: string;
  repository: Repository;
}

/** Page to follow when a repository has more commits than the batch returned. */
export interface GithubRepoNextPage {
  repository: Repository;
  owner: string;
  name: string;
  cursor: string;
}

/**
 * Fills each repository of a batch with its metadata and commits, and collects the repositories that
 * still have pages to fetch (the caller chains `fetchRemainingCommits` on them).
 */
export function applyBatchedRepositoriesResponse(
  response: any,
  repoInfos: GithubRepoBatchInfo[],
): { results: Repository[]; reposWithNextPage: GithubRepoNextPage[] } {
  if (response.errors) {
    console.error("GraphQL reported errors:", response.errors);
  }

  const results: Repository[] = [];
  const reposWithNextPage = [];

  repoInfos.forEach((info) => {
    const repoData = response?.data?.[info.alias];
    if (!repoData) {
      info.repository.errors.push(new ModelError(ErrorType.COMMITS_NOT_FOUND));
      results.push(info.repository);
      return;
    }

    const identityData = repoData.identity?.text;
    const readmeData = repoData.readme?.text;
    const { name, tpGroup } = Utils.extractRepositoryMetadata(identityData, readmeData);

    const history = repoData.defaultBranchRef?.target?.history;
    let commits = [];
    let hasNextPage = false;
    let endCursor = null;

    if (history) {
      commits = history.nodes.map((node: any) => Commit.withGraphQLJSON(node));
      hasNextPage = history.pageInfo.hasNextPage;
      endCursor = history.pageInfo.endCursor;
    }

    info.repository.commits = commits;
    info.repository.provider = "github";

    if (!info.repository.name) {
      info.repository.name = name || info.repository.getNameFromUrl();
    }
    if (!info.repository.tpGroup) {
      info.repository.tpGroup = tpGroup || Utils.DEFAULT_TP_GROUP;
    }

    results.push(info.repository);

    if (hasNextPage) {
      reposWithNextPage.push({
        repository: info.repository,
        owner: info.owner,
        name: info.name,
        cursor: endCursor,
      });
    }
  });

  return { results, reposWithNextPage };
}
