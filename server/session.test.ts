import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  createSession: vi.fn().mockResolvedValue(1),
  updateSession: vi.fn().mockResolvedValue(undefined),
  getUserSessions: vi.fn().mockResolvedValue([
    {
      id: 1,
      sessionId: "test-session-1",
      userId: 1,
      startTime: 1700000000000,
      endTime: 1700003600000,
      duration: 3600000,
      securityScore: 85,
      sceneDistribution: { "静寂": 10, "調和": 20, "一方的": 5, "沈黙": 5 },
      eventCounts: { "speech_start": 15, "silence_detected": 3 },
      insights: ["対話は全体的に調和が取れていました。"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getSessionBySessionId: vi.fn().mockImplementation((sessionId: string) => {
    if (sessionId === "test-session-1") {
      return Promise.resolve({
        id: 1,
        sessionId: "test-session-1",
        userId: 1,
        startTime: 1700000000000,
        endTime: 1700003600000,
        duration: 3600000,
        securityScore: 85,
        sceneDistribution: { "静寂": 10, "調和": 20 },
        eventCounts: {},
        insights: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return Promise.resolve(undefined);
  }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  addLogEntry: vi.fn().mockResolvedValue(undefined),
  getSessionLogEntries: vi.fn().mockResolvedValue([]),
  getOrCreateInterventionSettings: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    enabled: 1,
    monologueThreshold: 30,
    silenceThreshold: 15,
    soundEnabled: 1,
    visualHintEnabled: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  updateInterventionSettings: vi.fn().mockResolvedValue(undefined),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("session router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("session.start", () => {
    it("creates a new session and returns sessionId", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.session.start();

      expect(result).toHaveProperty("sessionId");
      expect(result).toHaveProperty("startTime");
      expect(typeof result.sessionId).toBe("string");
      expect(typeof result.startTime).toBe("number");
    });
  });

  describe("session.list", () => {
    it("returns user sessions", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.session.list();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("sessionId");
      expect(result[0]).toHaveProperty("securityScore");
    });
  });

  describe("session.get", () => {
    it("returns session details for valid sessionId", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.session.get({ sessionId: "test-session-1" });

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe("test-session-1");
    });

    it("returns null for non-existent sessionId", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.session.get({ sessionId: "non-existent" });

      expect(result).toBeNull();
    });
  });

  describe("session.end", () => {
    it("updates session with summary data", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.session.end({
        sessionId: "test-session-1",
        endTime: Date.now(),
        duration: 3600000,
        securityScore: 85,
        sceneDistribution: { "静寂": 10, "調和": 20 },
        eventCounts: { "speech_start": 15 },
        insights: ["Good session"],
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("session.delete", () => {
    it("deletes session successfully", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.session.delete({ sessionId: "test-session-1" });

      expect(result).toEqual({ success: true });
    });

    it("throws error for non-existent session", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.session.delete({ sessionId: "non-existent" })
      ).rejects.toThrow("Session not found or access denied");
    });
  });
});

describe("intervention router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("intervention.getSettings", () => {
    it("returns intervention settings", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.intervention.getSettings();

      expect(result).toHaveProperty("enabled");
      expect(result).toHaveProperty("monologueThreshold");
      expect(result).toHaveProperty("silenceThreshold");
      expect(result).toHaveProperty("soundEnabled");
      expect(result).toHaveProperty("visualHintEnabled");
      expect(result.enabled).toBe(true);
      expect(result.monologueThreshold).toBe(30);
    });
  });

  describe("intervention.updateSettings", () => {
    it("updates intervention settings", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.intervention.updateSettings({
        enabled: false,
        monologueThreshold: 45,
      });

      expect(result).toEqual({ success: true });
    });
  });
});
