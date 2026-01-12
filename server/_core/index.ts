/**
 * サーバー起動処理
 * 
 * Expressサーバーを起動し、tRPC API、OAuth認証、静的ファイル配信を設定する。
 * CSRF対策を含むセキュリティミドルウェアを適用する。
 */
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";

/**
 * ローカルホストのホスト名のセット
 * 
 * 開発環境で使用されるローカルホストのホスト名を定義する。
 * CSRF対策で、ローカルホスト間の通信を許可するために使用される。
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * ポートが利用可能かどうかを確認する
 * 
 * 指定されたポートが使用可能かどうかを非同期で確認する。
 * ポートが既に使用されている場合はfalseを返す。
 * 
 * @param port - 確認するポート番号
 * @returns ポートが利用可能な場合はtrue、それ以外はfalse
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    // ポートをリッスンして使用可能か確認
    server.listen(port, () => {
      // ポートが使用可能な場合、サーバーを閉じてtrueを返す
      server.close(() => resolve(true));
    });
    // エラーが発生した場合（ポートが既に使用されている場合）はfalseを返す
    server.on("error", () => resolve(false));
  });
}

/**
 * 利用可能なポートを見つける
 * 
 * 指定された開始ポートから順に確認し、利用可能なポートを見つける。
 * 最大20個のポートを確認し、全て使用中の場合はエラーを投げる。
 * 
 * @param startPort - 検索を開始するポート番号（デフォルト: 3000）
 * @returns 利用可能なポート番号
 * @throws {Error} 利用可能なポートが見つからない場合
 */
async function findAvailablePort(startPort: number = 3000): Promise<number> {
  // 開始ポートから20個のポートを順に確認
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  // 全てのポートが使用中の場合はエラーを投げる
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * サーバーを起動する
 * 
 * Expressサーバーを起動し、以下の機能を設定する:
 * - ボディパーサー（JSON、URLエンコード）
 * - CSRF対策ミドルウェア
 * - OAuth認証ルート（設定されている場合）
 * - tRPC API
 * - 静的ファイル配信（本番環境）またはVite開発サーバー（開発環境）
 * 
 * 処理の流れ:
 * 1. ExpressアプリケーションとHTTPサーバーを作成
 * 2. ボディパーサーを設定（ファイルアップロードに対応するため50MBに制限を拡大）
 * 3. CSRF対策ミドルウェアを適用
 * 4. OAuth認証ルートを登録（設定されている場合）
 * 5. tRPC APIを設定
 * 6. 静的ファイル配信またはVite開発サーバーを設定
 * 7. 利用可能なポートを見つけてサーバーを起動
 */
async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // ボディパーサーを設定（ファイルアップロードに対応するため50MBに制限を拡大）
  // JSON形式のリクエストボディをパース
  app.use(express.json({ limit: "50mb" }));
  // URLエンコード形式のリクエストボディをパース
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // 基本的なCSRF対策: 状態変更リクエストに対して、同一オリジン（または許可リスト）を要求
  // CSRF攻撃を防ぐため、POST、PUT、DELETEなどの状態変更リクエストのオリジンを検証する
  app.use((req, res, next) => {
    const method = req.method.toUpperCase();
    // GET、HEAD、OPTIONSは読み取り専用なので、CSRFチェックをスキップ
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      next();
      return;
    }

    const origin = req.headers.origin;
    // Originヘッダーがない場合はスキップ（同一オリジンリクエストの可能性）
    if (!origin) {
      next();
      return;
    }

    try {
      const originUrl = new URL(origin);
      const allowedOrigins = new Set(ENV.allowedOrigins);
      
      // 許可リストに含まれているオリジンは許可
      if (allowedOrigins.has(origin)) {
        next();
        return;
      }

      // オリジンのホスト名がリクエストのホスト名と一致する場合は許可（同一オリジン）
      if (originUrl.hostname === req.hostname) {
        next();
        return;
      }

      // ローカルホスト間の通信は許可（開発環境での利便性のため）
      if (LOCAL_HOSTS.has(originUrl.hostname) && LOCAL_HOSTS.has(req.hostname)) {
        next();
        return;
      }
    } catch {
      // URLパースに失敗した場合は拒否
      // fall through to deny
    }

    // CSRFチェックに失敗した場合は403エラーを返す
    res.status(403).json({ error: "CSRF check failed" });
  });
  
  // レガシーOAuthコールバック（/api/oauth/callback）（設定されている場合のみ）
  if (ENV.oAuthServerUrl) {
    const { registerOAuthRoutes } = await import("./oauth");
    registerOAuthRoutes(app);
  }

  // Cognito Authorization Code Grant コールバック
  console.log("[Server] Cognito configuration check:", {
    cognitoRegion: ENV.cognitoRegion ? `${ENV.cognitoRegion.substring(0, 10)}...` : "未設定",
    cognitoUserPoolId: ENV.cognitoUserPoolId ? `${ENV.cognitoUserPoolId.substring(0, 10)}...` : "未設定",
    cognitoClientId: ENV.cognitoClientId ? `${ENV.cognitoClientId.substring(0, 10)}...` : "未設定",
  });

  if (ENV.cognitoRegion && ENV.cognitoUserPoolId && ENV.cognitoClientId) {
    const { handleCognitoCallback } = await import("./cognitoCallback");
    app.get("/api/auth/cognito/callback", handleCognitoCallback);
    console.log("[Server] Cognito callback endpoint registered: /api/auth/cognito/callback");
  } else {
    console.warn("[Server] Cognito callback endpoint not registered: missing configuration");
    console.warn("[Server] Required environment variables:", {
      COGNITO_REGION: process.env.COGNITO_REGION || "未設定",
      COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || "未設定",
      COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || "未設定",
    });
  }
  
  // tRPC API
  // /api/trpcパスでtRPCエンドポイントを公開
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // 開発モードではViteを使用、本番モードでは静的ファイルを配信
  if (process.env.NODE_ENV === "development") {
    // 開発モード: Vite開発サーバーを設定（ホットリロード対応）
    await setupVite(app, server);
  } else {
    // 本番モード: ビルド済みの静的ファイルを配信
    serveStatic(app);
  }

  // 環境変数からポート番号を取得（デフォルト: 5173）
  const preferredPort = parseInt(process.env.PORT || "5173");
  // 利用可能なポートを見つける（指定されたポートが使用中の場合は別のポートを検索）
  const port = await findAvailablePort(preferredPort);

  // ポートが変更された場合はログに出力
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // サーバーを起動
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

// サーバーを起動（エラーが発生した場合はコンソールに出力）
startServer().catch(console.error);
