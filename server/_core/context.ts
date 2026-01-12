/**
 * tRPCコンテキスト
 * 
 * tRPCの各プロシージャで使用するコンテキストを定義する。
 * リクエストオブジェクト、レスポンスオブジェクト、認証されたユーザー情報を含む。
 */
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { COOKIE_NAME } from "@shared/const";
import type { User } from "../../drizzle/schema";
import { authenticateRequest } from "./cognito";
import { sdk } from "./sdk";

/**
 * tRPCコンテキストの型定義
 * 
 * 各tRPCプロシージャで使用できるコンテキストの構造を定義する。
 */
export type TrpcContext = {
  /** Expressリクエストオブジェクト */
  req: CreateExpressContextOptions["req"];
  /** Expressレスポンスオブジェクト */
  res: CreateExpressContextOptions["res"];
  /** 認証されたユーザー（認証に失敗した場合や公開プロシージャの場合はnull） */
  user: User | null;
};

/**
 * tRPCコンテキストを生成する
 * 
 * tRPCの各リクエストで呼び出され、コンテキストを生成する。
 * リクエストを認証し、認証に成功した場合はユーザー情報をコンテキストに含める。
 * 
 * 認証の扱い:
 * - 認証に失敗した場合でも、エラーを投げずにuserをnullに設定する
 * - これにより、公開プロシージャ（認証不要）と保護プロシージャ（認証必須）の両方をサポート
 * - 保護プロシージャでは、userがnullの場合にエラーを投げるミドルウェアを使用
 * 
 * @param opts - tRPCのコンテキスト生成オプション（Expressアダプターから渡される）
 * @returns tRPCコンテキストオブジェクト
 * 
 * @example
 * const ctx = await createContext(opts);
 * if (ctx.user) {
 *   // 認証されたユーザーの処理
 * }
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // リクエストを認証（Cognito Bearerトークンを使用）
    // 認証に成功した場合はユーザー情報を取得
    user = await authenticateRequest(opts.req);
  } catch (error) {
    // 認証に失敗した場合はエラーを無視し、userをnullに設定
    // これにより、公開プロシージャ（認証不要）でもエラーが発生しない
    // Authentication is optional for public procedures.
    user = null;
  }

  // Cognito認証が成功した場合は、セッションCookie認証をスキップ
  // セッションCookie認証は、Cognito認証が失敗した場合のみ試行する
  if (!user && hasSessionCookie(opts.req)) {
    try {
      // セッションCookie認証を試行（Cognitoコールバックで発行したセッションを含む）
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // セッションCookie認証のエラーは無視（Cognito認証が優先）
      console.warn(
        "[Auth] Session authentication failed:",
        error instanceof Error ? error.message : String(error)
      );
      user = null;
    }
  }

  // コンテキストを返す
  // req、res、userを含むオブジェクトを返す
  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

function hasSessionCookie(req: CreateExpressContextOptions["req"]): boolean {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return false;
  return cookieHeader
    .split(";")
    .some(cookie => cookie.trim().startsWith(`${COOKIE_NAME}=`));
}
