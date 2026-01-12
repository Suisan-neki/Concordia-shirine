/**
 * AWS Cognito認証
 * 
 * AWS Cognitoを使用したJWTベースの認証機能を提供する。
 * Bearerトークン方式でリクエストを認証し、ユーザー情報を取得する。
 * 
 * 認証フロー:
 * 1. リクエストからBearerトークンを取得
 * 2. CognitoのJWKSエンドポイントから公開鍵を取得
 * 3. JWTを検証（署名、発行者、有効期限など）
 * 4. ユーザー情報をデータベースに保存/更新
 * 5. ユーザーオブジェクトを返す
 */
import { ForbiddenError } from "@shared/_core/errors";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

/**
 * Cognitoの発行者URLを取得する
 * 
 * CognitoのユーザープールIDとリージョンから発行者URLを生成する。
 * 環境変数が設定されていない場合は空文字列を返す。
 * 
 * @returns Cognitoの発行者URL、または空文字列（未設定の場合）
 */
const getIssuer = () => {
  if (!ENV.cognitoRegion || !ENV.cognitoUserPoolId) return "";
  return `https://cognito-idp.${ENV.cognitoRegion}.amazonaws.com/${ENV.cognitoUserPoolId}`;
};

/**
 * CognitoのJWKS URL
 * 
 * 環境変数で設定されている場合はそれを使用し、
 * 未設定の場合は発行者URLから自動生成する。
 * JWKS（JSON Web Key Set）はJWTの検証に使用する公開鍵のセット。
 */
const jwksUrl =
  ENV.cognitoJwksUrl ||
  (ENV.cognitoRegion && ENV.cognitoUserPoolId
    ? `${getIssuer()}/.well-known/jwks.json`
    : "");

/**
 * CognitoのJWKS（リモート公開鍵セット）
 * 
 * JWTの署名を検証するために使用する公開鍵セット。
 * リモートエンドポイントから取得し、キャッシュされる。
 */
const jwks = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null;

/**
 * Bearerトークンを取得する
 * 
 * リクエストのAuthorizationヘッダーからBearerトークンを抽出する。
 * Bearerトークンは"Bearer <token>"の形式で送信される。
 * 
 * 処理の流れ:
 * 1. Authorizationヘッダーを取得（大文字小文字を区別しない）
 * 2. ヘッダー値を" "で分割してトークンタイプとトークンを取得
 * 3. トークンタイプが"bearer"の場合のみトークンを返す
 * 
 * @param req - Expressリクエストオブジェクト
 * @returns Bearerトークン、またはnull（トークンが見つからない場合）
 */
function getBearerToken(req: Request): string | null {
  // Authorizationヘッダーを取得（大文字小文字を区別しない）
  const header =
    req.headers.authorization ||
    (req.headers as Record<string, string | string[] | undefined>).Authorization;
  if (!header) return null;
  
  // ヘッダー値が配列の場合は最初の要素を使用
  const value = Array.isArray(header) ? header[0] : header;
  const [type, token] = value.split(" ");
  
  // トークンタイプが"bearer"で、トークンが存在する場合のみ返す
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/**
 * リクエストを認証する（AWS Cognito）
 * 
 * リクエストに含まれるBearerトークンを使用して、AWS Cognitoで認証を行う。
 * JWTを検証し、ユーザー情報をデータベースに保存/更新してからユーザーオブジェクトを返す。
 * 
 * 認証フロー:
 * 1. リクエストからBearerトークンを取得
 * 2. Cognitoの設定（JWKS、Client ID、Issuer）を確認
 * 3. JWTを検証（署名、発行者、有効期限、audience）
 * 4. トークンのペイロードからユーザー情報（openId、name、email）を取得
 * 5. データベースからユーザーを取得、存在しない場合は作成
 * 6. ユーザー情報を更新（最後のログイン時刻を更新）
 * 7. ユーザーオブジェクトを返す
 * 
 * セキュリティ:
 * - JWTの署名を検証して、トークンの改ざんを検知
 * - 発行者（issuer）とaudience（client ID）を検証
 * - 有効期限を検証（joseライブラリが自動的に行う）
 * 
 * @param req - Expressリクエストオブジェクト
 * @returns 認証されたユーザーオブジェクト
 * @throws {ForbiddenError} トークンが存在しない、設定が不完全、またはトークンの検証に失敗した場合
 * 
 * @example
 * const user = await authenticateRequest(req);
 * console.log(`認証されたユーザー: ${user.name}`);
 */
export async function authenticateRequest(
  req: Request,
  options: { updateUser?: boolean } = {}
): Promise<User> {
  // Bearerトークンを取得
  const token = getBearerToken(req);
  if (!token) {
    throw ForbiddenError("Missing Authorization token");
  }
  
  // Cognitoの設定を確認
  // JWKSとClient IDが設定されていない場合は認証できない
  if (!jwks || !ENV.cognitoClientId) {
    throw ForbiddenError("Cognito auth is not configured");
  }

  // 発行者URLを取得
  const issuer = getIssuer();
  if (!issuer) {
    throw ForbiddenError("Cognito issuer is not configured");
  }

  // JWTを検証
  // 署名、発行者、audience、有効期限を検証する
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: ENV.cognitoClientId,
  });

  // トークンタイプを確認（IDトークンのみ許可）
  // token_useが"id"以外の場合は拒否
  if (payload.token_use && payload.token_use !== "id") {
    throw ForbiddenError("Invalid token type");
  }

  // ペイロードからユーザー情報を取得
  // sub（subject）はユーザーの一意識別子（openIdとして使用）
  const openId = typeof payload.sub === "string" ? payload.sub : null;
  if (!openId) {
    throw ForbiddenError("Invalid token payload");
  }

  // デバッグ: ペイロードの内容を確認
  if (process.env.DEBUG_AUTH === "true") {
    console.log("[Cognito] Token payload keys:", Object.keys(payload));
    console.log("[Cognito] Token payload (name-related):", {
      name: payload.name ? "[REDACTED]" : undefined,
      given_name: payload.given_name ? "[REDACTED]" : undefined,
      family_name: payload.family_name ? "[REDACTED]" : undefined,
      "cognito:username": payload["cognito:username"] ? "[REDACTED]" : undefined,
      email: payload.email ? "[REDACTED]" : undefined,
    });
  }

  // オプションのユーザー情報を取得
  // CognitoのIDトークンには、name、given_name、family_name、cognito:usernameなどが含まれる可能性がある
  // 優先順位: name > given_name + family_name > cognito:username
  let name: string | null = null;
  if (typeof payload.name === "string" && payload.name) {
    name = payload.name;
  } else if (typeof payload.given_name === "string" || typeof payload.family_name === "string") {
    // given_nameとfamily_nameを組み合わせる
    const givenName = typeof payload.given_name === "string" ? payload.given_name : "";
    const familyName = typeof payload.family_name === "string" ? payload.family_name : "";
    name = `${givenName} ${familyName}`.trim() || null;
  } else if (typeof payload["cognito:username"] === "string" && payload["cognito:username"]) {
    // フォールバック: cognito:usernameを使用
    name = payload["cognito:username"];
  }
  
  const email = typeof payload.email === "string" ? payload.email : null;
  
  // デバッグ: 抽出されたユーザー情報を確認（個人情報はマスク）
  if (process.env.DEBUG_AUTH === "true") {
    console.log("[Cognito] Extracted user info:", {
      openId: openId ? `${openId.substring(0, 10)}...` : null,
      name: name ? "[REDACTED]" : null,
      email: email ? "[REDACTED]" : null,
    });
  }

  const shouldUpdateUser = options.updateUser === true;

  // データベースからユーザーを取得
  let user = await db.getUserByOpenId(openId);
  if (!user) {
    // ユーザーが存在しない場合は新規作成
    await db.upsertUser({
      openId,
      name,
      email,
      loginMethod: "cognito",
      lastSignedIn: new Date(),
    });
    user = await db.getUserByOpenId(openId);
  } else if (shouldUpdateUser && !user.deletedAt) {
    await db.upsertUser({
      openId,
      name: name || user.name || null,
      email: email || user.email || null,
      loginMethod: user.loginMethod || "cognito",
      lastSignedIn: new Date(),
    });
    user = await db.getUserByOpenId(openId);
  }

  // ユーザーが取得できない場合（データベースエラーなど）
  if (!user) {
    throw ForbiddenError("User not found");
  }

  return user;
}
