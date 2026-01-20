export interface AuthUser {
  id: number;
  openId: string;
  name: string;
  email: string;
  loginMethod: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  lastSignedIn?: string;
}
