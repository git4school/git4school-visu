import { Injectable } from "@angular/core";
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { from, Observable, throwError } from "rxjs";
import { catchError, switchMap } from "rxjs/operators";
import { GitlabAuthService } from "@services/gitlab-auth.service";

@Injectable()
export class GitlabAuthInterceptor implements HttpInterceptor {
  constructor(private gitlabAuthService: GitlabAuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isGitlabApiRequest(req)) {
      return next.handle(req);
    }

    return from(this.gitlabAuthService.ensureValidToken()).pipe(
      switchMap((token) => {
        const authorizedReq = token ? this.cloneWithAuth(req, token) : req;

        return next.handle(authorizedReq).pipe(
          catchError((error: any) => {
            if (error instanceof HttpErrorResponse && error.status === 401 && this.gitlabAuthService.isSignedIn()) {
              return from(this.gitlabAuthService.refreshAccessToken()).pipe(
                switchMap((newToken) => {
                  if (newToken) {
                    const retriedReq = this.cloneWithAuth(req, newToken);
                    return next.handle(retriedReq);
                  }
                  return throwError(error);
                }),
              );
            }
            return throwError(error);
          }),
        );
      }),
    );
  }

  private isGitlabApiRequest(req: HttpRequest<any>): boolean {
    const url = req.url;

    // Do not intercept oauth token requests to prevent recursive calls
    if (url.includes("/oauth/token")) {
      return false;
    }

    const host = this.gitlabAuthService.instanceHost;
    return url.includes("/api/v4/") || (host ? url.includes(host) : false);
  }

  private cloneWithAuth(req: HttpRequest<any>, token: string): HttpRequest<any> {
    return req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }
}
