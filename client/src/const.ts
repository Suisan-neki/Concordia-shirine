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

function encodeBase64Url(value: string): string {
  // TextEncoderを使用してUTF-8バイト配列に変換
  const utf8Bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// AWS Cognito Hosted UI URL
export const getLoginUrl = (redirectPath?: string) => {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN; // 例: https://concordia-auth-xxxx.auth.ap-northeast-1.amazoncognito.com
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

  if (!domain || !clientId) {
    console.warn("[Auth] Cognito環境変数が設定されていません。");
    return "/";
  }

  const path = redirectPath || window.location.pathname;
  const nonce = createNonce();

  const state = encodeBase64Url(
    JSON.stringify({
      redirectPath: path !== "/" ? path : "/",
      nonce,
    })
  );

  let cognitoDomain = domain;
  if (!cognitoDomain.startsWith("https://")) {
    cognitoDomain = `https://${cognitoDomain}`;
  }

  const callbackUri = `${window.location.origin}/api/auth/cognito/callback`;
  const params = new URLSearchParams();
  params.set("client_id", clientId);
  params.set("response_type", "code");
  params.set("scope", "email openid");
  params.set("redirect_uri", callbackUri);
  params.set("state", state);

  // nonceをsessionStorageに保存（将来のクライアント側検証用に保持）
  // Note: 現在はサーバー側のCookie検証のみ使用
  sessionStorage.setItem(NONCE_KEY, nonce);
  
  // nonceをCookieに保存（サーバー側の検証用）
  // サーバーはこのCookieを読み取ってstateパラメータ内のnonceと比較する
  // 有効期限は10分（認証フローが完了するまでの時間）
  const cookieMaxAge = 10 * 60; // 10分（秒単位）
  document.cookie = `cognito_auth_nonce=${nonce}; max-age=${cookieMaxAge}; path=/; SameSite=Lax`;

  return `${cognitoDomain}/login?${params.toString()}`;
};
