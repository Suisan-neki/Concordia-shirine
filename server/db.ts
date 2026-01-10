import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  sessions, 
  logEntries, 
  interventionSettings,
  InsertSession,
  InsertLogEntry,
  InsertInterventionSettings
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== Session Management =====

/**
 * 新しいセッションを作成
 */
export async function createSession(session: InsertSession) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(sessions).values(session);
  return result[0].insertId;
}

/**
 * セッションを更新（終了時）
 */
export async function updateSession(sessionId: string, data: Partial<InsertSession>) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(sessions)
    .set(data)
    .where(eq(sessions.sessionId, sessionId));
}

/**
 * ユーザーのセッション一覧を取得
 */
export async function getUserSessions(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return db.select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.startTime))
    .limit(limit);
}

/**
 * セッションIDでセッションを取得
 */
export async function getSessionBySessionId(sessionId: string) {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select()
    .from(sessions)
    .where(eq(sessions.sessionId, sessionId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * セッションを削除
 */
export async function deleteSession(sessionId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // まずログエントリを削除
  const session = await getSessionBySessionId(sessionId);
  if (session) {
    await db.delete(logEntries).where(eq(logEntries.sessionId, session.id));
  }
  
  // セッションを削除
  await db.delete(sessions).where(eq(sessions.sessionId, sessionId));
}

// ===== Log Entries =====

/**
 * ログエントリを追加
 */
export async function addLogEntry(entry: InsertLogEntry) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(logEntries).values(entry);
}

/**
 * セッションのログエントリを取得
 */
export async function getSessionLogEntries(sessionDbId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return db.select()
    .from(logEntries)
    .where(eq(logEntries.sessionId, sessionDbId))
    .orderBy(logEntries.timestamp);
}

// ===== Intervention Settings =====

/**
 * ユーザーの介入設定を取得または作成
 */
export async function getOrCreateInterventionSettings(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const existing = await db.select()
    .from(interventionSettings)
    .where(eq(interventionSettings.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // デフォルト設定を作成
  await db.insert(interventionSettings).values({
    userId,
    enabled: 1,
    monologueThreshold: 30,
    silenceThreshold: 15,
    soundEnabled: 1,
    visualHintEnabled: 1,
  });

  const created = await db.select()
    .from(interventionSettings)
    .where(eq(interventionSettings.userId, userId))
    .limit(1);

  return created[0];
}

/**
 * 介入設定を更新
 */
export async function updateInterventionSettings(
  userId: number, 
  settings: Partial<InsertInterventionSettings>
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(interventionSettings)
    .set(settings)
    .where(eq(interventionSettings.userId, userId));
}
