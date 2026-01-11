/**
 * 静的ファイル配信サーバー
 * 
 * 本番環境用のシンプルな静的ファイル配信サーバー。
 * ビルド済みの静的ファイル（HTML、CSS、JavaScript）を配信し、
 * クライアントサイドルーティングに対応する。
 */
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

/**
 * 現在のファイルのパス（ESモジュール用）
 * 
 * ESモジュールでは__dirnameが利用できないため、fileURLToPathとimport.meta.urlを使用して取得する。
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * サーバーを起動する
 * 
 * Expressサーバーを起動し、静的ファイルを配信する。
 * クライアントサイドルーティング（SPA: Single Page Application）に対応するため、
 * 全てのルートでindex.htmlを返す。
 * 
 * 処理の流れ:
 * 1. ExpressアプリケーションとHTTPサーバーを作成
 * 2. 静的ファイルのパスを決定（本番環境と開発環境で異なる）
 * 3. 静的ファイルを配信（express.static）
 * 4. 全てのルートでindex.htmlを返す（クライアントサイドルーティング対応）
 * 5. サーバーを起動
 */
async function startServer() {
  const app = express();
  const server = createServer(app);

  // 静的ファイルのパスを決定
  // 本番環境: ./public から配信
  // 開発環境: ../dist/public から配信（ビルド済みファイル）
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  // 静的ファイルを配信
  // express.staticミドルウェアを使用して、staticPath以下のファイルを配信
  app.use(express.static(staticPath));

  // クライアントサイドルーティングに対応
  // 全てのルートでindex.htmlを返すことで、React Routerなどのクライアントサイドルーティングが動作する
  // サーバーサイドではルートごとのHTMLファイルを持たず、全てのルートで同じindex.htmlを返す
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // ポート番号を取得（環境変数から、またはデフォルト: 3000）
  const port = process.env.PORT || 3000;

  // サーバーを起動
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

// サーバーを起動（エラーが発生した場合はコンソールに出力）
startServer().catch(console.error);
