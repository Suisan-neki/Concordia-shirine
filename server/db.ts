import { eq, desc, and, lt, or, like, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  sessions, 
  logEntries, 
  interventionSettings,
  InsertSession,
  InsertLogEntry,
  InsertInterventionSettings,
  securityAuditLogs
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// ===== コスト最適化: キャッシュ =====
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 300000; // 5分

function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
  cache.set(key, {
    data,
    expiry: Date.now() + ttl,
  });
}

function invalidateCache(pattern: string): void {
  const keysToDelete: string[] = [];
  cache.forEach((_, key) => {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cache.delete(key));
}

/**
 * データベースインスタンスを取得する
 * 
 * Drizzle ORMのデータベースインスタンスを取得する。
 * 初回呼び出し時にDATABASE_URL環境変数から接続を確立する。
 * 接続に失敗した場合はnullを返し、エラーを投げない。
 * 
 * 遅延初期化:
 * - データベースへの接続は初回呼び出し時に行われる
 * - これにより、ローカルツール（型チェックなど）がデータベースなしで実行できる
 * 
 * @returns Drizzle ORMのデータベースインスタンス、またはnull（接続失敗時）
 */
export async function getDb() {
  // インスタンスが存在せず、DATABASE_URLが設定されている場合のみ接続を試みる
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      // 接続に失敗した場合は警告をログに出力し、nullを設定
      // エラーを投げないことで、データベースなしでもアプリケーションが起動できる
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * ユーザーを保存または更新する（upsert）
 * 
 * ユーザーが存在する場合は更新し、存在しない場合は新規作成する。
 * openIdをキーとして使用し、ON DUPLICATE KEY UPDATE構文を使用してupsertを実現する。
 * 
 * 処理の流れ:
 * 1. openIdの存在を確認（必須）
 * 2. 更新対象のフィールドを構築（name、email、loginMethod、lastSignedIn、role）
 * 3. ownerOpenIdの場合は自動的にadminロールを付与
 * 4. データベースにupsertを実行
 * 5. ユーザーのキャッシュを無効化
 * 
 * @param user - 保存または更新するユーザーのデータ
 * @throws {Error} openIdが設定されていない場合、またはデータベース操作に失敗した場合
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  // openIdは必須（upsertのキーとして使用）
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    // INSERT用の値（必須フィールドのみ）
    const values: InsertUser = {
      openId: user.openId,
    };
    // UPDATE用の値（更新対象のフィールド）
    const updateSet: Record<string, unknown> = {};

    // テキストフィールド（name、email、loginMethod）を処理
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    // フィールドを正規化してvaluesとupdateSetに追加
    // undefinedの場合はスキップ、nullの場合はnullに正規化
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    // 最後のログイン時刻を処理
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    
    // ロールを処理
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      // ownerOpenIdの場合は自動的にadminロールを付与
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    // 最後のログイン時刻が設定されていない場合は現在時刻を設定
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    // 更新対象がない場合でも、最後のログイン時刻を更新
    // これにより、既存ユーザーのlastSignedInが常に更新される
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // ON DUPLICATE KEY UPDATE構文を使用してupsert
    // openIdが既に存在する場合は更新、存在しない場合は挿入
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
    
    // ユーザーのキャッシュを無効化
    // ユーザー情報が更新されたため、キャッシュされたユーザー情報は古くなる
    invalidateCache(`user_${user.openId}`);
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

/**
 * OpenIDでユーザーを取得する
 * 
 * OpenIDをキーとしてユーザーを検索する。
 * キャッシュをチェックし、キャッシュに存在する場合はキャッシュから返す。
 * キャッシュに存在しない場合はデータベースから取得し、キャッシュに保存する。
 * 
 * コスト最適化: キャッシュを使用（TTL: 5分）
 * 
 * @param openId - ユーザーのOpenID（一意識別子）
 * @returns ユーザーオブジェクト、またはundefined（存在しない場合）
 */
export async function getUserByOpenId(openId: string) {
  // キャッシュをチェック（TTL: 5分）
  const cacheKey = `user_${openId}`;
  const cached = getFromCache<typeof users.$inferSelect>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  // データベースからユーザーを取得
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  
  const user = result.length > 0 ? result[0] : undefined;
  
  // ユーザーが存在する場合はキャッシュに保存（TTL: 5分）
  // これにより、同じユーザーへの複数のリクエストでデータベースアクセスを削減
  if (user) {
    setCache(cacheKey, user);
  }

  return user;
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
  
  // ユーザーのセッションキャッシュを無効化
  if (session.userId) {
    invalidateCache(`sessions_user_${session.userId}`);
  }
  
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
  
  // キャッシュを無効化
  invalidateCache(`session_${sessionId}`);
}

/**
 * ユーザーのセッション一覧を取得
 * コスト最適化: キャッシュを使用
 */
export async function getUserSessions(userId: number, limit = 50) {
  // キャッシュをチェック（短いTTL: 1分）
  const cacheKey = `sessions_user_${userId}_${limit}`;
  const cached = getFromCache<typeof sessions.$inferSelect[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db.select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.startTime))
    .limit(limit);
  
  // キャッシュに保存（1分）
  setCache(cacheKey, result, 60000);
  
  return result;
}

/**
 * セッションIDでセッションを取得
 * コスト最適化: キャッシュを使用
 */
export async function getSessionBySessionId(sessionId: string) {
  // キャッシュをチェック
  const cacheKey = `session_${sessionId}`;
  const cached = getFromCache<typeof sessions.$inferSelect>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select()
    .from(sessions)
    .where(eq(sessions.sessionId, sessionId))
    .limit(1);

  const session = result.length > 0 ? result[0] : undefined;
  
  // キャッシュに保存
  if (session) {
    setCache(cacheKey, session);
  }
  
  return session;
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
    
    // キャッシュを無効化
    invalidateCache(`session_${sessionId}`);
    if (session.userId) {
      invalidateCache(`sessions_user_${session.userId}`);
    }
  }
  
  // セッションを削除
  await db.delete(sessions).where(eq(sessions.sessionId, sessionId));
}

/**
 * 古いセッションを削除（30日以上前）
 * コスト最適化: ストレージコストを削減
 */
export async function cleanupOldSessions(): Promise<{ deletedSessions: number; deletedLogs: number }> {
  const db = await getDb();
  if (!db) {
    return { deletedSessions: 0, deletedLogs: 0 };
  }
  
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  try {
    // 古いセッションを取得
    const oldSessions = await db.select({ id: sessions.id })
      .from(sessions)
      .where(lt(sessions.startTime, thirtyDaysAgo));
    
    if (oldSessions.length === 0) {
      return { deletedSessions: 0, deletedLogs: 0 };
    }
    
    const sessionIds = oldSessions.map(s => s.id);
    
    // 関連するログエントリを削除
    let deletedLogs = 0;
    for (const sessionId of sessionIds) {
      const result = await db.delete(logEntries)
        .where(eq(logEntries.sessionId, sessionId));
      deletedLogs += result[0]?.affectedRows || 0;
    }
    
    // セッションを削除
    const sessionResult = await db.delete(sessions)
      .where(lt(sessions.startTime, thirtyDaysAgo));
    
    console.log(`[Database] Cleaned up: ${sessionResult[0]?.affectedRows || 0} sessions, ${deletedLogs} logs`);
    
    // キャッシュをクリア
    cache.clear();
    
    return { 
      deletedSessions: sessionResult[0]?.affectedRows || 0, 
      deletedLogs 
    };
  } catch (error) {
    console.error('[Database] Failed to cleanup old sessions:', error);
    return { deletedSessions: 0, deletedLogs: 0 };
  }
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
 * ログエントリを一括追加
 * コスト最適化: 複数のINSERTを1回にまとめる
 */
export async function addLogEntriesBatch(entries: InsertLogEntry[]) {
  if (entries.length === 0) return;
  
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(logEntries).values(entries);
}

/**
 * セッションのログエントリを取得
 * コスト最適化: キャッシュを使用
 */
export async function getSessionLogEntries(sessionDbId: number) {
  // キャッシュをチェック（短いTTL: 30秒）
  const cacheKey = `logs_session_${sessionDbId}`;
  const cached = getFromCache<typeof logEntries.$inferSelect[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db.select()
    .from(logEntries)
    .where(eq(logEntries.sessionId, sessionDbId))
    .orderBy(logEntries.timestamp);
  
  // キャッシュに保存（30秒）
  setCache(cacheKey, result, 30000);
  
  return result;
}

// ===== Intervention Settings =====

/**
 * ユーザーの介入設定を取得または作成
 * コスト最適化: キャッシュを使用
 */
export async function getOrCreateInterventionSettings(userId: number) {
  // キャッシュをチェック
  const cacheKey = `intervention_settings_${userId}`;
  const cached = getFromCache<typeof interventionSettings.$inferSelect>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const existing = await db.select()
    .from(interventionSettings)
    .where(eq(interventionSettings.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    // キャッシュに保存
    setCache(cacheKey, existing[0]);
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

  // キャッシュに保存
  if (created[0]) {
    setCache(cacheKey, created[0]);
  }
  
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
  
  // キャッシュを無効化
  invalidateCache(`intervention_settings_${userId}`);
}

// ===== キャッシュ管理 =====

/**
 * キャッシュをクリアする（テスト用）
 */
export function clearDbCache(): void {
  cache.clear();
}
