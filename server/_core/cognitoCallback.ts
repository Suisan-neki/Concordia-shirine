/**
 * Cognito Authorization Code Grant コールバック処理
 * 
 * CognitoのAuthorization Code Grantフローで使用されるコールバックエンドポイント。
 * 認証コードをトークンに交換し、ユーザー情報を取得してセッションを確立する。
 */

import type { Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { authenticateRequest } from "./cognito";
import * as db from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { parse as parseCookieHeader } from "cookie";
import { timingSafeEqual } from "crypto";

const NONCE_COOKIE_NAME = "cognito_auth_nonce";

/**
 * タイミング攻撃に対して安全な文字列比較
 * 
 * @param a - 比較する文字列1
 * @param b - 比較する文字列2
 * @returns 文字列が一致する場合true、そうでない場合false
 */
function safeCompare(a: string, b: string): boolean {
  // 長さが異なる場合は即座にfalseを返す
  if (a.length !== b.length) {
    return false;
  }
  
  // 長さが同じ場合は、Bufferに変換してtimingSafeEqualを使用
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * CognitoのトークンエンドポイントURLを取得
 */
function getTokenEndpoint(): string {
  if (!ENV.cognitoDomain) {
    throw new Error("Cognito domain is missing");
  }
  const domain = ENV.cognitoDomain.startsWith("http")
    ? ENV.cognitoDomain
    : `https://${ENV.cognitoDomain}`;
  return new URL("/oauth2/token", domain).toString();
}

/**
 * 認証コードをトークンに交換
 */
async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{ idToken: string; accessToken: string }> {
  const tokenEndpoint = getTokenEndpoint();
  
  const params = new URLSearchParams();
  params.set("grant_type", "authorization_code");
  params.set("client_id", ENV.cognitoClientId);
  params.set("code", code);
  params.set("redirect_uri", redirectUri);

  console.log("[Cognito] Token exchange request:", {
    tokenEndpoint,
    clientId: ENV.cognitoClientId,
    redirectUri,
    codeLength: code.length,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Cognito] Token exchange failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      tokenEndpoint,
      redirectUri,
    });
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  const data = await response.json() as {
    id_token: string;
    access_token: string;
    token_type?: string;
    expires_in?: number;
  };

  console.log("[Cognito] Token exchange successful");

  return {
    idToken: data.id_token,
    accessToken: data.access_token,
  };
}

/**
 * Cognitoコールバックエンドポイントを処理
 */
export async function handleCognitoCallback(req: Request, res: Response): Promise<void> {
  console.log("[Cognito] Callback received:", {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    host: req.get("host"),
    protocol: req.protocol,
  });

  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const error = typeof req.query.error === "string" ? req.query.error : null;

  // エラーパラメータがある場合はエラーを返す
  if (error) {
    console.error("[Cognito] Callback error:", error, req.query.error_description);
    res.status(400).json({ error: `Cognito authentication failed: ${error}` });
    return;
  }

  // codeとstateが必須
  if (!code || !state) {
    console.error("[Cognito] Missing required parameters:", { code: !!code, state: !!state });
    res.status(400).json({ error: "code and state are required" });
    return;
  }

  try {
    // stateからリダイレクトパスとnonceを取得
    // stateを検証してCSRF攻撃を防ぐ
    let redirectPath = "/";
    let stateNonce: string | undefined;
    
    try {
      // base64urlデコード（ブラウザでエンコードされたstateをデコード）
      const decoded = Buffer.from(state, "base64url").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (parsed.redirectPath) {
        redirectPath = parsed.redirectPath;
      }
      if (parsed.nonce) {
        stateNonce = parsed.nonce;
      }
      console.log("[Cognito] State decoded:", { redirectPath, nonce: stateNonce ? stateNonce.substring(0, 10) + "..." : "N/A" });
    } catch (error) {
      console.error("[Cognito] State decode failed:", error);
      res.status(400).json({ error: "Invalid state parameter" });
      return;
    }

    // nonceの検証
    if (!stateNonce) {
      console.error("[Cognito] Nonce not found in state parameter");
      res.status(400).json({ error: "Nonce validation failed: nonce not found in state" });
      return;
    }

    // Cookieから保存されたnonceを取得
    const cookieHeader = req.headers.cookie;
    const cookies = cookieHeader ? parseCookieHeader(cookieHeader) : {};
    const storedNonce = cookies[NONCE_COOKIE_NAME];
    
    if (!storedNonce) {
      console.error("[Cognito] Nonce cookie not found");
      res.status(400).json({ error: "Nonce validation failed: nonce cookie not found" });
      return;
    }

    // stateパラメータのnonceとCookieのnonceを比較（タイミング攻撃に対して安全な比較）
    if (!safeCompare(storedNonce, stateNonce)) {
      console.error("[Cognito] Nonce validation failed: nonce mismatch");
      // セキュリティ上の理由から、詳細な情報はログに出力しない
      res.status(400).json({ error: "Nonce validation failed: nonce mismatch" });
      return;
    }

    // nonce検証成功後、Cookieを削除（ワンタイム使用のため）
    res.clearCookie(NONCE_COOKIE_NAME);
    console.log("[Cognito] Nonce validation successful");

    // リダイレクトURI（コールバックURL）
    // リクエストのプロトコルとホストを使用（開発環境ではhttp://localhost:5173）
    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/cognito/callback`;
    console.log("[Cognito] Redirect URI:", redirectUri);

    // 認証コードをトークンに交換
    const { idToken } = await exchangeCodeForToken(code, redirectUri);

    // IDトークンからユーザー情報を取得
    // 一時的なリクエストオブジェクトを作成してauthenticateRequestを使用
    const mockReq = {
      headers: {
        authorization: `Bearer ${idToken}`,
      },
    } as Request;

    const user = await authenticateRequest(mockReq, { updateUser: true });

    // セッショントークンを生成（有効期限: 1年）
    const sessionName = user.name || user.email || user.openId;
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: sessionName,
      expiresInMs: ONE_YEAR_MS,
    });

    // Cookieにセッショントークンを設定
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    // 認証成功後、リダイレクトパスにリダイレクト
    // 開発環境では5173ポートを使用、本番環境ではリクエストのオリジンを使用
    const isDevelopment = process.env.NODE_ENV === "development";
    const redirectUrl = isDevelopment
      ? `http://localhost:5173${redirectPath}`
      : `${req.protocol}://${req.get("host")}${redirectPath}`;
    
    console.log("[Cognito] Redirecting to:", redirectUrl);
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error("[Cognito] Callback failed:", error);
    // エラーの詳細をログに出力
    if (error instanceof Error) {
      console.error("[Cognito] Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
    // エラーページにリダイレクト（開発環境では5173ポート）
    const isDevelopment = process.env.NODE_ENV === "development";
    const errorUrl = isDevelopment
      ? `http://localhost:5173/?error=auth_failed`
      : `${req.protocol}://${req.get("host")}/?error=auth_failed`;
    res.redirect(302, errorUrl);
  }
}
