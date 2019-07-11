import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  CanDeactivate
} from '@angular/router';
import { Observable } from 'rxjs';
import { GraphViewComponent } from '../graph-view/graph-view.component';

@Injectable({
  providedIn: 'root'
})
export class DataLoadingGuard implements CanDeactivate<GraphViewComponent> {
  canDeactivate(
    component: GraphViewComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState?: RouterStateSnapshot
  ):
    | boolean
    | UrlTree
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree> {
    console.log(component.loading);
    return !component.loading;
  }
}
