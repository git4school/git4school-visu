export type GitProviderType = "github" | "gitlab";
export type TokenStatus = "valid" | "invalid" | "unknown";

export interface Account {
  id: string;
  provider: GitProviderType;
  username: string;
  avatarUrl?: string | null;
  instanceHost: string;
  instanceName?: string;
  authType?: "oauth" | "pat";
  tokenExpiresInDays?: number | null;
  lastSync?: string;
  isCurrent?: boolean;
  tokenStatus?: TokenStatus;
}
