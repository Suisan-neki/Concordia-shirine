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
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
