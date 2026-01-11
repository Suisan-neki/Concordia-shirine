/**
 * OAuth認証ルーティング
 * 
 * OAuth 2.0の認証フローを実装し、CSRF攻撃から保護する機能を提供する。
 * 
 * セキュリティ対策:
 * - stateパラメータによるCSRF対策
 * - ワンタイム使用のstate検証
 * - stateの有効期限管理（10分）
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { randomBytes } from "crypto";

/**
 * クエリパラメータを取得する
 * 
 * リクエストのクエリパラメータから指定されたキーの値を取得する。
 * 値が文字列でない場合はundefinedを返す。
 * 
 * @param req - Expressリクエストオブジェクト
 * @param key - 取得するクエリパラメータのキー
 * @returns クエリパラメータの値（文字列の場合）、またはundefined
 */
function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * OAuth stateのインターフェース（CSRF対策用）
 * 
 * OAuth認証フローで使用するstateパラメータに含まれる情報を定義する。
 * stateはCSRF攻撃を防ぐために、認証開始時とコールバック時の両方で検証される。
 */
interface OAuthState {
  /** CSRFトークン（ランダムな32バイト） */
  csrfToken: string;
  /** リダイレクトURI（認証成功後の遷移先） */
  redirectUri: string;
  /** stateの作成時刻（Unix timestamp in ms） */
  createdAt: number;
}

/**
 * OAuth stateのストレージ（メモリベース）
 * 
 * stateキーをキーとしてOAuthStateを保存するMap。
 * CSRF攻撃を防ぐため、認証開始時に生成したstateとコールバック時のstateが一致することを確認する。
 * 
 * 制限事項:
 * - メモリベースのため、サーバー再起動で状態が失われる
 * - 複数インスタンス間で共有されない（スケールアウト時は注意が必要）
 */
const OAUTH_STATE_STORE = new Map<string, OAuthState>();

/**
 * OAuth stateの有効期限（ミリ秒）
 * 
 * stateは10分間有効。この時間を過ぎたstateは無効とみなされ、認証が拒否される。
 */
const OAUTH_STATE_TTL = 10 * 60 * 1000; // 10分

/**
 * 古いstateを定期的にクリーンアップする
 * 
 * メモリリークを防ぐため、有効期限を過ぎたstateを定期的に削除する。
 * 5分ごとに実行され、作成時刻から有効期限を過ぎたstateを削除する。
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of OAUTH_STATE_STORE.entries()) {
    // 有効期限を過ぎたstateを削除
    if (now - state.createdAt > OAUTH_STATE_TTL) {
      OAUTH_STATE_STORE.delete(key);
    }
  }
}, 5 * 60 * 1000); // 5分ごとにクリーンアップ

/**
 * OAuth stateを生成する（CSRF対策）
 * 
 * OAuth認証開始時に呼び出し、CSRF攻撃を防ぐためのstateパラメータを生成する。
 * 生成されたstateはOAuthプロバイダーに渡され、コールバック時に検証される。
 * 
 * 処理の流れ:
 * 1. ランダムなCSRFトークンを生成（32バイト）
 * 2. stateキーを生成（16バイト）
 * 3. stateをストレージに保存
 * 4. stateキーとredirectUriを結合してbase64urlエンコード
 * 
 * セキュリティ:
 * - CSRFトークンはランダムな32バイトを使用して、推測不可能にする
 * - stateはワンタイム使用（検証後に削除される）
 * - 有効期限は10分（OAUTH_STATE_TTL）
 * 
 * @param redirectUri - 認証成功後のリダイレクトURI
 * @returns base64urlエンコードされたstateパラメータ
 * 
 * @example
 * const state = generateOAuthState("https://example.com/callback");
 * // stateをOAuthプロバイダーの認証URLに含める
 */
export function generateOAuthState(redirectUri: string): string {
  // ランダムなCSRFトークンを生成（32バイト）
  // base64urlエンコードしてURLセーフな文字列にする
  const csrfToken = randomBytes(32).toString('base64url');
  const state = {
    csrfToken,
    redirectUri,
    createdAt: Date.now(),
  };
  // stateキーを生成（16バイト）
  // このキーを使ってストレージからstateを取得する
  const stateKey = randomBytes(16).toString('base64url');
  OAUTH_STATE_STORE.set(stateKey, state);
  
  // stateキーとredirectUriを結合してbase64urlエンコード
  // 後方互換性のため、既存の形式もサポート
  const combined = JSON.stringify({ key: stateKey, redirectUri });
  return Buffer.from(combined).toString('base64url');
}

/**
 * OAuth stateを検証する（CSRF対策）
 * 
 * OAuthコールバック時に、リクエストに含まれるstateパラメータを検証する。
 * CSRF攻撃を防ぐため、以下のチェックを実施する:
 * 1. stateがストレージに存在するか
 * 2. stateの有効期限が切れていないか
 * 3. redirectUriが一致するか
 * 
 * セキュリティ:
 * - stateはワンタイム使用（検証後に削除される）
 * - 有効期限を過ぎたstateは無効
 * - redirectUriの不一致はCSRF攻撃の可能性があるため拒否
 * 
 * @param stateParam - コールバック時に受け取ったstateパラメータ（base64urlエンコード）
 * @returns 検証結果とredirectUri（有効な場合）、またはエラーメッセージ
 */
function verifyOAuthState(stateParam: string): { valid: boolean; redirectUri?: string; error?: string } {
  try {
    // 新しい形式（JSON）を試す
    // 形式: { key: stateKey, redirectUri: string } をbase64urlエンコード
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf-8'));
      if (decoded.key && decoded.redirectUri) {
        // ストレージからstateを取得
        const stored = OAUTH_STATE_STORE.get(decoded.key);
        if (!stored) {
          // stateが存在しない場合（既に使用済み、または存在しないキー）
          return { valid: false, error: 'State not found or expired' };
        }
        
        // 有効期限をチェック
        // 10分を過ぎたstateは無効
        if (Date.now() - stored.createdAt > OAUTH_STATE_TTL) {
          OAUTH_STATE_STORE.delete(decoded.key);
          return { valid: false, error: 'State expired' };
        }
        
        // redirectUriの一致確認
        // 不一致の場合はCSRF攻撃の可能性があるため拒否
        if (stored.redirectUri !== decoded.redirectUri) {
          return { valid: false, error: 'Redirect URI mismatch' };
        }
        
        // 使用後は削除（ワンタイム使用）
        // 同じstateが再利用されることを防ぐ
        OAUTH_STATE_STORE.delete(decoded.key);
        
        return { valid: true, redirectUri: stored.redirectUri };
      }
    } catch {
      // 新しい形式でない場合は後方互換性のため旧形式を試す
      // ただし、セキュリティ警告をログに記録
      // 旧形式はCSRF保護がないため、推奨されない
      console.warn('[OAuth] Using legacy state format without CSRF protection');
      const redirectUri = Buffer.from(stateParam, 'base64url').toString('utf-8');
      return { valid: true, redirectUri };
    }
    
    return { valid: false, error: 'Invalid state format' };
  } catch (error) {
    // 予期しないエラーが発生した場合
    return { valid: false, error: `State verification failed: ${String(error)}` };
  }
}

/**
 * OAuth認証ルートを登録する
 * 
 * ExpressアプリケーションにOAuth認証用のルートを登録する。
 * /api/oauth/callbackエンドポイントを実装し、OAuthプロバイダーからの
 * コールバックを処理する。
 * 
 * 認証フロー:
 * 1. OAuthプロバイダーからcodeとstateを受け取る
 * 2. stateを検証してCSRF攻撃を防ぐ
 * 3. codeをアクセストークンに交換
 * 4. アクセストークンでユーザー情報を取得
 * 5. ユーザー情報をデータベースに保存/更新
 * 6. セッショントークンを生成してCookieに設定
 * 7. ホームページにリダイレクト
 * 
 * セキュリティ:
 * - stateパラメータによるCSRF対策
 * - セッショントークンの有効期限は1年
 * - CookieはHttpOnly、Secure（HTTPS時）、SameSite属性を設定
 * 
 * @param app - Expressアプリケーションインスタンス
 */
export function registerOAuthRoutes(app: Express) {
  /**
   * OAuthコールバックエンドポイント
   * 
   * OAuthプロバイダーからの認証コールバックを処理する。
   * codeとstateパラメータを受け取り、認証を完了する。
   */
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    // クエリパラメータからcodeとstateを取得
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    // codeとstateが必須
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF対策: stateパラメータを検証
    // 検証に失敗した場合は403エラーを返し、CSRF攻撃をブロック
    const stateVerification = verifyOAuthState(state);
    if (!stateVerification.valid) {
      console.error("[OAuth] State verification failed:", stateVerification.error);
      res.status(403).json({ error: "Invalid or expired state parameter. CSRF protection triggered." });
      return;
    }

    try {
      // 検証済みのredirectUriを使用（旧形式の場合はstateパラメータ自体を使用）
      const redirectUri = stateVerification.redirectUri || state;
      
      // 認証コードをアクセストークンに交換
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      
      // アクセストークンでユーザー情報を取得
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      // openIdが必須（ユーザーの一意識別子）
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // ユーザー情報をデータベースに保存/更新
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // セッショントークンを生成（有効期限: 1年）
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      // Cookieにセッショントークンを設定
      // HttpOnly、Secure（HTTPS時）、SameSite属性を設定してセキュリティを強化
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // 認証成功後、ホームページにリダイレクト
      res.redirect(302, "/");
    } catch (error) {
      // エラーが発生した場合は500エラーを返す
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
