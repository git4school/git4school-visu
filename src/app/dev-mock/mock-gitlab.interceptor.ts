import { HttpEvent, HttpHandler, HttpHeaders, HttpInterceptor, HttpRequest, HttpResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { delay } from "rxjs/operators";
import { MOCK_GITLAB_HOST, MockGitlabInstanceService } from "./mock-gitlab-instance.service";

@Injectable()
export class MockGitlabInterceptor implements HttpInterceptor {
  constructor(private mockService: MockGitlabInstanceService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.mockService.isMockActive || !req.url.includes(MOCK_GITLAB_HOST)) {
      return next.handle(req);
    }

    const url = req.url;

    // 1. Current user profile
    if (url.includes("/api/v4/user")) {
      return of(
        new HttpResponse({
          status: 200,
          body: {
            id: 9999,
            username: "prof.turing",
            name: "Alan Turing",
            avatar_url: "https://avatars.githubusercontent.com/u/1083893?v=4",
            web_url: `https://${MOCK_GITLAB_HOST}/prof.turing`,
          },
        }),
      ).pipe(delay(50));
    }

    // 2. Project README.md raw content
    if (url.includes("/repository/files/README%2Emd/raw") || url.includes("/repository/files/README.md/raw")) {
      const readmeContent = "# UE Algo TP1\nNom: Turing\nPrénom: Alan\nGroupe: TP-1A\n\nTravaux pratiques d'algorithmique.";
      return of(
        new HttpResponse({
          status: 200,
          body: readmeContent,
        }),
      ).pipe(delay(30));
    }

    // 3. Project IDENTITY.json raw content
    if (url.includes("/repository/files/IDENTITY%2Ejson/raw") || url.includes("/repository/files/IDENTITY.json/raw")) {
      const identityContent = JSON.stringify({
        firstName: "Alan",
        lastName: "Turing",
        group: "TP-1A",
      });
      return of(
        new HttpResponse({
          status: 200,
          body: identityContent,
        }),
      ).pipe(delay(30));
    }

    // 4. Commits list
    if (url.includes("/repository/commits")) {
      const commits = [
        {
          id: "c1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
          short_id: "c1a2b3c4",
          title: "Initial commit with project structure",
          message: "Initial commit with project structure\n",
          author_name: "Alan Turing",
          author_email: "alan.turing@univ-tlse3.fr",
          authored_date: new Date(Date.now() - 7 * 86400000).toISOString(),
          committer_name: "Alan Turing",
          committer_email: "alan.turing@univ-tlse3.fr",
          committed_date: new Date(Date.now() - 7 * 86400000).toISOString(),
          web_url: `https://${MOCK_GITLAB_HOST}/prof.turing/ue-algo-tp1/-/commit/c1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0`,
        },
        {
          id: "d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1",
          short_id: "d2e3f4a5",
          title: "Feat: implement binary search tree insert and lookup",
          message: "Feat: implement binary search tree insert and lookup\n",
          author_name: "Alan Turing",
          author_email: "alan.turing@univ-tlse3.fr",
          authored_date: new Date(Date.now() - 5 * 86400000).toISOString(),
          committer_name: "Alan Turing",
          committer_email: "alan.turing@univ-tlse3.fr",
          committed_date: new Date(Date.now() - 5 * 86400000).toISOString(),
          web_url: `https://${MOCK_GITLAB_HOST}/prof.turing/ue-algo-tp1/-/commit/d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1`,
        },
        {
          id: "e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2",
          short_id: "e3f4a5b6",
          title: "Fix: balance condition on AVL rotation",
          message: "Fix: balance condition on AVL rotation\n",
          author_name: "Alan Turing",
          author_email: "alan.turing@univ-tlse3.fr",
          authored_date: new Date(Date.now() - 3 * 86400000).toISOString(),
          committer_name: "Alan Turing",
          committer_email: "alan.turing@univ-tlse3.fr",
          committed_date: new Date(Date.now() - 3 * 86400000).toISOString(),
          web_url: `https://${MOCK_GITLAB_HOST}/prof.turing/ue-algo-tp1/-/commit/e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2`,
        },
        {
          id: "f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3",
          short_id: "f4a5b6c7",
          title: "Test: add unit tests for graph traversal algorithms",
          message: "Test: add unit tests for graph traversal algorithms\n",
          author_name: "Alan Turing",
          author_email: "alan.turing@univ-tlse3.fr",
          authored_date: new Date(Date.now() - 1 * 86400000).toISOString(),
          committer_name: "Alan Turing",
          committer_email: "alan.turing@univ-tlse3.fr",
          committed_date: new Date(Date.now() - 1 * 86400000).toISOString(),
          web_url: `https://${MOCK_GITLAB_HOST}/prof.turing/ue-algo-tp1/-/commit/f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3`,
        },
      ];

      return of(
        new HttpResponse({
          status: 200,
          body: commits,
          headers: new HttpHeaders({ "x-next-page": "" }),
        }),
      ).pipe(delay(40));
    }

    // 5. Forks
    if (url.includes("/forks")) {
      return of(
        new HttpResponse({
          status: 200,
          body: [],
          headers: new HttpHeaders({ "x-next-page": "" }),
        }),
      ).pipe(delay(20));
    }

    // 6. Single project details
    if (url.includes("/api/v4/projects/") && !url.includes("/projects?")) {
      const match = url.match(/\/api\/v4\/projects\/([^/?]+)/);
      const encodedId = match ? match[1] : "ue-algo-tp1";
      const decodedId = decodeURIComponent(encodedId);
      const slug = decodedId.includes("/") ? decodedId.split("/").pop() : decodedId;

      return of(
        new HttpResponse({
          status: 200,
          body: {
            id: 101,
            name: slug || "ue-algo-tp1",
            path: slug || "ue-algo-tp1",
            path_with_namespace: `prof.turing/${slug || "ue-algo-tp1"}`,
            default_branch: "main",
            web_url: `https://${MOCK_GITLAB_HOST}/prof.turing/${slug || "ue-algo-tp1"}`,
            description: "Dépôt d'exercices d'algorithmique et structures de données",
            avatar_url: null,
            namespace: {
              name: "prof.turing",
              path: "prof.turing",
              avatar_url: null,
            },
          },
        }),
      ).pipe(delay(30));
    }

    // 7. Projects list (search or member listing)
    if (url.includes("/api/v4/projects")) {
      const mockProjects = [
        {
          id: 101,
          name: "ue-algo-tp1",
          path: "ue-algo-tp1",
          path_with_namespace: "prof.turing/ue-algo-tp1",
          default_branch: "main",
          web_url: `https://${MOCK_GITLAB_HOST}/prof.turing/ue-algo-tp1`,
          description: "TP1 - Algorithmique et structures de données",
          avatar_url: null,
          namespace: {
            name: "prof.turing",
            path: "prof.turing",
            avatar_url: null,
          },
        },
        {
          id: 102,
          name: "ue-algo-tp2",
          path: "ue-algo-tp2",
          path_with_namespace: "prof.turing/ue-algo-tp2",
          default_branch: "main",
          web_url: `https://${MOCK_GITLAB_HOST}/prof.turing/ue-algo-tp2`,
          description: "TP2 - Arbres binaires de recherche et tas",
          avatar_url: null,
          namespace: {
            name: "prof.turing",
            path: "prof.turing",
            avatar_url: null,
          },
        },
        {
          id: 103,
          name: "projet-annuel-dev",
          path: "projet-annuel-dev",
          path_with_namespace: "prof.turing/projet-annuel-dev",
          default_branch: "main",
          web_url: `https://${MOCK_GITLAB_HOST}/prof.turing/projet-annuel-dev`,
          description: "Projet de développement logiciel L3 Informatique",
          avatar_url: null,
          namespace: {
            name: "prof.turing",
            path: "prof.turing",
            avatar_url: null,
          },
        },
      ];

      return of(
        new HttpResponse({
          status: 200,
          body: mockProjects,
          headers: new HttpHeaders({ "x-next-page": "" }),
        }),
      ).pipe(delay(50));
    }

    return next.handle(req);
  }
}
