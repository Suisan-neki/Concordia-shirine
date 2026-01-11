import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { randomBytes } from "crypto";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

// OAuth stateストレージ（CSRF対策用）
interface OAuthState {
  csrfToken: string;
  redirectUri: string;
  createdAt: number;
}

const OAUTH_STATE_STORE = new Map<string, OAuthState>();
const OAUTH_STATE_TTL = 10 * 60 * 1000; // 10分

// 古いstateを定期的にクリーンアップ
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of OAUTH_STATE_STORE.entries()) {
    if (now - state.createdAt > OAUTH_STATE_TTL) {
      OAUTH_STATE_STORE.delete(key);
    }
  }
}, 5 * 60 * 1000); // 5分ごとにクリーンアップ

/**
 * OAuth stateを生成（CSRF対策）
 * OAuth開始時に呼び出して、生成されたstateをOAuthプロバイダーに渡す
 */
export function generateOAuthState(redirectUri: string): string {
  const csrfToken = randomBytes(32).toString('base64url');
  const state = {
    csrfToken,
    redirectUri,
    createdAt: Date.now(),
  };
  const stateKey = randomBytes(16).toString('base64url');
  OAUTH_STATE_STORE.set(stateKey, state);
  
  // stateキーとredirectUriを結合してbase64エンコード
  // 後方互換性のため、既存の形式もサポート
  const combined = JSON.stringify({ key: stateKey, redirectUri });
  return Buffer.from(combined).toString('base64url');
}

/**
 * OAuth stateを検証（CSRF対策）
 */
function verifyOAuthState(stateParam: string): { valid: boolean; redirectUri?: string; error?: string } {
  try {
    // 新しい形式（JSON）を試す
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf-8'));
      if (decoded.key && decoded.redirectUri) {
        const stored = OAUTH_STATE_STORE.get(decoded.key);
        if (!stored) {
          return { valid: false, error: 'State not found or expired' };
        }
        
        // 有効期限チェック
        if (Date.now() - stored.createdAt > OAUTH_STATE_TTL) {
          OAUTH_STATE_STORE.delete(decoded.key);
          return { valid: false, error: 'State expired' };
        }
        
        // redirectUriの一致確認
        if (stored.redirectUri !== decoded.redirectUri) {
          return { valid: false, error: 'Redirect URI mismatch' };
        }
        
        // 使用後は削除（ワンタイム使用）
        OAUTH_STATE_STORE.delete(decoded.key);
        
        return { valid: true, redirectUri: stored.redirectUri };
      }
    } catch {
      // 新しい形式でない場合は後方互換性のため旧形式を試す
      // ただし、セキュリティ警告をログに記録
      console.warn('[OAuth] Using legacy state format without CSRF protection');
      const redirectUri = Buffer.from(stateParam, 'base64url').toString('utf-8');
      return { valid: true, redirectUri };
    }
    
    return { valid: false, error: 'Invalid state format' };
  } catch (error) {
    return { valid: false, error: `State verification failed: ${String(error)}` };
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF対策: stateパラメータを検証
    const stateVerification = verifyOAuthState(state);
    if (!stateVerification.valid) {
      console.error("[OAuth] State verification failed:", stateVerification.error);
      res.status(403).json({ error: "Invalid or expired state parameter. CSRF protection triggered." });
      return;
    }

    try {
      // 検証済みのredirectUriを使用
      const redirectUri = stateVerification.redirectUri || state;
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
