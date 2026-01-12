/**
 * tRPCルーター
 * 
 * アプリケーションのAPIエンドポイントを定義する。
 * セッション管理、認証、介入設定、セキュリティ統計などの機能を提供する。
 */
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getSessionBySessionId,
} from "./db";
import { getAllUsers, getUserById, softDeleteUser, getAuditLogs } from "./db_admin";
import { securityService } from "./security";
import { sessionService } from "./services/SessionService";
import { nanoid } from "nanoid";

/**
 * アプリケーションルーター
 * 
 * tRPCのルーター定義。以下のサブルーターを含む:
 * - system: システム関連のエンドポイント
 * - auth: 認証関連のエンドポイント
 * - session: セッション管理のエンドポイント
 * - intervention: 介入設定のエンドポイント
 * - security: セキュリティ統計のエンドポイント
 */
export const appRouter = router({
  /** システム関連のルーター */
  system: systemRouter,
  
  /** 認証関連のルーター */
  auth: router({
    /**
     * 現在のユーザー情報を取得する
     * 
     * 認証されている場合はユーザー情報を返し、認証されていない場合はnullを返す。
     * 公開プロシージャのため、認証は不要。
     * 
     * @returns ユーザー情報、またはnull（未認証の場合）
     */
    me: publicProcedure.query(opts => opts.ctx.user),
    
    /**
     * ログアウトする
     * 
     * セッションCookieを削除してログアウトする。
     * 公開プロシージャのため、認証は不要（Cookieがない場合は何もしない）。
     * 
     * @returns 成功フラグ
     */
    logout: publicProcedure.mutation(({ ctx }) => {
      // Cookieオプションを取得
      const cookieOptions = getSessionCookieOptions(ctx.req);
      // セッションCookieを削除（maxAgeを-1に設定して削除）
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ===== Session Management =====
  session: router({
    /**
     * 新しいセッションを開始
     * セキュリティ: セッション保護が自動的に適用される
     */
    start: protectedProcedure
      .mutation(async ({ ctx }) => {
        return await sessionService.startSession(ctx.user.id);
      }),

    /**
     * セッションを終了し、サマリーを保存
     * セキュリティ: セキュリティサマリーが自動生成される
     */
    end: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        endTime: z.number(),
        duration: z.number(),
        sceneDistribution: z.record(z.string(), z.number()),
        eventCounts: z.record(z.string(), z.number()),
        insights: z.array(z.string()),
      }))
      .mutation(async ({ ctx, input }) => {
        return await sessionService.endSession(ctx.user.id, input.sessionId, input);
      }),

    /**
     * ユーザーのセッション一覧を取得
     */
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await sessionService.listUserSessions(ctx.user.id, input?.limit);
      }),

    /**
     * セッションの詳細を取得
     * セキュリティ: アクセス権限が自動検証される
     */
    get: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        return await sessionService.getSessionWithDetails(ctx.user.id, input.sessionId);
      }),

    /**
     * セッションを削除
     */
    delete: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await sessionService.deleteSession(ctx.user.id, input.sessionId);
      }),

    /**
     * ログエントリを追加
     * セキュリティ: 入力がサニタイズされ、プライバシーが保護される
     */
    addLog: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        type: z.enum(["scene_change", "speech", "event", "intervention"]),
        timestamp: z.number(),
        content: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await sessionService.addLogEntry(
          ctx.user.id,
          input.sessionId,
          input.type as "scene_change" | "speech" | "event" | "intervention",
          input.timestamp,
          input.content,
          input.metadata
        );
      }),
  }),

  // ===== 介入設定 =====
  /**
   * 介入設定のルーター
   * 
   * 会話中の介入（一方的な発話や沈黙の検知）に関する設定を管理する。
   */
  intervention: router({
    /**
     * 介入設定を取得する
     * 
     * ユーザーの介入設定（有効/無効、閾値、サウンド/ビジュアルヒントなど）を取得する。
     * 設定が存在しない場合はデフォルト設定を作成して返す。
     * 
     * @returns 介入設定オブジェクト
     */
    getSettings: protectedProcedure
      .query(async ({ ctx }) => {
        return await sessionService.getInterventionSettings(ctx.user.id);
      }),

    /**
     * 介入設定を更新する
     * 
     * ユーザーの介入設定を更新する。
     * 指定されたフィールドのみが更新され、未指定のフィールドは変更されない。
     * 
     * 入力バリデーション:
     * - monologueThreshold: 5から120秒の範囲
     * - silenceThreshold: 5から60秒の範囲
     * 
     * @param input - 更新する設定（部分的更新をサポート）
     * @returns 成功フラグ
     */
    updateSettings: protectedProcedure
      .input(z.object({
        enabled: z.boolean().optional(),
        monologueThreshold: z.number().min(5).max(120).optional(),
        silenceThreshold: z.number().min(5).max(60).optional(),
        soundEnabled: z.boolean().optional(),
        visualHintEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await sessionService.updateInterventionSettings(ctx.user.id, input);
      }),
  }),

  // ===== セキュリティ (詳細モード用) =====
  /**
   * セキュリティ統計のルーター
   * 
   * バックグラウンドで動作しているセキュリティ機能の統計情報を提供する。
   * 「実は裏でこれだけ動いていました」の情報を表示するために使用される。
   */
  security: router({
    /**
     * ユーザーのセキュリティ統計を取得する
     * 
     * ユーザーに関連するセキュリティイベントの統計情報を取得する。
     * イベントタイプ別の発生回数と最近のイベントを返す。
     * 
     * 「実は裏でこれだけ動いていました」の情報:
     * - 暗号化の適用回数
     * - アクセス権限の検証回数
     * - 入力サニタイズの回数
     * - プライバシー保護の回数
     * - その他のセキュリティイベント
     * 
     * @returns セキュリティ統計（総イベント数、タイプ別の発生回数、最近のイベント）
     */
    getStats: protectedProcedure
      .query(async ({ ctx }) => {
        return await securityService.getUserSecurityStats(ctx.user.id);
      }),

    /**
     * セッションのセキュリティサマリーを取得する
     * 
     * 指定されたセッションに関連するセキュリティイベントのサマリーを取得する。
     * セッションの所有権を確認し、所有者のみがアクセスできる。
     * 
     * @param input - セッションID
     * @returns セキュリティサマリー、またはnull（セッションが見つからない、またはアクセスが拒否された場合）
     */
    getSessionSummary: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        // セッションの所有権を確認
        const session = await getSessionBySessionId(input.sessionId);

        // セッションが存在しない、またはユーザーが所有者でない場合はnullを返す
        if (!session || session.userId !== ctx.user.id) {
          return null;
        }

        // セキュリティサマリーを生成
        return await securityService.generateSecuritySummary(session.id);
      }),
  }),

  // ===== 管理者機能 =====
  /**
   * 管理者専用のルーター
   * 
   * 管理者ダッシュボードで使用するエンドポイントを提供する。
   * ユーザー管理、監査ログ閲覧などの機能を含む。
   */
  admin: router({
    /**
     * ユーザー管理のルーター
     */
    user: router({
      /**
       * ユーザー一覧を取得する
       * 
       * 管理者ダッシュボードでユーザー一覧を表示するために使用される。
       * 検索、フィルタリング、ページネーションに対応している。
       * 
       * @param input - 取得オプション（ページ、件数、検索、削除済み含むかどうか）
       * @returns ユーザー一覧と総件数
       */
      list: adminProcedure
        .input(z.object({
          page: z.number().min(1).optional(),
          limit: z.number().min(1).max(100).optional(),
          search: z.string().optional(),
          includeDeleted: z.boolean().optional(),
        }).optional())
        .query(async ({ input }) => {
          return await getAllUsers(input);
        }),

      /**
       * ユーザー詳細を取得する
       * 
       * 管理者ダッシュボードでユーザー詳細を表示するために使用される。
       * 削除済みユーザーも取得可能。
       * 
       * @param input - ユーザーID
       * @returns ユーザーオブジェクト、またはnull（存在しない場合）
       */
      get: adminProcedure
        .input(z.object({ userId: z.number().positive("User ID must be a positive integer") }))
        .query(async ({ input }) => {
          return await getUserById(input.userId) || null;
        }),

      /**
       * ユーザーを論理削除する
       * 
       * ユーザーのdeletedAtフィールドを現在時刻に設定して論理削除を行う。
       * セキュリティチェック: 自分自身の削除は不可、最後のadminアカウントの削除は不可。
       * 
       * @param input - ユーザーID
       * @param ctx - コンテキスト（現在のユーザー情報を含む）
       * @returns 削除成功フラグ
       */
      delete: adminProcedure
        .input(z.object({ userId: z.number().positive("User ID must be a positive integer") }))
        .mutation(async ({ input, ctx }) => {
          // 自分自身の削除は不可
          if (input.userId === ctx.user.id) {
            throw new Error("Cannot delete yourself");
          }

          // 削除対象のユーザーを取得
          const targetUser = await getUserById(input.userId);
          if (!targetUser) {
            throw new Error("User not found");
          }

          // 最後のadminアカウントの削除は不可
          if (targetUser.role === 'admin') {
            const allAdmins = await getAllUsers({ includeDeleted: false });
            const activeAdmins = allAdmins.users.filter(u => u.role === 'admin' && !u.deletedAt);
            if (activeAdmins.length <= 1) {
              throw new Error("Cannot delete the last admin account");
            }
          }

          // 論理削除を実行
          await softDeleteUser(input.userId);

          // 監査ログに記録
          await securityService.logSecurityEvent({
            userId: ctx.user.id,
            eventType: 'admin_action',
            severity: 'info',
            description: `User deleted by admin: ${targetUser.email || targetUser.name || targetUser.openId}`,
            metadata: { deletedUserId: input.userId },
            timestamp: Date.now(),
          });

          return { success: true };
        }),
    }),

    /**
     * 監査ログのルーター
     */
    audit: router({
      /**
       * 監査ログを取得する
       * 
       * 管理者ダッシュボードでセキュリティ監査ログを表示するために使用される。
       * フィルタリング、ページネーションに対応している。
       * 
       * @param input - 取得オプション（ページ、件数、フィルタリング条件）
       * @returns 監査ログ一覧と総件数
       */
      getLogs: adminProcedure
        .input(z.object({
          page: z.number().min(1).optional(),
          limit: z.number().min(1).max(100).optional(),
          eventType: z.string().optional(),
          severity: z.enum(["info", "warning", "critical"]).optional(),
          userId: z.number().optional(),
          sessionId: z.number().optional(),
          startDate: z.number().optional(),
          endDate: z.number().optional(),
        }).optional())
        .query(async ({ input }) => {
          return await getAuditLogs(input || {});
        }),
    }),
  }),
});

/**
 * アプリケーションルーターの型
 * 
 * クライアント側での型安全なAPI呼び出しに使用される。
 */
export type AppRouter = typeof appRouter;

export type AppRouter = typeof appRouter;
