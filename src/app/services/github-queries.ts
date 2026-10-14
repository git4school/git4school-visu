/**
 * GraphQL documents and response helpers of `GithubDataService`.
 *
 * Keeping the documents in their own module makes the queries easy to read side by side, and
 * keeps the service focused on auth, batching and mapping to the models.
 */
import { Repository } from "@models/Repository.model";

/** Single GraphQL endpoint of GitHub (v4 API). */
export const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

export const GITHUB_AUTHENTICATED_REPOSITORIES_QUERY = `
      query($cursor: String, $pageLimit: Int!) {
        viewer {
          repositories(
            first: $pageLimit
            after: $cursor
            affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
            orderBy: { field: CREATED_AT, direction: DESC }
          ) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              name
              url
              description
              isFork
              parent {
                name
                url
              }
              forks(first: 100) {
                nodes {
                  name
                  url
                  description
                  isFork
                }
              }
            }
          }
        }
      }
    `;

export const GITHUB_SCOPED_REPOSITORY_SEARCH_QUERY = `
        query($owner: String!, $name: String!, $qOrg: String!, $pageLimit: Int!, $cursor: String) {
          repository(owner: $owner, name: $name) {
            name
            url
            description
            isFork
            parent {
              name
              url
            }
            forks(first: 100) {
              nodes {
                name
                url
                description
                isFork
                parent {
                  name
                  url
                }
              }
            }
          }
          orgSearch: search(query: $qOrg, type: REPOSITORY, first: $pageLimit, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              ... on Repository {
                name
                url
                description
                isFork
                parent {
                  name
                  url
                }
              }
            }
          }
        }
      `;

export const GITHUB_REPOSITORY_SEARCH_QUERY = `
        query($queryString: String!, $cursor: String, $pageLimit: Int!) {
          globalSearch: search(query: $queryString, type: REPOSITORY, first: $pageLimit, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              ... on Repository {
                name
                url
                description
                isFork
                parent {
                  name
                  url
                }
              }
            }
          }
        }
      `;

export const GITHUB_USER_ORGANIZATIONS_QUERY = `
      query {
        viewer {
          organizations(first: 100) {
            nodes {
              login
            }
          }
        }
      }
    `;

export function extractRepositoriesFromNodes(
  nodes: any[],
  reposMap: Map<string, Repository> = new Map<string, Repository>(),
): Map<string, Repository> {
  if (!nodes) return reposMap;

  nodes.forEach((node: any) => {
    if (!node || !node.url) return;

    const parentUrl = node.parent?.url || undefined;
    const isFork = Boolean(node.isFork || parentUrl);

    if (!reposMap.has(node.url)) {
      const repo = new Repository(node.url, node.name, undefined, undefined, undefined, node.description, isFork, parentUrl);
      repo.provider = "github";
      reposMap.set(node.url, repo);
    } else {
      const existing = reposMap.get(node.url);
      if (!existing.parentUrl && parentUrl) {
        existing.parentUrl = parentUrl;
        existing.isFork = true;
      }
    }

    if (node.forks?.nodes) {
      node.forks.nodes.forEach((fork: any) => {
        if (fork && fork.url) {
          if (!reposMap.has(fork.url)) {
            const forkRepo = new Repository(fork.url, fork.name, undefined, undefined, undefined, fork.description, true, node.url);
            forkRepo.provider = "github";
            reposMap.set(fork.url, forkRepo);
          } else {
            const existingFork = reposMap.get(fork.url);
            existingFork.parentUrl = node.url;
            existingFork.isFork = true;
          }
        }
      });
    }
  });

  return reposMap;
}

export function getCommitHistoryQueryFragment(historyArgs: string): string {
  return `
          defaultBranchRef {
            target {
              ... on Commit {
                history(${historyArgs}) {
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                  nodes {
                    message
                    author {
                      name
                    }
                    committedDate
                    url
                  }
                }
              }
            }
          }`;
}
