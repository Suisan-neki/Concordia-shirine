/**
 * DynamoDBデータベース操作
 * 
 * AWS DynamoDBを使用したデータベース操作を提供する。
 * MySQLからDynamoDBへの移行版。
 * 
 * テーブル命名規則:
 * - ユーザーテーブル: concordia-users-{environment}
 * - セキュリティ監査ログテーブル: concordia-securityAuditLogs-{environment}
 * 
 * これらのテーブルは cdk/lib/stacks/storage-stack.ts で定義されている。
 */

import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, getTableName } from "./_core/dynamodb";
import { ENV } from "./_core/env";
import type { User, InsertUser, SecurityAuditLog } from "../drizzle/schema";
import { createHash } from "crypto";

// Table names: concordia-{tableName}-{environment}
const USERS_TABLE = getTableName("users");
const SECURITY_AUDIT_LOGS_TABLE = getTableName("securityAuditLogs");

/**
 * UUIDから安全な数値IDを生成
 * 
 * SHA-256ハッシュを使用して、UUIDから一貫性のある数値IDを生成する。
 * これにより、ID衝突のリスクを軽減する。
 * 
 * @param uuid - UUID文字列
 * @returns 正の整数ID
 */
function generateIdFromUuid(uuid: string): number {
  // SHA-256ハッシュを使用してUUIDから一貫性のある値を生成
  const hash = createHash('sha256').update(uuid).digest('hex');
  // ハッシュの最初の12文字（48ビット）を使用して数値を生成
  // これにより、JavaScriptのNumber.MAX_SAFE_INTEGER (2^53-1) 内に収まる
  const id = parseInt(hash.substring(0, 12), 16);
  // 0を避けるため、0の場合は1を返す
  return id || 1;
}

/**
 * ユーザーをopenIdで取得する
 * 
 * @param openId - ユーザーのOpenID
 * @returns ユーザーオブジェクト、またはnull（見つからない場合）
 */
export async function getUserByOpenId(openId: string): Promise<User | null> {
  const client = getDynamoClient();
  
  try {
    const result = await client.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: {
          openId,
        },
      })
    );
    
    if (!result.Item) {
      return null;
    }
    
    // DynamoDBのアイテムをUser型に変換
    const userRole = result.Item.role || "user";
    // デバッグログ（個人情報はマスク）
    if (process.env.DEBUG_AUTH === "true") {
      console.log("[DynamoDB] User retrieved:", {
        openId: result.Item.openId ? `${result.Item.openId.substring(0, 10)}...` : null,
        role: userRole,
        name: result.Item.name ? "[REDACTED]" : null,
        ownerOpenId: ENV.ownerOpenId ? `${ENV.ownerOpenId.substring(0, 10)}...` : null,
        isOwner: result.Item.openId === ENV.ownerOpenId,
      });
    }
    
    // IDはopenIdのハッシュから生成（互換性のため）
    // DynamoDBではidは不要だが、既存のコードとの互換性のために生成
    const id = generateIdFromUuid(result.Item.openId);
    
    return {
      id, // openIdから生成したID
      openId: result.Item.openId,
      name: result.Item.name || null,
      email: result.Item.email || null,
      loginMethod: result.Item.loginMethod || null,
      role: userRole,
      deletedAt: result.Item.deletedAt ? new Date(result.Item.deletedAt) : null,
      createdAt: result.Item.createdAt ? new Date(result.Item.createdAt) : new Date(),
      updatedAt: result.Item.updatedAt ? new Date(result.Item.updatedAt) : new Date(),
      lastSignedIn: result.Item.lastSignedIn ? new Date(result.Item.lastSignedIn) : new Date(),
    } as User;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // テーブルが存在しない場合のエラーを特別に処理
    if (errorMessage.includes("ResourceNotFoundException") || errorMessage.includes("Table not found")) {
      console.warn(`[DynamoDB] Table "${USERS_TABLE}" does not exist. Please create it in AWS Console or using CDK.`);
      console.warn(`[DynamoDB] Table name: ${USERS_TABLE}`);
      console.warn(`[DynamoDB] Region: ${ENV.cognitoRegion || process.env.AWS_REGION || "ap-northeast-1"}`);
    } else {
      console.error("[DynamoDB] Failed to get user:", error);
    }
    return null;
  }
}

/**
 * ユーザーを保存または更新する（upsert）
 * 
 * @param user - 保存または更新するユーザーのデータ
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const client = getDynamoClient();
  
  // ロール変数をスコープの最上位で宣言
  let role = user.role || "user";
  
  try {
    // 既存のユーザーを取得
    const existingUser = await getUserByOpenId(user.openId);
    
    // 現在時刻
    const now = new Date().toISOString();
    
    // ロールの決定
    role = user.role || existingUser?.role || "user";
    if (user.openId === ENV.ownerOpenId) {
      console.log("[DynamoDB] Owner OpenID matched, setting role to admin:", {
        userOpenId: user.openId,
        ownerOpenId: ENV.ownerOpenId,
      });
      role = "admin";
    } else {
      console.log("[DynamoDB] Owner OpenID check:", {
        userOpenId: user.openId,
        ownerOpenId: ENV.ownerOpenId,
        ownerOpenIdSet: !!ENV.ownerOpenId,
        match: user.openId === ENV.ownerOpenId,
      });
    }
    
    // 更新するアイテムを構築
    const item: Record<string, unknown> = {
      openId: user.openId,
      role,
      updatedAt: now,
    };
    
    // オプションのフィールドを追加
    if (user.name !== undefined) {
      item.name = user.name || null;
    } else if (existingUser?.name) {
      item.name = existingUser.name;
    }
    
    if (user.email !== undefined) {
      item.email = user.email || null;
    } else if (existingUser?.email) {
      item.email = existingUser.email;
    }
    
    if (user.loginMethod !== undefined) {
      item.loginMethod = user.loginMethod || null;
    } else if (existingUser?.loginMethod) {
      item.loginMethod = existingUser.loginMethod;
    }
    
    // 削除済みユーザーの場合は最終ログイン日時を更新しない
    if (existingUser?.deletedAt) {
      // 削除済みユーザーの場合は、既存の最終ログイン日時を保持
      if (existingUser.lastSignedIn) {
        item.lastSignedIn = existingUser.lastSignedIn.toISOString();
      }
    } else if (user.lastSignedIn !== undefined) {
      item.lastSignedIn = user.lastSignedIn.toISOString();
    } else {
      item.lastSignedIn = now;
    }
    
    // createdAtの処理
    if (!existingUser) {
      // 新規作成の場合のみcreatedAtを設定
      item.createdAt = now;
    } else if (existingUser.createdAt) {
      // 既存ユーザーの場合は、既存のcreatedAtを保持
      item.createdAt = existingUser.createdAt.toISOString();
    }
    
    // deletedAtの処理
    if (user.deletedAt !== undefined) {
      item.deletedAt = user.deletedAt ? user.deletedAt.toISOString() : null;
    } else if (existingUser?.deletedAt) {
      item.deletedAt = existingUser.deletedAt.toISOString();
    }
    
    // DynamoDBに保存
    await client.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: item,
      })
    );
    
    // デバッグログ（個人情報はマスク）
    if (process.env.DEBUG_AUTH === "true") {
      console.log("[DynamoDB] User upserted:", {
        openId: user.openId ? `${user.openId.substring(0, 10)}...` : null,
        role,
        name: item.name ? "[REDACTED]" : null,
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // テーブルが存在しない場合のエラーを特別に処理
    if (errorMessage.includes("ResourceNotFoundException") || errorMessage.includes("Table not found")) {
      console.warn(`[DynamoDB] Table "${USERS_TABLE}" does not exist. Please create it in AWS Console or using CDK.`);
      console.warn(`[DynamoDB] Table name: ${USERS_TABLE}`);
      console.warn(`[DynamoDB] Region: ${ENV.cognitoRegion || process.env.AWS_REGION || "ap-northeast-1"}`);
      // スコープ内の変数のみを使用（個人情報はマスク）
      const maskedOpenId = user.openId ? `${user.openId.substring(0, 10)}...` : null;
      const maskedName = user.name ? "[REDACTED]" : null;
      console.warn(`[DynamoDB] User data that would have been saved:`, {
        openId: maskedOpenId,
        role,
        name: maskedName,
      });
      // エラーを投げずに警告のみを出力（アプリケーションが動作し続けるように）
      return;
    }
    console.error("[DynamoDB] Failed to upsert user:", error);
    throw error;
  }
}

/**
 * すべてのユーザーを取得する（管理者用）
 * 
 * DynamoDBのScanは1MBのデータ制限があるため、ページネーションを実装している。
 * LastEvaluatedKeyを使用して、大きなデータセットにも対応。
 * 
 * @param includeDeleted - 削除済みユーザーを含めるかどうか（デフォルト: false）
 * @returns ユーザーの配列
 */
export async function getAllUsers(includeDeleted: boolean = false): Promise<User[]> {
  const client = getDynamoClient();
  
  try {
    // DynamoDBで全件取得するにはScanを使用
    const scanParams: {
      TableName: string;
      FilterExpression?: string;
      ExpressionAttributeValues?: Record<string, unknown>;
      ExclusiveStartKey?: Record<string, unknown>;
    } = {
      TableName: USERS_TABLE,
    };
    
    // 削除済みユーザーを含めない場合はフィルタリング
    if (!includeDeleted) {
      scanParams.FilterExpression = "attribute_not_exists(deletedAt) OR deletedAt = :null";
      scanParams.ExpressionAttributeValues = {
        ":null": null,
      };
    }
    
    // すべてのページを取得するまでループ
    let allItems: Array<Record<string, unknown>> = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;
    
    do {
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await client.send(
        new ScanCommand(scanParams)
      );
      
      if (result.Items && result.Items.length > 0) {
        allItems = allItems.concat(result.Items);
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    if (allItems.length === 0) {
      return [];
    }
    
    return allItems.map((item) => {
      // IDはopenIdのハッシュから生成（互換性のため）
      const id = generateIdFromUuid(item.openId as string);
      
      return {
        id, // openIdから生成したID
        openId: item.openId,
        name: item.name || null,
        email: item.email || null,
        loginMethod: item.loginMethod || null,
        role: item.role || "user",
        deletedAt: item.deletedAt ? new Date(item.deletedAt as string | number) : null,
        createdAt: item.createdAt ? new Date(item.createdAt as string | number) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt as string | number) : new Date(),
        lastSignedIn: item.lastSignedIn ? new Date(item.lastSignedIn as string | number) : new Date(),
      };
    }) as User[];
  } catch (error) {
    console.error("[DynamoDB] Failed to get all users:", error);
    return [];
  }
}

/**
 * ユーザーを論理削除する
 * 
 * @param userId - ユーザーID（openIdから生成された数値）
 * @returns 削除成功フラグ
 */
export async function softDeleteUser(userId: number): Promise<boolean> {
  const client = getDynamoClient();
  
  try {
    // まず、すべてのユーザーを取得してuserIdで検索
    const allUsers = await getAllUsers(true);
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // 既に削除済みの場合は何もしない
    if (user.deletedAt) {
      return true;
    }
    
    // deletedAtを現在時刻に設定して更新
    await client.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          openId: user.openId,
          name: user.name || null,
          email: user.email || null,
          loginMethod: user.loginMethod || null,
          role: user.role || "user",
          deletedAt: new Date().toISOString(),
          createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastSignedIn: user.lastSignedIn?.toISOString() || new Date().toISOString(),
        },
      })
    );
    
    // デバッグログ（個人情報はマスク）
    if (process.env.DEBUG_AUTH === "true") {
      console.log("[DynamoDB] User soft deleted:", {
        userId,
        openId: user.openId ? `${user.openId.substring(0, 10)}...` : null,
      });
    }
    return true;
  } catch (error) {
    console.error("[DynamoDB] Failed to soft delete user:", error);
    throw error;
  }
}

// ===== Security Audit Logs =====

/**
 * セキュリティ監査ログを取得する
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
export async function getSecurityAuditLogs(options: {
  page?: number;
  limit?: number;
  eventType?: string;
  severity?: "info" | "warning" | "critical";
  userId?: number;
  sessionId?: number;
  startDate?: number;
  endDate?: number;
} = {}): Promise<{ logs: SecurityAuditLog[]; total: number; page: number; limit: number; totalPages: number }> {
  const client = getDynamoClient();
  const limit = Math.min(options.limit || 50, 100);
  const page = options.page || 1;

  try {
    const scanParams: {
      TableName: string;
      FilterExpression?: string;
      ExpressionAttributeValues?: Record<string, unknown>;
      ExpressionAttributeNames?: Record<string, string>;
      ExclusiveStartKey?: Record<string, unknown>;
    } = {
      TableName: SECURITY_AUDIT_LOGS_TABLE,
    };

    const filterExpressions: string[] = [];
    const expressionAttributeValues: Record<string, unknown> = {};
    const expressionAttributeNames: Record<string, string> = {};

    if (options.eventType) {
      filterExpressions.push("eventType = :eventType");
      expressionAttributeValues[":eventType"] = options.eventType;
    }
    if (options.severity) {
      filterExpressions.push("severity = :severity");
      expressionAttributeValues[":severity"] = options.severity;
    }
    if (options.userId !== undefined) {
      filterExpressions.push("userId = :userId");
      expressionAttributeValues[":userId"] = options.userId;
    }
    if (options.sessionId !== undefined) {
      filterExpressions.push("sessionId = :sessionId");
      expressionAttributeValues[":sessionId"] = options.sessionId;
    }
    if (options.startDate !== undefined) {
      filterExpressions.push("#ts >= :startDate");
      expressionAttributeValues[":startDate"] = options.startDate;
      expressionAttributeNames["#ts"] = "timestamp";
    }
    if (options.endDate !== undefined) {
      filterExpressions.push("#ts <= :endDate");
      expressionAttributeValues[":endDate"] = options.endDate;
      expressionAttributeNames["#ts"] = "timestamp";
    }

    if (filterExpressions.length > 0) {
      scanParams.FilterExpression = filterExpressions.join(" AND ");
      scanParams.ExpressionAttributeValues = expressionAttributeValues;
      if (Object.keys(expressionAttributeNames).length > 0) {
        scanParams.ExpressionAttributeNames = expressionAttributeNames;
      }
    }

    // すべてのページを取得するまでループ（DynamoDBの1MB制限に対応）
    let allItems: Array<Record<string, unknown>> = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;
    
    do {
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await client.send(new ScanCommand(scanParams));
      
      if (result.Items && result.Items.length > 0) {
        allItems = allItems.concat(result.Items);
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const allLogs = allItems.map(item => {
      // IDはlogIdのハッシュから生成（互換性のため）
      const id = item.logId ? generateIdFromUuid(item.logId as string) : 0;

      return {
        id,
        userId: item.userId || null,
        sessionId: item.sessionId || null,
        eventType: item.eventType,
        severity: item.severity || "info",
        description: item.description,
        metadata: item.metadata || null,
        ipHash: item.ipHash || null,
        userAgent: item.userAgent || null,
        timestamp: item.timestamp,
        createdAt: item.createdAt ? new Date(item.createdAt as string | number) : new Date(),
      };
    }) as SecurityAuditLog[];

    // timestampでソート（降順）
    allLogs.sort((a, b) => b.timestamp - a.timestamp);

    // ページネーション
    const total = allLogs.length;
    const offset = (page - 1) * limit;
    const logs = allLogs.slice(offset, offset + limit);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("[DynamoDB] Failed to get security audit logs:", error);
    // エラーが発生した場合は空の結果を返す
    return {
      logs: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };
  }
}

