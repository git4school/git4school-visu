import { HttpEvent, HttpHandler, HttpHeaders, HttpInterceptor, HttpRequest, HttpResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { delay } from "rxjs/operators";
import { MOCK_GITLAB_HOST, MockGitlabInstanceService } from "./mock-gitlab-instance.service";
import {
  MOCK_STUDENTS,
  MockStudent,
  buildGitlabProject,
  getCommitsForStudent,
  getFixtureEpoch,
  getIdentityForStudent,
  getMockProfile,
  getReadmeForStudent,
  getStudentBySlug,
} from "./mock-fixtures";

/**
 * DEV-ONLY interceptor faking a self-hosted GitLab instance (`MOCK_GITLAB_HOST`).
 * It answers the REST v4 endpoints used by GitlabDataService from the shared
 * fixture dataset. It is a strict no-op unless the mock is enabled from the dev bar.
 */
@Injectable()
export class MockGitlabInterceptor implements HttpInterceptor {
  constructor(private mockService: MockGitlabInstanceService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.mockService.isMockActive || !req.url.includes(MOCK_GITLAB_HOST)) {
      return next.handle(req);
    }

    const url = req.url;

    if (/\/api\/v4\/user(\?|$)/.test(url)) {
      return this.json(this.buildProfile(), 50);
    }

    if (url.includes("/personal_access_tokens/self")) {
      return this.json({ expires_at: null }, 20);
    }

    const fileMatch = url.match(/\/api\/v4\/projects\/([^/]+)\/repository\/files\/([^/]+)\/raw/);
    if (fileMatch) {
      const student = getStudentBySlug(fileMatch[1]);
      if (!student) {
        return this.notFound(20);
      }
      const fileName = decodeURIComponent(fileMatch[2]);
      if (/identity\.json/i.test(fileName)) {
        return this.text(getIdentityForStudent(student), 30);
      }
      return this.text(getReadmeForStudent(student), 30);
    }

    const commitsMatch = url.match(/\/api\/v4\/projects\/([^/]+)\/repository\/commits/);
    if (commitsMatch) {
      const student = getStudentBySlug(commitsMatch[1]);
      if (!student) {
        return this.json([], 20, { "x-next-page": "" });
      }
      const { since, until } = this.parseRange(url);
      const commits = getCommitsForStudent(student, "gitlab", MOCK_GITLAB_HOST, since, until).map((commit) => ({
        id: commit.shortId.padEnd(40, "0"),
        short_id: commit.shortId.slice(0, 8),
        title: commit.message,
        message: `${commit.message}\n`,
        author_name: commit.authorName,
        author_email: `${student.login}@univ-tlse3.fr`,
        authored_date: commit.date.toISOString(),
        committer_name: commit.authorName,
        committer_email: `${student.login}@univ-tlse3.fr`,
        committed_date: commit.date.toISOString(),
        web_url: commit.url,
      }));
      return this.json(commits, 40, { "x-next-page": "" });
    }

    const forksMatch = url.match(/\/api\/v4\/projects\/([^/]+)\/forks/);
    if (forksMatch) {
      return this.json([], 20, { "x-next-page": "" });
    }

    const singleMatch = url.match(/\/api\/v4\/projects\/([^/?]+)(?:\?|$)/);
    if (singleMatch) {
      const student = getStudentBySlug(decodeURIComponent(singleMatch[1]));
      if (!student) {
        return this.notFound(20);
      }
      return this.json(buildGitlabProject(student, MOCK_GITLAB_HOST), 30);
    }

    if (/\/api\/v4\/projects(\?|$)/.test(url)) {
      const search = this.parseQueryParam(url, "search");
      const students = search ? MOCK_STUDENTS.filter((s) => this.matchesSearch(s, search)) : MOCK_STUDENTS;
      return this.json(
        students.map((student) => buildGitlabProject(student, MOCK_GITLAB_HOST)),
        50,
        { "x-next-page": "" },
      );
    }

    return next.handle(req);
  }

  private buildProfile(): any {
    const profile = getMockProfile("gitlab");
    return {
      id: profile.id,
      username: profile.login,
      name: profile.name,
      avatar_url: profile.avatarUrl,
      web_url: `https://${MOCK_GITLAB_HOST}/${profile.login}`,
    };
  }

  private matchesSearch(student: MockStudent, search: string): boolean {
    const needle = search.toLowerCase();
    return (
      student.repoSlug.toLowerCase().includes(needle) ||
      student.login.toLowerCase().includes(needle) ||
      student.description.toLowerCase().includes(needle) ||
      `prof.turing/${student.repoSlug}`.toLowerCase().includes(needle)
    );
  }

  private parseRange(url: string): { since?: Date; until?: Date } {
    const sinceRaw = this.parseQueryParam(url, "since");
    const untilRaw = this.parseQueryParam(url, "until");
    return {
      since: sinceRaw ? new Date(sinceRaw) : undefined,
      until: untilRaw ? new Date(untilRaw) : undefined,
    };
  }

  private parseQueryParam(url: string, name: string): string | null {
    const match = url.match(new RegExp(`[?&]${name}=([^&]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  private json(body: any, delayMs: number, headers?: Record<string, string>): Observable<HttpEvent<any>> {
    return of(new HttpResponse({ status: 200, body, headers: new HttpHeaders(headers || {}) })).pipe(delay(delayMs));
  }

  private text(body: string, delayMs: number): Observable<HttpEvent<any>> {
    return of(new HttpResponse({ status: 200, body })).pipe(delay(delayMs));
  }

  private notFound(delayMs: number): Observable<HttpEvent<any>> {
    return of(new HttpResponse({ status: 404, body: { message: "404 Not Found (mock)" } })).pipe(delay(delayMs));
  }
}
