/**
 * DynamoDBデータベース操作
 * 
 * AWS DynamoDBを使用したデータベース操作を提供する。
 * MySQLは使用しない。
 */

import type { 
  InsertInterventionSettings,
  InsertLogEntry,
  InsertSession,
  InsertUser,
  Session,
  User
} from "../drizzle/schema";

// DynamoDBの実装をインポート
import { 
  addLogEntry as addDynamoLogEntry,
  createSession as createDynamoSession,
  deleteSession as deleteDynamoSession,
  getOrCreateInterventionSettings as getDynamoInterventionSettings,
  getSessionById as getDynamoSessionById,
  getSessionBySessionId as getDynamoSessionBySessionId,
  getSessionLogEntries as getDynamoSessionLogEntries,
  getUserById as getDynamoUserById,
  getUserByOpenId as getDynamoUserByOpenId,
  getUserSessions as getDynamoUserSessions,
  updateInterventionSettings as updateDynamoInterventionSettings,
  updateSession as updateDynamoSession,
  upsertUser as upsertDynamoUser,
  getAllUsers as getAllDynamoUsers,
} from "./db-dynamodb";

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
 * ユーザーを保存または更新する（upsert）
 * 
 * @param user - 保存または更新するユーザーのデータ
 * @throws {Error} openIdが設定されていない場合、またはデータベース操作に失敗した場合
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  // DynamoDBに保存
  await upsertDynamoUser(user);
  
  // キャッシュを無効化
  invalidateCache(`user_${user.openId}`);
}

/**
 * OpenIDでユーザーを取得する
 * 
 * @param openId - ユーザーのOpenID（一意識別子）
 * @returns ユーザーオブジェクト、またはundefined（存在しない場合）
 */
export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  // キャッシュをチェック（TTL: 5分）
  const cacheKey = `user_${openId}`;
  const cached = getFromCache<User>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // DynamoDBから取得
  const user = await getDynamoUserByOpenId(openId);
  
  // キャッシュに保存
  if (user) {
    setCache(cacheKey, user);
  }
  
  return user || undefined;
}

/**
 * すべてのユーザーを取得する（管理者用）
 * 
 * @param includeDeleted - 削除済みユーザーを含めるかどうか（デフォルト: false）
 * @returns ユーザーの配列
 */
export async function getAllUsers(includeDeleted: boolean = false): Promise<User[]> {
  return await getAllDynamoUsers(includeDeleted);
}

/**
 * ユーザーIDからユーザーを取得する
 */
export async function getUserById(userId: number): Promise<User | undefined> {
  return await getDynamoUserById(userId);
}

// ===== キャッシュ管理 =====

/**
 * キャッシュをクリアする（テスト用）
 */
export function clearDbCache(): void {
  cache.clear();
}

// ===== セッション/ログ/介入設定 =====

export async function createSession(session: InsertSession): Promise<number> {
  return await createDynamoSession(session);
}

export async function updateSession(sessionId: string, data: Partial<InsertSession>): Promise<void> {
  await updateDynamoSession(sessionId, data);
}

export async function getUserSessions(userId: number, limit = 50): Promise<Session[]> {
  return await getDynamoUserSessions(userId, limit);
}

export async function getSessionBySessionId(sessionId: string): Promise<Session | undefined> {
  return await getDynamoSessionBySessionId(sessionId);
}

export async function getSessionById(sessionDbId: number): Promise<Session | undefined> {
  return await getDynamoSessionById(sessionDbId);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await deleteDynamoSession(sessionId);
}

export async function addLogEntry(entry: InsertLogEntry): Promise<void> {
  await addDynamoLogEntry(entry);
}

export async function getSessionLogEntries(sessionDbId: number): Promise<InsertLogEntry[]> {
  return await getDynamoSessionLogEntries(sessionDbId);
}

export async function getOrCreateInterventionSettings(userId: number) {
  return await getDynamoInterventionSettings(userId);
}

export async function updateInterventionSettings(
  userId: number,
  settings: Partial<InsertInterventionSettings>
): Promise<void> {
  await updateDynamoInterventionSettings(userId, settings);
}
