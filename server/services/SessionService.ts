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
 * SessionService
 * 
 * Encapsulates business logic for Session management.
 * Follows the Singleton pattern for consistent access.
 */
export class SessionService {
    private static instance: SessionService;

    private constructor() { }

    static getInstance(): SessionService {
        if (!SessionService.instance) {
            SessionService.instance = new SessionService();
        }
        return SessionService.instance;
    }

    /**
     * Starts a new session for a user.
     * Automatically applies security protection.
     */
    async startSession(userId: number) {
        const sessionId = nanoid();
        const startTime = Date.now();

        const insertId = await createSession({
            sessionId,
            userId,
            startTime,
        });

        // Silently protect the session
        if (insertId) {
            await securityService.protectSession(userId, insertId);
        }

        return { sessionId, startTime };
    }

    /**
     * Ends a session and saves the summary.
     * Generates a security summary.
     */
    async endSession(
        userId: number,
        sessionId: string,
        data: {
            endTime: number;
            duration: number;
            securityScore: number;
            sceneDistribution: Record<string, number>;
            eventCounts: Record<string, number>;
            insights: string[];
        }
    ) {
        // Verify ownership indirectly via getSession (caller should verify or we verify here)
        const session = await this.getSessionIfAuthorized(userId, sessionId);
        if (!session) {
            throw new Error("Session not found or access denied");
        }

        await updateSession(sessionId, {
            endTime: data.endTime,
            duration: data.duration,
            securityScore: data.securityScore,
            sceneDistribution: data.sceneDistribution,
            eventCounts: data.eventCounts,
            insights: data.insights,
        });

        // Generate security summary
        const securitySummary = await securityService.generateSecuritySummary(session.id);

        return { success: true, securitySummary };
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
     * Adds a log entry to a session.
     * Handles sanitization and specific security protections.
     */
    async addLogEntry(
        userId: number,
        sessionId: string,
        type: "scene_change" | "speech" | "event" | "intervention",
        timestamp: number,
        content?: string,
        metadata?: Record<string, unknown>
    ) {
        const session = await this.getSessionIfAuthorized(userId, sessionId);
        if (!session) {
            throw new Error("Session not found or access denied");
        }

        // Sanitize input
        let sanitizedContent = content;
        if (content) {
            const { sanitized } = await securityService.sanitizeInput(
                content,
                userId,
                session.id
            );
            sanitizedContent = sanitized;
        }

        // Privacy protection
        if (type === 'speech') {
            await securityService.preservePrivacy(userId, session.id, 'speech_data');
        }

        // Consent protection (Intervention)
        if (type === 'intervention' && metadata) {
            const scene = metadata.scene as string;
            const duration = metadata.duration as number;
            if (scene && duration) {
                await securityService.protectConsent(userId, session.id, scene, duration);
            }
        }

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
