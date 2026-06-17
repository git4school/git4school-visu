import {
  ActivatedRouteSnapshot,
  CanActivate,
  RouterStateSnapshot,
  Router
} from '@angular/router';
import { Observable } from 'rxjs/Observable';
import { Injectable } from '@angular/core';
import 'firebase/auth';

import { AuthService } from '@services/auth.service';

/**
 * This guard ensures the user is connected with a Github account
 */
@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  /**
   * AuthGuard constructor
   * @param authService
   * @param router
   */
  constructor(private authService: AuthService, private router: Router) {}

  /**
   * Allows access to the protected route if user is connected
   * @returns true if connected, redirects to home otherwise
   */
  canActivate(): Observable<boolean> | Promise<boolean> | boolean {
    if (this.authService.isSignedIn()) {
      return true;
    } else {
      this.router.navigate(['/home']);
    }
  }
}
