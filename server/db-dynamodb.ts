/**
 * DynamoDBデータベース操作
 * 
 * AWS DynamoDBを使用したデータベース操作を提供する。
 * MySQLからDynamoDBへの移行版。
 */

import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, getTableName } from "./_core/dynamodb";
import { ENV } from "./_core/env";
import type { User, InsertUser } from "../drizzle/schema";

const USERS_TABLE = getTableName("users");

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
    console.log("[DynamoDB] User retrieved:", {
      openId: result.Item.openId,
      role: userRole,
      name: result.Item.name,
      ownerOpenId: ENV.ownerOpenId,
      isOwner: result.Item.openId === ENV.ownerOpenId,
    });
    
    return {
      id: result.Item.id || 0, // DynamoDBではidは不要だが、互換性のため
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
  
  try {
    // 既存のユーザーを取得
    const existingUser = await getUserByOpenId(user.openId);
    
    // 現在時刻
    const now = new Date().toISOString();
    
    // ロールの決定
    let role = user.role || existingUser?.role || "user";
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
    
    if (user.lastSignedIn !== undefined) {
      item.lastSignedIn = user.lastSignedIn.toISOString();
    } else {
      item.lastSignedIn = now;
    }
    
    // 新規作成の場合のみcreatedAtを設定
    if (!existingUser) {
      item.createdAt = now;
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
    
    console.log("[DynamoDB] User upserted:", { openId: user.openId, role, name: item.name });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // テーブルが存在しない場合のエラーを特別に処理
    if (errorMessage.includes("ResourceNotFoundException") || errorMessage.includes("Table not found")) {
      console.warn(`[DynamoDB] Table "${USERS_TABLE}" does not exist. Please create it in AWS Console or using CDK.`);
      console.warn(`[DynamoDB] Table name: ${USERS_TABLE}`);
      console.warn(`[DynamoDB] Region: ${ENV.cognitoRegion || process.env.AWS_REGION || "ap-northeast-1"}`);
      console.warn(`[DynamoDB] User data that would have been saved:`, { openId: user.openId, role, name: item.name });
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
 * @returns ユーザーの配列
 */
export async function getAllUsers(): Promise<User[]> {
  const client = getDynamoClient();
  
  try {
    // DynamoDBで全件取得するにはScanを使用
    const result = await client.send(
      new ScanCommand({
        TableName: USERS_TABLE,
        // deletedAtがnullのもののみ取得（論理削除されていないユーザーのみ）
        FilterExpression: "attribute_not_exists(deletedAt) OR deletedAt = :null",
        ExpressionAttributeValues: {
          ":null": null,
        },
      })
    );
    
    if (!result.Items) {
      return [];
    }
    
    return result.Items.map((item) => ({
      id: item.id || 0,
      openId: item.openId,
      name: item.name || null,
      email: item.email || null,
      loginMethod: item.loginMethod || null,
      role: item.role || "user",
      deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      lastSignedIn: item.lastSignedIn ? new Date(item.lastSignedIn) : new Date(),
    })) as User[];
  } catch (error) {
    console.error("[DynamoDB] Failed to get all users:", error);
    return [];
  }
}

