import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, CanDeactivate } from "@angular/router";
import { Observable } from "rxjs";

import { CommitsComponent } from "@components/graphs/commits/commits.component";

/**
 * This guard ensures that loading is finished
 */
@Injectable({
  providedIn: "root",
})
export class DataLoadingGuard implements CanDeactivate<CommitsComponent> {
  /**
   * Allows to leave the component if the loading is completed
   * @param component The component currently calling this method
   * @returns true if the loading variable of the component is set to false, false otherwise
   */
  canDeactivate(
    component: CommitsComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState?: RouterStateSnapshot,
  ): boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree> {
    return !component.loading;
  }
}
