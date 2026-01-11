import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createSession,
  updateSession,
  getUserSessions,
  deleteSession,
  getSessionBySessionId,
  addLogEntry,
  getSessionLogEntries,
  getOrCreateInterventionSettings,
  updateInterventionSettings
} from "./db";
import { securityService } from "./security";
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
        const sessionId = nanoid();
        const startTime = Date.now();

        const insertId = await createSession({
          sessionId,
          userId: ctx.user.id,
          startTime,
        });

        // 静かにセッションを保護（ユーザーには見えない）
        if (insertId) {
          await securityService.protectSession(ctx.user.id, insertId);
        }

        return { sessionId, startTime };
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
        const session = await getSessionBySessionId(input.sessionId);

        await updateSession(input.sessionId, {
          endTime: input.endTime,
          duration: input.duration,
          securityScore: input.securityScore,
          sceneDistribution: input.sceneDistribution,
          eventCounts: input.eventCounts,
          insights: input.insights,
        });

        // セキュリティサマリーを生成（静かに）
        let securitySummary = null;
        if (session) {
          securitySummary = await securityService.generateSecuritySummary(session.id);
        }

        return {
          success: true,
          securitySummary,
        };
      }),

    /**
     * ユーザーのセッション一覧を取得
     */
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const sessions = await getUserSessions(ctx.user.id, input?.limit ?? 50);
        return sessions;
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
        const session = await getSessionBySessionId(input.sessionId);

        if (!session || session.userId !== ctx.user.id) {
          // アクセス拒否をログに記録（静かに）
          await securityService.logSecurityEvent({
            userId: ctx.user.id,
            eventType: 'access_denied',
            severity: 'warning',
            description: 'セッションへのアクセスが拒否されました',
            metadata: { sessionId: input.sessionId },
            timestamp: Date.now(),
          });
          return null;
        }

        // アクセス許可をログに記録（静かに）
        await securityService.verifyAccess(ctx.user.id, 'session', session.id, 'read');

        const logs = await getSessionLogEntries(session.id);

        return {
          ...session,
          logs,
        };
      }),

    /**
     * セッションを削除
     */
    delete: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionBySessionId(input.sessionId);

        if (!session || session.userId !== ctx.user.id) {
          throw new Error("Session not found or access denied");
        }

        await deleteSession(input.sessionId);
        return { success: true };
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
        const session = await getSessionBySessionId(input.sessionId);

        if (!session || session.userId !== ctx.user.id) {
          throw new Error("Session not found or access denied");
        }

        // 入力をサニタイズ（静かに）
        let sanitizedContent = input.content;
        if (input.content) {
          const { sanitized } = await securityService.sanitizeInput(
            input.content,
            ctx.user.id,
            session.id
          );
          sanitizedContent = sanitized;
        }

        // プライバシーを保護（静かに）
        if (input.type === 'speech') {
          await securityService.preservePrivacy(ctx.user.id, session.id, 'speech_data');
        }

        // 同調圧力検知時の保護
        if (input.type === 'intervention' && input.metadata) {
          const scene = input.metadata.scene as string;
          const duration = input.metadata.duration as number;
          if (scene && duration) {
            await securityService.protectConsent(ctx.user.id, session.id, scene, duration);
          }
        }

        await addLogEntry({
          sessionId: session.id,
          type: input.type,
          timestamp: input.timestamp,
          content: sanitizedContent,
          metadata: input.metadata,
        });

        return { success: true };
      }),
  }),

  // ===== 介入設定 =====
  intervention: router({
    /**
     * 介入設定を取得
     */
    getSettings: protectedProcedure
      .query(async ({ ctx }) => {
        const settings = await getOrCreateInterventionSettings(ctx.user.id);
        return {
          enabled: settings.enabled === 1,
          monologueThreshold: settings.monologueThreshold,
          silenceThreshold: settings.silenceThreshold,
          soundEnabled: settings.soundEnabled === 1,
          visualHintEnabled: settings.visualHintEnabled === 1,
        };
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
        const updateData: Record<string, unknown> = {};

        if (input.enabled !== undefined) {
          updateData.enabled = input.enabled ? 1 : 0;
        }
        if (input.monologueThreshold !== undefined) {
          updateData.monologueThreshold = input.monologueThreshold;
        }
        if (input.silenceThreshold !== undefined) {
          updateData.silenceThreshold = input.silenceThreshold;
        }
        if (input.soundEnabled !== undefined) {
          updateData.soundEnabled = input.soundEnabled ? 1 : 0;
        }
        if (input.visualHintEnabled !== undefined) {
          updateData.visualHintEnabled = input.visualHintEnabled ? 1 : 0;
        }

        await updateInterventionSettings(ctx.user.id, updateData);
        return { success: true };
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
