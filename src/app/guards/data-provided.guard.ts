import { Injectable } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { DataService } from "@services/data.service";
import { Observable } from "rxjs";

/**
 * This guard ensures that the data is fully loaded
 */
@Injectable({
  providedIn: "root",
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
   * @returns true if fully loaded, false otherwise
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ):
    | boolean
    | UrlTree
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree> {
    return this.dataLoaded();
  }
}
