import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  CanDeactivate
} from '@angular/router';
import { Observable } from 'rxjs';

import { OverviewComponent } from '@components/graphs/overview/overview.component';

@Injectable({
  providedIn: 'root'
})
export class DataLoadingGuard implements CanDeactivate<OverviewComponent> {
  canDeactivate(
    component: OverviewComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState?: RouterStateSnapshot
  ):
    | boolean
    | UrlTree
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree> {
    return !component.loading;
  }
}
