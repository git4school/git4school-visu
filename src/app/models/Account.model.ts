export type GitProviderType = "github" | "gitlab";

export interface Account {
  id: string;
  provider: GitProviderType;
  username: string;
  avatarUrl?: string | null;
  instanceHost: string;
  tokenExpiresInDays?: number | null;
  lastSync?: string;
  isCurrent?: boolean;
}
