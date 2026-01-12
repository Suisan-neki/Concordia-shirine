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
    // stateからリダイレクトパスを取得（簡易実装）
    // 実際には、stateを検証してCSRF攻撃を防ぐ必要がある
    let redirectPath = "/";
    try {
      // base64urlデコード（ブラウザでエンコードされたstateをデコード）
      const decoded = Buffer.from(state, "base64url").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (parsed.redirectPath) {
        redirectPath = parsed.redirectPath;
      }
      console.log("[Cognito] State decoded:", { redirectPath, nonce: parsed.nonce });
    } catch (error) {
      console.warn("[Cognito] State decode failed:", error);
      // stateの解析に失敗した場合はデフォルトパスを使用
    }

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

    const user = await authenticateRequest(mockReq);

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
