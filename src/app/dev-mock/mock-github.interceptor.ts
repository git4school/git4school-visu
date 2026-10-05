import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { delay } from "rxjs/operators";
import {
  MOCK_GITHUB_ACTIVE_KEY,
  MOCK_GITHUB_OWNER,
  MOCK_STUDENTS,
  MockStudent,
  buildGithubRepoNode,
  getCommitsForStudent,
  getIdentityForStudent,
  getMockProfile,
  getReadmeForStudent,
  getStudentBySlug,
} from "./mock-fixtures";

interface AliasedRepo {
  alias: string;
  owner: string;
  name: string;
}

/**
 * DEV-ONLY interceptor faking the GitHub REST + GraphQL APIs used by
 * GithubDataService. Reads its activation flag directly from localStorage to stay
 * free of any DI dependency on the auth services. Strict no-op when disabled.
 */
@Injectable()
export class MockGithubInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isMockActive() || !req.url.startsWith("https://api.github.com/")) {
      return next.handle(req);
    }

    if (req.method === "POST" && req.url.includes("/graphql")) {
      return this.handleGraphql(req);
    }

    if (req.method === "GET") {
      const rest = this.handleRest(req.url);
      if (rest) {
        return rest;
      }
    }

    return next.handle(req);
  }

  private isMockActive(): boolean {
    try {
      return localStorage.getItem(MOCK_GITHUB_ACTIVE_KEY) === "true";
    } catch {
      return false;
    }
  }

  private handleRest(url: string): Observable<HttpEvent<any>> | null {
    if (url.includes("/rate_limit")) {
      return this.json({ resources: {}, rate: { limit: 5000, remaining: 4999, reset: Math.floor(Date.now() / 1000) + 3600 } }, 20);
    }

    if (/\/user(\?|$)/.test(url)) {
      const profile = getMockProfile("github");
      return this.json(
        {
          login: profile.login,
          name: profile.name,
          avatar_url: profile.avatarUrl,
          html_url: `https://github.com/${profile.login}`,
        },
        30,
      );
    }

    if (url.includes("/user/repos")) {
      return this.json(
        MOCK_STUDENTS.map((student) => this.buildRestRepo(student)),
        40,
      );
    }

    const repoMatch = url.match(/\/repos\/([^/]+)\/([^/?]+)/);
    if (repoMatch) {
      const student = getStudentBySlug(repoMatch[2]);
      if (student) {
        return this.json(this.buildRestRepo(student), 30);
      }
      return this.json({ message: "Not Found" }, 20);
    }

    return null;
  }

  private buildRestRepo(student: MockStudent): any {
    return {
      id: 2000 + MOCK_STUDENTS.indexOf(student),
      name: student.repoSlug,
      full_name: `${MOCK_GITHUB_OWNER}/${student.repoSlug}`,
      description: student.description,
      private: false,
      fork: false,
      default_branch: "main",
      html_url: `https://github.com/${MOCK_GITHUB_OWNER}/${student.repoSlug}`,
      owner: { login: MOCK_GITHUB_OWNER, avatar_url: null },
    };
  }

  private handleGraphql(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    const body = req.body || {};
    const query: string = typeof body.query === "string" ? body.query : "";
    const variables = body.variables || {};

    const since = variables.since ? new Date(variables.since) : undefined;
    const until = variables.until ? new Date(variables.until) : undefined;

    if (query.includes("defaultBranchRef")) {
      return this.json(this.buildBatchedResponse(query, since, until), 40);
    }

    if (query.includes("identity:")) {
      return this.json(this.buildMetadataResponse(query), 30);
    }

    if (query.includes("organizations(first:")) {
      return this.json({ data: { viewer: { organizations: { nodes: [{ login: MOCK_GITHUB_OWNER }] } } } }, 30);
    }

    if (query.includes("viewer") && query.includes("repositories(")) {
      return this.json(this.buildAuthenticatedReposResponse(), 50);
    }

    if (/repository\(owner:\s*\$owner/.test(query)) {
      return this.json(this.buildScopedSearchResponse(query, variables), 50);
    }

    if (
      query.includes("globalSearch") ||
      query.includes("userSearch") ||
      query.includes("orgSearch") ||
      query.includes("repositoryOwner")
    ) {
      return this.json(this.buildSearchResponse(query), 50);
    }

    return this.json({ data: {} }, 20);
  }

  private buildBatchedResponse(query: string, since?: Date, until?: Date): any {
    const data: any = {};
    this.parseAliasedRepos(query).forEach((info) => {
      const student = this.resolveStudent(info);
      if (!student) {
        data[info.alias] = null;
        return;
      }
      data[info.alias] = {
        identity: { text: getIdentityForStudent(student) },
        readme: { text: getReadmeForStudent(student) },
        defaultBranchRef: {
          target: {
            history: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: this.buildCommitNodes(student, since, until),
            },
          },
        },
      };
    });
    return { data };
  }

  private buildMetadataResponse(query: string): any {
    const data: any = {};
    this.parseAliasedRepos(query).forEach((info) => {
      const student = this.resolveStudent(info);
      data[info.alias] = student
        ? {
            identity: { text: getIdentityForStudent(student) },
            readme: { text: getReadmeForStudent(student) },
          }
        : null;
    });
    return { data };
  }

  private buildCommitNodes(student: MockStudent, since?: Date, until?: Date): any[] {
    return getCommitsForStudent(student, "github", undefined, since, until).map((commit) => ({
      message: commit.message,
      author: { name: commit.authorName },
      committedDate: commit.date.toISOString(),
      url: commit.url,
    }));
  }

  private buildAuthenticatedReposResponse(): any {
    const nodes = MOCK_STUDENTS.map((student) => buildGithubRepoNode(student));
    return { data: { viewer: { repositories: { pageInfo: { endCursor: null, hasNextPage: false }, nodes } } } };
  }

  private buildScopedSearchResponse(query: string, variables: any): any {
    const data: any = {};
    const requested = getStudentBySlug(variables?.name);
    if (requested) {
      data.repository = buildGithubRepoNode(requested);
    } else {
      data.repository = null;
    }

    if (query.includes("orgSearch")) {
      data.orgSearch = {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: MOCK_STUDENTS.map((student) => buildGithubRepoNode(student)),
      };
    }
    return { data };
  }

  private buildSearchResponse(query: string): any {
    const data: any = {};
    const nodes = MOCK_STUDENTS.map((student) => buildGithubRepoNode(student));

    const searchKeyPattern = /(globalSearch|userSearch|ownerOrgSearch|orgSearch_\d+)/g;
    let match: RegExpExecArray | null;
    const keys = new Set<string>();
    while ((match = searchKeyPattern.exec(query)) !== null) {
      keys.add(match[1]);
    }
    keys.forEach((key) => {
      data[key] = { pageInfo: { hasNextPage: false, endCursor: null }, nodes };
    });

    if (query.includes("repositoryOwner")) {
      data.repositoryOwner = { repositories: { nodes } };
    }

    return { data };
  }

  private resolveStudent(info: AliasedRepo): MockStudent | undefined {
    return getStudentBySlug(info.name) || getStudentBySlug(`${info.owner}/${info.name}`);
  }

  private parseAliasedRepos(query: string): AliasedRepo[] {
    const result: AliasedRepo[] = [];
    const pattern = /([A-Za-z0-9_]+)\s*:\s*repository\(\s*owner:\s*"([^"]+)"\s*,\s*name:\s*"([^"]+)"\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(query)) !== null) {
      result.push({ alias: match[1], owner: match[2], name: match[3] });
    }
    return result;
  }

  private json(body: any, delayMs: number): Observable<HttpEvent<any>> {
    return of(new HttpResponse({ status: 200, body })).pipe(delay(delayMs));
  }
}
