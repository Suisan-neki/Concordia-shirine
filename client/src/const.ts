export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const NONCE_KEY = "cognito_auth_nonce";

function createNonce(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

// AWS Cognito Hosted UI URL
export const getLoginUrl = () => {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN; // 例: https://concordia-auth-xxxx.auth.ap-northeast-1.amazoncognito.com
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const redirectUri = window.location.origin; // ルートにリダイレクトバック
  const responseType = "token id_token"; // Implicit Grant (MVPの簡潔さのため)
  const nonce = createNonce();

  // Cognito Hosted UI URL を構築
  // https://<domain>/login?client_id=<client_id>&response_type=token&scope=email+openid&redirect_uri=<redirect_uri>
  const url = new URL(`${domain}/login`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", responseType);
  url.searchParams.set("scope", "email openid");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("nonce", nonce);

  sessionStorage.setItem(NONCE_KEY, nonce);

  return url.toString();
};
