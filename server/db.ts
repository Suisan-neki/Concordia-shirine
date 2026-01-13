/**
 * DynamoDBデータベース操作
 * 
 * AWS DynamoDBを使用したデータベース操作を提供する。
 * MySQLは使用しない。
 */

import type { 
  InsertUser, 
  User
} from "../drizzle/schema";
import { ENV } from './_core/env';

// DynamoDBの実装をインポート
import { 
  getUserByOpenId as getDynamoUserByOpenId,
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

// ===== 後方互換性のためのダミー関数 =====
// 他のファイルで使用されているが、DynamoDBでは不要な関数

/**
 * データベースインスタンスを取得する（後方互換性のため）
 * 
 * DynamoDBを使用するため、この関数は常にnullを返します。
 * セキュリティログなどの機能は、今後DynamoDB用の実装に置き換える予定です。
 * 
 * @deprecated DynamoDBを使用するため、この関数は使用しないでください
 * @returns 常にnull
 */
export async function getDb(): Promise<null> {
  console.warn("[Database] getDb() is deprecated. Use DynamoDB functions instead.");
  return null;
}

// ===== キャッシュ管理 =====

/**
 * キャッシュをクリアする（テスト用）
 */
export function clearDbCache(): void {
  cache.clear();
}

// ===== 後方互換性のためのダミー関数 =====
// セッション管理やログエントリなどの機能は、今後DynamoDB用の実装に置き換える予定です。
// 現在は、エラーを防ぐためにダミー関数を提供しています。

import type { InsertSession, InsertLogEntry, InsertInterventionSettings } from "../drizzle/schema";

/**
 * 新しいセッションを作成（後方互換性のため）
 * @deprecated DynamoDB用の実装に置き換える予定
 */
export async function createSession(session: InsertSession): Promise<number> {
  console.warn("[Database] createSession() is not implemented for DynamoDB yet.");
  throw new Error("createSession is not implemented for DynamoDB yet");
}

/**
 * セッションを更新（後方互換性のため）
 * @deprecated DynamoDB用の実装に置き換える予定
 */
export async function updateSession(sessionId: string, data: Partial<InsertSession>): Promise<void> {
  console.warn("[Database] updateSession() is not implemented for DynamoDB yet.");
  throw new Error("updateSession is not implemented for DynamoDB yet");
}

/**
 * ユーザーのセッション一覧を取得（後方互換性のため）
 * @deprecated DynamoDB用の実装に置き換える予定
 */
export async function getUserSessions(userId: number, limit = 50): Promise<unknown[]> {
  console.warn("[Database] getUserSessions() is not implemented for DynamoDB yet.");
  return [];
}

/**
 * セッションIDでセッションを取得（後方互換性のため）
 * @deprecated DynamoDB用の実装に置き換える予定
 */
export async function getSessionBySessionId(sessionId: string): Promise<unknown | undefined> {
  console.warn("[Database] getSessionBySessionId() is not implemented for DynamoDB yet.");
  return undefined;
}

/**
 * セッションを削除（後方互換性のため）
 * @deprecated DynamoDB用の実装に置き換える予定
 */
export async function deleteSession(sessionId: string): Promise<void> {
  console.warn("[Database] deleteSession() is not implemented for DynamoDB yet.");
  throw new Error("deleteSession is not implemented for DynamoDB yet");
}

/**
 * ログエントリを追加（後方互換性のため）
 * @deprecated DynamoDB用の実装に置き換える予定
 */
export async function addLogEntry(entry: InsertLogEntry): Promise<void> {
  console.warn("[Database] addLogEntry() is not implemented for DynamoDB yet.");
  // エラーを投げずに、警告のみを出力（アプリケーションが動作し続けるように）
}

/**
 * セッションのログエントリを取得（後方互換性のため）
 * @deprecated DynamoDB用の実装に置き換える予定
 */
export async function getSessionLogEntries(sessionDbId: number): Promise<unknown[]> {
  console.warn("[Database] getSessionLogEntries() is not implemented for DynamoDB yet.");
  return [];
}

/**
 * ユーザーの介入設定を取得または作成（後方互換性のため）
 * @deprecated DynamoDB用の実装に置き換える予定
 */
export async function getOrCreateInterventionSettings(userId: number): Promise<unknown> {
  console.warn("[Database] getOrCreateInterventionSettings() is not implemented for DynamoDB yet.");
  // デフォルト設定を返す
  return {
    userId,
    enabled: 1,
    monologueThreshold: 30,
    silenceThreshold: 8,
    soundEnabled: 1,
    visualHintEnabled: 1,
  };
}

/**
 * 介入設定を更新（後方互換性のため）
 * @deprecated DynamoDB用の実装に置き換える予定
 */
export async function updateInterventionSettings(
  userId: number, 
  settings: Partial<InsertInterventionSettings>
): Promise<void> {
  console.warn("[Database] updateInterventionSettings() is not implemented for DynamoDB yet.");
  // エラーを投げずに、警告のみを出力
}
