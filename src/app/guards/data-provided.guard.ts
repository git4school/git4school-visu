import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  CanActivate,
  Router
} from '@angular/router';
import { Observable } from 'rxjs';

import { DataService } from '@services/data.service';

/**
 * This guard ensures that the data is fully loaded
 */
@Injectable({
  providedIn: 'root'
})
export class DataProvidedGuard implements CanActivate {
  /**
   * DataProvidedGuard constructor
   * @param dataService
   * @param router
   */
  constructor(private dataService: DataService, private router: Router) {}

  /**
   * Returns a boolean indicating if data is fully loaded
   * @return true if data is fully loaded, false otherwise
   */
  dataLoaded() {
    return this.dataService.dataLoaded;
  }

  /**
   * Allows access to the protected route if the data is fully loaded
   * @param route
   * @param state
   * @returns true if fully loaded, redirects to overview graph otherwise
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ):
    | boolean
    | UrlTree
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree> {
    if (this.dataLoaded()) {
      return true;
    } else {
      this.router.navigate(['/overview']);
    }
  }
}
