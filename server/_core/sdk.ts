/**
 * OAuth SDKサーバー
 * 
 * OAuth認証とセッション管理の機能を提供するSDK。
 * OAuthプロバイダーとの通信、JWTの生成・検証、セッション管理を行う。
 */
import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";

/**
 * 空でない文字列かどうかを判定する
 * 
 * 型ガード関数。値が文字列型で、かつ空文字列でないことを確認する。
 * 
 * @param value - チェックする値
 * @returns 空でない文字列の場合はtrue、それ以外はfalse
 */
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/**
 * セッショントークンのペイロード
 * 
 * JWTセッショントークンに含まれる情報を定義する。
 */
export type SessionPayload = {
  /** ユーザーのOpenID（一意識別子） */
  openId: string;
  /** アプリケーションID */
  appId: string;
  /** ユーザー名 */
  name: string;
};

/**
 * OAuth APIのエンドポイントパス
 */
const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

/**
 * OAuthサービス
 * 
 * OAuthプロバイダーとの通信を担当するクラス。
 * 認証コードの交換、ユーザー情報の取得を行う。
 */
class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }

  /**
   * stateパラメータをデコードする
   * 
   * base64エンコードされたstateパラメータをデコードして、redirectUriを取得する。
   * 
   * @param state - base64エンコードされたstateパラメータ
   * @returns デコードされたredirectUri
   */
  private decodeState(state: string): string {
    const redirectUri = atob(state);
    return redirectUri;
  }

  /**
   * 認証コードをアクセストークンに交換する
   * 
   * OAuth認証フローで、認証コードをアクセストークンに交換する。
   * 
   * @param code - OAuthプロバイダーから受け取った認証コード
   * @param state - stateパラメータ（redirectUriを含む）
   * @returns アクセストークンを含むレスポンス
   */
  async getTokenByCode(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };

    const { data } = await this.client.post<ExchangeTokenResponse>(
      EXCHANGE_TOKEN_PATH,
      payload
    );

    return data;
  }

  /**
   * アクセストークンでユーザー情報を取得する
   * 
   * OAuthプロバイダーのAPIを呼び出し、アクセストークンを使用してユーザー情報を取得する。
   * 
   * @param token - アクセストークンを含むトークンレスポンス
   * @returns ユーザー情報（openId、name、emailなど）
   */
  async getUserInfoByToken(
    token: ExchangeTokenResponse
  ): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken,
      }
    );

    return data;
  }
}

/**
 * OAuth HTTPクライアントを作成する
 * 
 * OAuthプロバイダーとの通信に使用するAxiosインスタンスを作成する。
 * 
 * @returns Axiosインスタンス
 */
const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

/**
 * SDKサーバー
 * 
 * OAuth認証とセッション管理の機能を提供するメインクラス。
 * OAuthサービスとHTTPクライアントを管理し、高レベルなAPIを提供する。
 */
class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  /**
   * ログイン方法を取得する
   * 
   * プラットフォーム情報からログイン方法（email、google、apple、microsoft、github）を判定する。
   * フォールバック値が指定されている場合はそれを優先する。
   * 
   * @param platforms - プラットフォームの配列
   * @param fallback - フォールバック値（優先される）
   * @returns ログイン方法（"email"、"google"、"apple"、"microsoft"、"github"など）、またはnull
   */
  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    // フォールバック値が指定されている場合はそれを優先
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    
    // プラットフォームをセットに変換
    const set = new Set<string>(
      platforms.filter((p): p is string => typeof p === "string")
    );
    
    // プラットフォーム名からログイン方法を判定
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    )
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    
    // 一致するプラットフォームがない場合は、最初の要素を小文字に変換して返す
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoResponse;
  }

  /**
   * Cookieヘッダーをパースする
   * 
   * Cookieヘッダーの文字列をパースして、キーと値のMapに変換する。
   * 
   * @param cookieHeader - Cookieヘッダーの文字列
   * @returns Cookieのキーと値のMap
   */
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  /**
   * セッション署名用のシークレットを取得する
   * 
   * JWTの署名に使用するシークレットキーを取得する。
   * 環境変数が設定されていない場合はエラーを投げる。
   * 
   * @returns シークレットキー（Uint8Array形式）
   * @throws {Error} JWT_SECRET環境変数が設定されていない場合
   */
  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret || secret.length === 0) {
      throw new Error('JWT_SECRET environment variable is required. Cannot use default secret in production.');
    }
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  /**
   * セッションを署名する
   * 
   * セッションペイロードからJWTを生成する。
   * 署名アルゴリズムはHS256を使用し、有効期限を設定する。
   * 
   * @param payload - セッションペイロード（openId、appId、name）
   * @param options - オプション（有効期限など）
   * @returns 署名されたJWT文字列
   */
  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  /**
   * セッションを検証する
   * 
   * Cookieに含まれるJWTセッショントークンを検証し、ペイロードを返す。
   * 検証に失敗した場合はnullを返す（エラーを投げない）。
   * 
   * 検証項目:
   * - 署名の検証（改ざんの検知）
   * - 有効期限の検証（joseライブラリが自動的に行う）
   * - 必須フィールドの存在確認（openId、appId、name）
   * 
   * @param cookieValue - Cookieに含まれるJWT文字列
   * @returns 検証成功時はセッションペイロード、失敗時はnull
   */
  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      // JWTを検証（署名、有効期限など）
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      // 必須フィールドの存在確認
      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      // 検証に失敗した場合はエラーを無視してnullを返す
      // これにより、無効なトークンでもエラーでアプリケーションが停止しない
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async getUserInfoWithJwt(
    jwtToken: string
  ): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoWithJwtResponse;
  }

  /**
   * リクエストを認証する
   * 
   * Cookieに含まれるセッショントークンを使用してリクエストを認証する。
   * 認証に成功した場合、データベースからユーザー情報を取得し、最後のログイン時刻を更新する。
   * 
   * 認証フロー:
   * 1. Cookieからセッショントークンを取得
   * 2. セッショントークンを検証
   * 3. データベースからユーザー情報を取得
   * 4. ユーザーが存在しない場合は、OAuthサーバーからユーザー情報を取得してデータベースに保存
   * 5. 最後のログイン時刻を更新
   * 6. ユーザーオブジェクトを返す
   * 
   * @param req - Expressリクエストオブジェクト
   * @returns 認証されたユーザーオブジェクト
   * @throws {ForbiddenError} セッションが無効、またはユーザー情報の取得に失敗した場合
   */
  async authenticateRequest(
    req: Request,
    options: { updateLastSignedIn?: boolean } = {}
  ): Promise<User> {
    // Regular authentication flow
    // Cookieからセッショントークンを取得
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    // セッションが無効な場合はエラー
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();
    let user = await db.getUserByOpenId(sessionUserId);

    // ユーザーがデータベースに存在しない場合、OAuthサーバーからユーザー情報を取得
    // これにより、データベースとOAuthサーバーを同期する
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    if (options.updateLastSignedIn) {
      // 最後のログイン時刻を更新
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: signedInAt,
      });
    }

    return user;
  }
}

export const sdk = new SDKServer();
