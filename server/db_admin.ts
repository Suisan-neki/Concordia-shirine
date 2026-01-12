/**
 * 管理者機能用のデータベース関数
 * 
 * 管理者ダッシュボードで使用するデータベース関数を定義する。
 * これらの関数は管理者専用のため、通常のユーザーは使用できない。
 * DynamoDBを使用する。
 */

import type { User } from "../drizzle/schema";
import { getAllUsers as getAllDynamoUsers } from "./db";

/**
 * 全ユーザーを取得する（管理者専用）
 * 
 * 管理者ダッシュボードでユーザー一覧を表示するために使用される。
 * 検索、フィルタリング、ページネーションに対応している。
 * 
 * @param options - 取得オプション
 * @param options.page - ページ番号（1から開始）
 * @param options.limit - 1ページあたりの件数（デフォルト: 50、最大: 100）
 * @param options.search - 検索文字列（名前またはメールアドレスで検索）
 * @param options.includeDeleted - 削除済みユーザーを含めるかどうか（デフォルト: false）
 * @returns ユーザー一覧と総件数
 */
export async function getAllUsers(options: {
  page?: number;
  limit?: number;
  search?: string;
  includeDeleted?: boolean;
} = {}) {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 50, 100);
  const search = options.search?.trim();
  const includeDeleted = options.includeDeleted || false;

  // DynamoDBから全ユーザーを取得
  let allUsers = await getAllDynamoUsers();

  // 削除済みユーザーのフィルタリング
  if (!includeDeleted) {
    allUsers = allUsers.filter(user => !user.deletedAt);
  }

  // 検索条件（名前のみ）
  if (search) {
    allUsers = allUsers.filter(user => {
      const nameMatch = user.name?.toLowerCase().includes(search.toLowerCase());
      return nameMatch;
    });
  }

  // 作成日時でソート（新しい順）
  allUsers.sort((a, b) => {
    const aTime = a.createdAt?.getTime() || 0;
    const bTime = b.createdAt?.getTime() || 0;
    return bTime - aTime;
  });

  // 総件数
  const total = allUsers.length;

  // ページネーション
  const offset = (page - 1) * limit;
  const userList = allUsers.slice(offset, offset + limit);

  return {
    users: userList,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * ユーザーIDでユーザーを取得する
 * 
 * 管理者ダッシュボードでユーザー詳細を表示するために使用される。
 * 削除済みユーザーも取得可能。
 * 
 * @param userId - ユーザーID
 * @returns ユーザーオブジェクト、またはundefined（存在しない場合）
 */
export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * ユーザーを論理削除する
 * 
 * ユーザーのdeletedAtフィールドを現在時刻に設定して論理削除を行う。
 * 関連するセッション、ログエントリは保持される（参照整合性のため）。
 * 
 * セキュリティチェック:
 * - 自分自身の削除は不可（バックエンドでチェックする必要がある）
 * - 最後のadminアカウントの削除は不可（バックエンドでチェックする必要がある）
 * 
 * @param userId - 削除するユーザーID
 * @returns 削除成功フラグ
 */
export async function softDeleteUser(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // ユーザーが存在するか確認
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // 既に削除済みの場合は何もしない
  if (user.deletedAt) {
    return true;
  }

  // deletedAtを現在時刻に設定
  await db
    .update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.id, userId));

  return true;
}

/**
 * 監査ログを取得する（管理者専用）
 * 
 * 管理者ダッシュボードでセキュリティ監査ログを表示するために使用される。
 * フィルタリング、ページネーションに対応している。
 * 
 * @param options - 取得オプション
 * @param options.page - ページ番号（1から開始）
 * @param options.limit - 1ページあたりの件数（デフォルト: 50、最大: 100）
 * @param options.eventType - イベントタイプでフィルタリング
 * @param options.severity - 重要度でフィルタリング
 * @param options.userId - ユーザーIDでフィルタリング
 * @param options.sessionId - セッションIDでフィルタリング
 * @param options.startDate - 開始日時（Unix timestamp in ms）
 * @param options.endDate - 終了日時（Unix timestamp in ms）
 * @returns 監査ログ一覧と総件数
 */
export async function getAuditLogs(options: {
  page?: number;
  limit?: number;
  eventType?: string;
  severity?: "info" | "warning" | "critical";
  userId?: number;
  sessionId?: number;
  startDate?: number;
  endDate?: number;
} = {}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const page = options.page || 1;
  const limit = Math.min(options.limit || 50, 100);
  const offset = (page - 1) * limit;

  // WHERE条件を構築
  const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof sql>> = [];

  if (options.eventType) {
    conditions.push(eq(securityAuditLogs.eventType, options.eventType as any));
  }

  if (options.severity) {
    conditions.push(eq(securityAuditLogs.severity, options.severity));
  }

  if (options.userId) {
    conditions.push(eq(securityAuditLogs.userId, options.userId));
  }

  if (options.sessionId) {
    conditions.push(eq(securityAuditLogs.sessionId, options.sessionId));
  }

  if (options.startDate !== undefined) {
    conditions.push(sql`${securityAuditLogs.timestamp} >= ${options.startDate}`);
  }

  if (options.endDate !== undefined) {
    conditions.push(sql`${securityAuditLogs.timestamp} <= ${options.endDate}`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 総件数を取得
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(securityAuditLogs)
    .where(whereClause);
  const total = Number(countResult[0]?.count || 0);

  // 監査ログ一覧を取得
  const logs = await db
    .select()
    .from(securityAuditLogs)
    .where(whereClause)
    .orderBy(desc(securityAuditLogs.timestamp))
    .limit(limit)
    .offset(offset);

  return {
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

