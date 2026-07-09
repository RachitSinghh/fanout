/** Consumer Gmail vs. Google Workspace — drives the daily-cap default. */
export type AccountType = 'consumer' | 'workspace' | 'unknown';

export interface UserIdentity {
  email: string;
  name: string;
  /** Stable Google account id (`sub` claim). */
  sub: string | null;
  /** Hosted domain (`hd` claim) if a Workspace account. */
  hostedDomain: string | null;
  accountType: AccountType;
}

export type AuthStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AuthState {
  status: AuthStatus;
  identity: UserIdentity | null;
  error: string | null;
}
