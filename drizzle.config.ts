import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";

// .envファイルを読み込む（プロジェクトルートから）
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath });
} else {
  console.warn(`Warning: .env file not found at ${envPath}`);
}

const connectionString = process.env.DATABASE_URL;

// DynamoDBに移行したため、DATABASE_URLは開発環境でのみ必要
// 本番環境ではDrizzleコマンドは使用されない
if (!connectionString) {
  console.warn("Warning: DATABASE_URL is not set. Drizzle commands will not work.");
  console.warn("This is expected if you are using DynamoDB instead of MySQL.");
  // デフォルト値を設定して、drizzle.config.tsが読み込まれるようにする
  // 実際にはこの値は使用されない
  process.env.DATABASE_URL = "mysql://placeholder:placeholder@localhost:3306/placeholder";
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
