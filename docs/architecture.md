# Concordia Shrine - 技術仕様書

## システムアーキテクチャ（現行）

本システムは、SPA + FastAPI を中心とした構成で動作します。インフラはAWSを前提にしていますが、ローカル開発ではFastAPIを直接起動します。

### データフロー

1. **クライアント (client/)**
   React + Viteで構築されたSPA。波の描画、録音制御、ダッシュボード表示を担当します。

2. **バックエンドAPI (server_python/)**
   FastAPIがAPIの入口となり、セッション・介入設定・セキュリティ統計などのAPIを提供します。

3. **認証 (Amazon Cognito)**
   OAuth 2.0の認可コードフローにより、ユーザー認証を行います。

4. **データストア (DynamoDB)**
   セッション、ログ、監査ログ、設定データを保存します。

5. **インフラ管理 (cdk/)**
   AWSリソースはCDKで管理する想定です（必要に応じて利用）。

### 補足: レガシー/試作領域

- `src/` はローカル実行の音声プロトタイプ用コードです（Webアプリの本番経路では使用しません）。
- `src/aws-lambdas/` は旧構成の試作コードです。現行のFastAPI経路とは別系統です。

---

## 技術スタック詳細

### フロントエンド
- **フレームワーク**: React 19
- **言語**: TypeScript 5.x
- **ビルドツール**: Vite
- **スタイリング**: Tailwind CSS
- **アニメーション**: Framer Motion
- **UIコンポーネント**: Radix UI

### バックエンド
- **APIフレームワーク**: FastAPI
- **データ検証**: Pydantic
- **認証/JWT**: python-jose
- **データストア**: DynamoDB

### インフラ
- **IaC**: AWS CDK (TypeScript)
- **認証**: Amazon Cognito
- **データベース**: Amazon DynamoDB

---

## セキュリティ実装（現行の考え方）

### 1. ドメイン分離
フロントエンドとAPIは別オリジンで運用し、CORSで制御します。

### 2. 入力検証
FastAPI + Pydantic によるスキーマ検証で不正な入力を早期に遮断します。

### 3. 認証とセッション
Cognitoの認証結果を検証し、JWTベースのセッションを使用します。
