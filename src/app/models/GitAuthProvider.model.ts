import { Observable } from "rxjs";
import { Account, GitProviderType } from "./Account.model";

export { GitProviderType } from "./Account.model";

export interface GitAuthProvider {
  readonly provider: GitProviderType;
  readonly name: string;
  readonly instanceHost: string;
  readonly authChange$: Observable<any>;

  isSignedIn(): boolean;
  getAccount(): Account | null;
  signIn(rememberMe?: boolean): Promise<Account | void>;
  signOut(): Promise<void> | void;
  getProfileUrl(username?: string): string;
}
