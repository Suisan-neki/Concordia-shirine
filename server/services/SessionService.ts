/**
 * セッション管理サービス
 * 
 * セッションの作成、更新、削除、ログエントリの追加などのビジネスロジックを提供する。
 * セキュリティ保護（暗号化、サニタイズ、プライバシー保護）を自動的に適用する。
 * シングルトンパターンで実装され、アプリケーション全体で1つのインスタンスを共有する。
 */
import { nanoid } from "nanoid";
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
} from "../db";
import { securityService } from "../security";
import { InsertSession } from "../../drizzle/schema";

/**
 * セッション管理サービス
 * 
 * セッションの作成、更新、削除、ログエントリの追加などのビジネスロジックをカプセル化する。
 * シングルトンパターンで実装され、一貫したアクセスを提供する。
 */
export class SessionService {
    private static instance: SessionService;

    /**
     * プライベートコンストラクタ（シングルトンパターン）
     * 
     * 外部からのインスタンス化を防ぐため、コンストラクタをプライベートにしている。
     */
    private constructor() { }

    /**
     * シングルトンインスタンスを取得する
     * 
     * 初回呼び出し時にインスタンスを作成し、以降は同じインスタンスを返す。
     * 
     * @returns SessionServiceのシングルトンインスタンス
     */
    static getInstance(): SessionService {
        if (!SessionService.instance) {
            SessionService.instance = new SessionService();
        }
        return SessionService.instance;
    }

    /**
     * 新しいセッションを開始する
     * 
     * ユーザーの新しいセッションを作成し、自動的にセキュリティ保護を適用する。
     * セッションIDはnanoidを使用して生成され、一意性が保証される。
     * 
     * 処理の流れ:
     * 1. セッションIDを生成（nanoid）
     * 2. 開始時刻を記録
     * 3. データベースにセッションを作成
     * 4. セキュリティ保護を適用（「結界が展開されています」）
     * 
     * @param userId - セッションを作成するユーザーのID
     * @returns セッションIDと開始時刻
     */
    async startSession(userId: number) {
        // セッションIDを生成（nanoid: URLセーフなランダムID）
        const sessionId = nanoid();
        const startTime = Date.now();

        // データベースにセッションを作成
        const insertId = await createSession({
            sessionId,
            userId,
            startTime,
        });

        // セキュリティ保護を自動的に適用
        // 「結界が展開されています」というメッセージで、バックグラウンドでセキュリティ機能が動作していることを表現
        if (insertId) {
            await securityService.protectSession(userId, insertId);
        }

        return { sessionId, startTime };
    }

    /**
     * セッションを終了する
     * 
     * セッションの終了時刻、継続時間、シーン分布、イベント数、インサイトなどの情報を保存する。
     * セキュリティスコアを計算し、セキュリティサマリーを生成する。
     * 
     * 処理の流れ:
     * 1. セッションの所有権を検証（ユーザーがセッションの所有者であることを確認）
     * 2. セキュリティスコアを計算（シーン分布から計算）
     * 3. セッション情報を更新
     * 4. セキュリティサマリーを生成
     * 
     * @param userId - セッションを終了するユーザーのID
     * @param sessionId - 終了するセッションのID
     * @param data - セッション終了時のデータ（終了時刻、継続時間、シーン分布、イベント数、インサイト）
     * @returns 成功フラグ、セキュリティサマリー、セキュリティスコア
     * @throws {Error} セッションが見つからない、またはアクセスが拒否された場合
     */
    async endSession(
        userId: number,
        sessionId: string,
        data: {
            endTime: number;
            duration: number;
            sceneDistribution: Record<string, number>;
            eventCounts: Record<string, number>;
            insights: string[];
        }
    ) {
        // セッションの所有権を検証
        // ユーザーがセッションの所有者であることを確認（間接的にgetSessionを使用）
        const session = await this.getSessionIfAuthorized(userId, sessionId);
        if (!session) {
            throw new Error("Session not found or access denied");
        }

        // セキュリティスコアを計算（シーン分布から計算）
        // 調和、静寂、一方的の比率からスコアを算出
        const securityScore = this.calculateSecurityScore(data.sceneDistribution);

        // セッション情報を更新
        await updateSession(sessionId, {
            endTime: data.endTime,
            duration: data.duration,
            securityScore,
            sceneDistribution: data.sceneDistribution,
            eventCounts: data.eventCounts,
            insights: data.insights,
        });

        // セキュリティサマリーを生成
        // セッション中に適用されたセキュリティ機能の集計を取得
        const securitySummary = await securityService.generateSecuritySummary(session.id);

        return { success: true, securitySummary, securityScore };
    }

    private calculateSecurityScore(sceneDistribution: Record<string, number>): number {
        const totalScenes = Object.values(sceneDistribution).reduce((sum, value) => sum + value, 0);
        const harmonyRatio = totalScenes > 0 ? (sceneDistribution['調和'] || 0) / totalScenes : 0;
        const silenceRatio = totalScenes > 0 ? (sceneDistribution['静寂'] || 0) / totalScenes : 0;
        const oneSidedRatio = totalScenes > 0 ? (sceneDistribution['一方的'] || 0) / totalScenes : 0;
        const score = Math.round(
            (harmonyRatio * 0.4 + silenceRatio * 0.3 + (1 - oneSidedRatio) * 0.3) * 100
        );
        return Math.min(100, Math.max(0, score));
    }

    /**
     * Lists sessions for a user.
     */
    async listUserSessions(userId: number, limit: number = 50) {
        return await getUserSessions(userId, limit);
    }

    /**
     * Gets a session if the user is authorized.
     * Logs access attempts.
     */
    async getSessionWithDetails(userId: number, sessionId: string) {
        const session = await getSessionBySessionId(sessionId);

        if (!session || session.userId !== userId) {
            // Log access denied
            await securityService.logSecurityEvent({
                userId,
                eventType: 'access_denied',
                severity: 'warning',
                description: 'Session access denied',
                metadata: { sessionId },
                timestamp: Date.now(),
            });
            return null;
        }

        // Log access granted
        await securityService.verifyAccess(userId, 'session', session.id, 'read');

        const logs = await getSessionLogEntries(session.id);

        return { ...session, logs };
    }

    /**
     * Private helper to check authorization without logging (for internal use)
     */
    private async getSessionIfAuthorized(userId: number, sessionId: string) {
        const session = await getSessionBySessionId(sessionId);
        if (!session || session.userId !== userId) {
            return null;
        }
        return session;
    }

    /**
     * Deletes a session.
     */
    async deleteSession(userId: number, sessionId: string) {
        const session = await this.getSessionIfAuthorized(userId, sessionId);
        if (!session) {
            throw new Error("Session not found or access denied");
        }

        await deleteSession(sessionId);
        return { success: true };
    }

    /**
     * セッションにログエントリを追加する
     * 
     * セッションにログエントリを追加し、自動的にセキュリティ保護を適用する。
     * 入力データのサニタイズ、プライバシー保護、同意保護などを自動的に行う。
     * 
     * 処理の流れ:
     * 1. セッションの所有権を確認
     * 2. 入力データをサニタイズ（XSS、SQLインジェクションなどの対策）
     * 3. 音声データの場合はプライバシー保護を適用
     * 4. 介入データの場合は同意保護を適用
     * 5. ログエントリをデータベースに保存
     * 
     * @param userId - ログエントリを追加するユーザーのID
     * @param sessionId - ログエントリを追加するセッションのID
     * @param type - ログエントリのタイプ（"scene_change"、"speech"、"event"、"intervention"）
     * @param timestamp - ログエントリのタイムスタンプ（Unix timestamp in ms）
     * @param content - ログエントリの内容（オプション）
     * @param metadata - ログエントリのメタデータ（オプション）
     * @returns 成功フラグ
     * @throws {Error} セッションが見つからない、またはアクセスが拒否された場合
     */
    async addLogEntry(
        userId: number,
        sessionId: string,
        type: "scene_change" | "speech" | "event" | "intervention",
        timestamp: number,
        content?: string,
        metadata?: Record<string, unknown>
    ) {
        // セッションの所有権を確認
        const session = await this.getSessionIfAuthorized(userId, sessionId);
        if (!session) {
            throw new Error("Session not found or access denied");
        }

        // 入力データをサニタイズ
        // XSS、SQLインジェクション、NoSQLインジェクションなどの攻撃を防ぐ
        let sanitizedContent = content;
        if (content) {
            const { sanitized } = await securityService.sanitizeInput(
                content,
                userId,
                session.id
            );
            sanitizedContent = sanitized;
        }

        // プライバシー保護（音声データの場合）
        // 音声データは機密情報であるため、プライバシー保護を適用
        if (type === 'speech') {
            await securityService.preservePrivacy(userId, session.id, 'speech_data');
        }

        // 同意保護（介入データの場合）
        // 同調圧力が検知された場合、判断の自由を守るための介入が行われたことを記録
        if (type === 'intervention' && metadata) {
            const scene = metadata.scene as string;
            const duration = metadata.duration as number;
            if (scene && duration) {
                await securityService.protectConsent(userId, session.id, scene, duration);
            }
        }

        // ログエントリをデータベースに保存
        await addLogEntry({
            sessionId: session.id,
            type,
            timestamp,
            content: sanitizedContent,
            metadata,
        });

        return { success: true };
    }

    // ===== Intervention Settings =====

    async getInterventionSettings(userId: number) {
        const settings = await getOrCreateInterventionSettings(userId);
        return {
            enabled: settings.enabled === 1,
            monologueThreshold: settings.monologueThreshold,
            silenceThreshold: settings.silenceThreshold,
            soundEnabled: settings.soundEnabled === 1,
            visualHintEnabled: settings.visualHintEnabled === 1,
        };
    }

    async updateInterventionSettings(
        userId: number,
        input: {
            enabled?: boolean;
            monologueThreshold?: number;
            silenceThreshold?: number;
            soundEnabled?: boolean;
            visualHintEnabled?: boolean;
        }
    ) {
        const updateData: Record<string, unknown> = {};

        if (input.enabled !== undefined) updateData.enabled = input.enabled ? 1 : 0;
        if (input.monologueThreshold !== undefined) updateData.monologueThreshold = input.monologueThreshold;
        if (input.silenceThreshold !== undefined) updateData.silenceThreshold = input.silenceThreshold;
        if (input.soundEnabled !== undefined) updateData.soundEnabled = input.soundEnabled ? 1 : 0;
        if (input.visualHintEnabled !== undefined) updateData.visualHintEnabled = input.visualHintEnabled ? 1 : 0;

        await updateInterventionSettings(userId, updateData);
        return { success: true };
    }
}

export const sessionService = SessionService.getInstance();
