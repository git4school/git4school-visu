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

@Injectable({
  providedIn: 'root'
})
export class DataProvidedGuard implements CanActivate {
  constructor(private dataService: DataService, private router: Router) {}

  dataLoaded() {
    return this.dataService.dataLoaded;
  }

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
