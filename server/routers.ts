import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getSessionBySessionId,
} from "./db";
import { securityService } from "./security";
import { sessionService } from "./services/SessionService";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
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
        securityScore: z.number().min(0).max(100),
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
  intervention: router({
    /**
     * 介入設定を取得
     */
    getSettings: protectedProcedure
      .query(async ({ ctx }) => {
        return await sessionService.getInterventionSettings(ctx.user.id);
      }),

    /**
     * 介入設定を更新
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
  security: router({
    /**
     * ユーザーのセキュリティ統計を取得
     * 「実は裏でこれだけ動いていました」の情報
     */
    getStats: protectedProcedure
      .query(async ({ ctx }) => {
        return await securityService.getUserSecurityStats(ctx.user.id);
      }),

    /**
     * セッションのセキュリティサマリーを取得
     */
    getSessionSummary: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const session = await getSessionBySessionId(input.sessionId);

        if (!session || session.userId !== ctx.user.id) {
          return null;
        }

        return await securityService.generateSecuritySummary(session.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
