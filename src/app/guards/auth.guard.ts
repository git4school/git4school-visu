import { Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";
import { AccountsService } from "@services/accounts.service";

/**
 * This guard ensures the user is connected with at least one Git provider account
 */
@Injectable({
  providedIn: "root",
})
export class AuthGuard implements CanActivate {
  /**
   * AuthGuard constructor
   * @param accountsService
   * @param router
   */
  constructor(private accountsService: AccountsService, private router: Router) {}

  /**
   * Allows access to the protected route if at least one account is connected
   * @returns true if connected, redirects to home otherwise
   */
  canActivate(): boolean {
    if (!this.accountsService.isEmpty()) {
      return true;
    }
    this.router.navigate(["/home"]);
    return false;
  }
}
