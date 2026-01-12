/**
 * DynamoDBクライアント設定
 * 
 * AWS DynamoDBへの接続を管理する。
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ENV } from "./env";

/**
 * DynamoDBクライアントのシングルトンインスタンス
 */
let _dynamoClient: DynamoDBDocumentClient | null = null;

/**
 * DynamoDBクライアントを取得する
 * 
 * 初回呼び出し時にクライアントを作成し、以降は同じインスタンスを返す。
 * リージョンは環境変数から取得する（デフォルト: ap-northeast-1）。
 * 
 * @returns DynamoDBDocumentClientインスタンス
 */
export function getDynamoClient(): DynamoDBDocumentClient {
  if (!_dynamoClient) {
    const client = new DynamoDBClient({
      region: ENV.cognitoRegion || process.env.AWS_REGION || "ap-northeast-1",
    });
    
    _dynamoClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }
  
  return _dynamoClient;
}

/**
 * テーブル名を取得する
 * 
 * 環境変数からテーブル名を取得するか、デフォルトの命名規則を使用する。
 * CDKで作成されるテーブル名は `concordia-{tableName}-{environment}` 形式。
 * 
 * @param tableName - ベーステーブル名（例: "users"）
 * @returns 完全なテーブル名
 */
export function getTableName(tableName: string): string {
  // 環境変数で明示的に指定されている場合はそれを使用
  const envKey = `DYNAMODB_TABLE_${tableName.toUpperCase()}`;
  if (process.env[envKey]) {
    return process.env[envKey];
  }
  
  // 環境変数でプレフィックスが指定されている場合
  const prefix = process.env.DYNAMODB_TABLE_PREFIX || "";
  if (prefix) {
    return `${prefix}${tableName}`;
  }
  
  // デフォルト: 環境に応じたテーブル名
  // 開発環境では "users"、本番環境では "concordia-users-prod" など
  const environment = process.env.NODE_ENV === "production" ? "prod" : "dev";
  return `concordia-${tableName}-${environment}`;
}

