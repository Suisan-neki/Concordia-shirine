export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// AWS Cognito Hosted UI URL
export const getLoginUrl = () => {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN; // 例: https://concordia-auth-xxxx.auth.ap-northeast-1.amazoncognito.com
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const redirectUri = window.location.origin; // ルートにリダイレクトバック
  const responseType = "token"; // Implicit Grant (MVPの簡潔さのため)

  // Cognito Hosted UI URL を構築
  // https://<domain>/login?client_id=<client_id>&response_type=token&scope=email+openid&redirect_uri=<redirect_uri>
  const url = new URL(`${domain}/login`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", responseType);
  url.searchParams.set("scope", "email openid");
  url.searchParams.set("redirect_uri", redirectUri);

  return url.toString();
};
