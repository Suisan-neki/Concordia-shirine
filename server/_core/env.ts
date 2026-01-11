const isProduction = process.env.NODE_ENV === "production";

/**
 * 環境変数を検証する
 * 本番環境では必須の環境変数が設定されていない場合にエラーを投げる
 */
function validateEnv(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 必須の環境変数
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length === 0) {
    errors.push("JWT_SECRET is required");
  }

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.length === 0) {
    errors.push("DATABASE_URL is required");
  }

  if (!process.env.VITE_APP_ID || process.env.VITE_APP_ID.length === 0) {
    errors.push("VITE_APP_ID is required");
  }

  // 本番環境での推奨環境変数
  if (isProduction) {
    if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS.length === 0) {
      warnings.push("ALLOWED_ORIGINS is not set. CORS protection may be incomplete.");
    }

    // OAuthまたはCognitoのいずれかが必要
    const hasOAuth = process.env.OAUTH_SERVER_URL && process.env.OAUTH_SERVER_URL.length > 0;
    const hasCognito = 
      process.env.COGNITO_REGION && process.env.COGNITO_REGION.length > 0 &&
      process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_USER_POOL_ID.length > 0 &&
      process.env.COGNITO_CLIENT_ID && process.env.COGNITO_CLIENT_ID.length > 0;
    
    if (!hasOAuth && !hasCognito) {
      warnings.push("Neither OAUTH_SERVER_URL nor Cognito configuration is set. Authentication may not work.");
    }
  }

  // 警告を表示
  if (warnings.length > 0) {
    console.warn("[Environment] Warnings:");
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  // エラーがある場合は停止
  if (errors.length > 0) {
    console.error("[Environment] Required environment variables are missing:");
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error(`Missing required environment variables: ${errors.join(", ")}`);
  }
}

// 起動時に環境変数を検証
validateEnv();

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  cookieSameSite: (process.env.COOKIE_SAMESITE ?? "lax").toLowerCase(),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0),
  cognitoRegion: process.env.COGNITO_REGION ?? "",
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID ?? "",
  cognitoClientId: process.env.COGNITO_CLIENT_ID ?? "",
  cognitoJwksUrl: process.env.COGNITO_JWKS_URL ?? "",
};
