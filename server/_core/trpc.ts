/**
 * tRPC設定
 * 
 * tRPC（TypeScript Remote Procedure Call）の設定とミドルウェアを定義する。
 * 型安全なAPI呼び出しを実現し、認証と認可のミドルウェアを提供する。
 */
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

/**
 * tRPCインスタンス
 * 
 * コンテキストの型を指定し、superjsonを使用してJSONシリアライズを行う。
 * superjsonにより、DateやRegExpなどの特殊な型をJSONとして送受信できる。
 */
const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

/**
 * ルーター作成関数
 * 
 * tRPCのルーターを作成する関数をエクスポート。
 */
export const router = t.router;

/**
 * 公開プロシージャ
 * 
 * 認証不要のプロシージャ。誰でもアクセスできるエンドポイントで使用する。
 * 例: ログイン、ログアウト、現在のユーザー情報の取得など。
 */
export const publicProcedure = t.procedure;

/**
 * ユーザー認証を要求するミドルウェア
 * 
 * リクエストにユーザー情報が含まれているかを確認する。
 * ユーザーが認証されていない場合はUNAUTHORIZEDエラーを投げる。
 * 
 * 処理の流れ:
 * 1. コンテキストからユーザー情報を取得
 * 2. ユーザーが存在しない場合はエラーを投げる
 * 3. ユーザーが存在する場合は次のミドルウェア/プロシージャに進む
 * 
 * @throws {TRPCError} ユーザーが認証されていない場合（UNAUTHORIZED）
 */
const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  // ユーザーが認証されていない場合はエラーを投げる
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // 認証されたユーザーをコンテキストに含めて次に進む
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * 保護されたプロシージャ
 * 
 * 認証が必要なプロシージャ。このプロシージャを使用するエンドポイントは、
 * ユーザーがログインしている必要がある。
 * 
 * 使用例:
 * - セッション管理
 * - ユーザー固有のデータの取得・更新
 * - セキュリティ統計の取得
 */
export const protectedProcedure = t.procedure.use(requireUser);

/**
 * 管理者専用プロシージャ
 * 
 * 管理者権限が必要なプロシージャ。このプロシージャを使用するエンドポイントは、
 * ユーザーがログインしており、かつadminロールを持っている必要がある。
 * 
 * 処理の流れ:
 * 1. ユーザーが認証されているか確認
 * 2. ユーザーのロールが'admin'であるか確認
 * 3. 条件を満たさない場合はFORBIDDENエラーを投げる
 * 4. 条件を満たす場合は次のプロシージャに進む
 * 
 * @throws {TRPCError} ユーザーが認証されていない、またはadminロールを持っていない場合（FORBIDDEN）
 */
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    // ユーザーが認証されていない、またはadminロールを持っていない場合はエラーを投げる
    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    // 認証された管理者ユーザーをコンテキストに含めて次に進む
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
