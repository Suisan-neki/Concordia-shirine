/**
 * 本番環境かどうかを判定する
 * 
 * NODE_ENV環境変数が"production"の場合は本番環境とみなす
 */
const isProduction = process.env.NODE_ENV === "production";

/**
 * 環境変数を検証する
 * 
 * アプリケーション起動時に必須の環境変数が設定されているかを確認する。
 * 本番環境では、推奨環境変数が設定されていない場合に警告を出力する。
 * 
 * 検証の流れ:
 * 1. 必須環境変数（JWT_SECRET、DATABASE_URL、VITE_APP_ID）をチェック
 * 2. 本番環境の場合、推奨環境変数（ALLOWED_ORIGINS、認証設定）をチェック
 * 3. エラーがある場合は例外を投げて起動を停止
 * 4. 警告がある場合はログに出力（起動は継続）
 * 
 * @throws {Error} 必須環境変数が設定されていない場合
 */
function validateEnv(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 必須の環境変数をチェック
  // これらの環境変数が設定されていない場合、アプリケーションは正常に動作しない
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length === 0) {
    errors.push("JWT_SECRET is required");
  }

  // DATABASE_URLは不要（DynamoDBを使用するため）
  // if (!process.env.DATABASE_URL || process.env.DATABASE_URL.length === 0) {
  //   errors.push("DATABASE_URL is required");
  // }

  if (!process.env.VITE_APP_ID || process.env.VITE_APP_ID.length === 0) {
    errors.push("VITE_APP_ID is required");
  }

  // 本番環境での推奨環境変数をチェック
  // これらの環境変数が設定されていない場合でも起動は可能だが、セキュリティや機能が制限される
  if (isProduction) {
    // CORS保護: 許可されたオリジンのリスト
    // 設定されていない場合、すべてのオリジンからのアクセスが許可される（セキュリティリスク）
    if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS.length === 0) {
      warnings.push("ALLOWED_ORIGINS is not set. CORS protection may be incomplete.");
    }

    // 認証設定: OAuthまたはCognitoのいずれかが必要
    // 両方とも設定されていない場合、認証機能が動作しない
    const hasOAuth = process.env.OAUTH_SERVER_URL && process.env.OAUTH_SERVER_URL.length > 0;
    const hasCognito = 
      process.env.COGNITO_REGION && process.env.COGNITO_REGION.length > 0 &&
      process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_USER_POOL_ID.length > 0 &&
      process.env.COGNITO_CLIENT_ID && process.env.COGNITO_CLIENT_ID.length > 0;
    
    if (!hasOAuth && !hasCognito) {
      warnings.push("Neither OAUTH_SERVER_URL nor Cognito configuration is set. Authentication may not work.");
    }
  }

  // 警告をログに出力（起動は継続）
  if (warnings.length > 0) {
    console.warn("[Environment] Warnings:");
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  // エラーがある場合は例外を投げて起動を停止
  if (errors.length > 0) {
    console.error("[Environment] Required environment variables are missing:");
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error(`Missing required environment variables: ${errors.join(", ")}`);
  }
}

// 起動時に環境変数を検証
// モジュールがインポートされた時点で実行される
validateEnv();

/**
 * 環境変数の設定オブジェクト
 * 
 * 検証済みの環境変数にアクセスするための統一インターフェース。
 * 各プロパティは環境変数から取得し、未設定の場合は空文字列またはデフォルト値を返す。
 * 
 * プロパティの説明:
 * - appId: アプリケーションID（OAuth認証に使用）
 * - cookieSecret: JWT署名用のシークレットキー（必須）
 * - databaseUrl: 旧DB接続URL（DynamoDB移行後は未使用）
 * - oAuthServerUrl: OAuth認証サーバーのURL
 * - ownerOpenId: 管理者のOpenID（admin権限の付与に使用）
 * - isProduction: 本番環境かどうかのフラグ
 * - forgeApiUrl: Forge APIのURL
 * - forgeApiKey: Forge APIのキー
 * - cookieSameSite: CookieのSameSite属性（"strict"、"lax"、"none"）
 * - allowedOrigins: CORSで許可するオリジンのリスト（カンマ区切り）
 * - cognitoRegion: AWS Cognitoのリージョン
 * - cognitoUserPoolId: AWS CognitoのユーザープールID
 * - cognitoClientId: AWS CognitoのクライアントID
 * - cognitoDomain: AWS CognitoのホステッドUIドメイン
 * - cognitoJwksUrl: AWS CognitoのJWKS URL（未設定の場合は自動生成）
 */
export const ENV = {
  /** アプリケーションID（OAuth認証に使用） */
  appId: process.env.VITE_APP_ID ?? "",
  /** JWT署名用のシークレットキー（必須） */
  cookieSecret: process.env.JWT_SECRET ?? "",
  /** 旧DB接続URL（未使用） */
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** OAuth認証サーバーのURL */
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  /** 管理者のOpenID（admin権限の付与に使用） */
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  /** 本番環境かどうかのフラグ */
  isProduction,
  /** Forge APIのURL */
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  /** Forge APIのキー */
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** CookieのSameSite属性（デフォルト: "lax"） */
  cookieSameSite: (process.env.COOKIE_SAMESITE ?? "lax").toLowerCase(),
  /** CORSで許可するオリジンのリスト（カンマ区切りから配列に変換） */
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0),
  /** AWS Cognitoのリージョン */
  cognitoRegion: process.env.COGNITO_REGION ?? "",
  /** AWS CognitoのユーザープールID */
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID ?? "",
  /** AWS CognitoのクライアントID */
  cognitoClientId: process.env.COGNITO_CLIENT_ID ?? "",
  /** AWS CognitoのホステッドUIドメイン（Vite用の値を流用する場合はVITE_COGNITO_DOMAIN） */
  cognitoDomain: process.env.COGNITO_DOMAIN ?? process.env.VITE_COGNITO_DOMAIN ?? "",
  /** AWS CognitoのJWKS URL（未設定の場合は自動生成） */
  cognitoJwksUrl: process.env.COGNITO_JWKS_URL ?? "",
};
