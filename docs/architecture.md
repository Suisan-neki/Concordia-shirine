# Concordia Shrine - 技術仕様書

## システムアーキテクチャ

本システムは、完全なサーバーレス構成（Serverless & Event-Driven）により、高い可用性とスケーラビリティを実現しています。

### データフロー

1.  **クライアント(Client)**
    React 19/Viteで構築されたシングルページアプリケーション(SPA)。ユーザーのデバイス上で動作し、マイク入力や画面描画を担当します。
    
2.  **CDN & セキュリティ(CloudFront + WAF)**
    静的リソースはAmazon S3からCloudFront経由で高速配信されます。AWS WAFにより、エッジロケーションで不正なアクセスを遮断します。

3.  **APIゲートウェイ(API Gateway)**
    バックエンドへのすべてのリクエストを受け付け、適切なLambda関数へルーティングします。

4.  **バックエンド処理(AWS Lambda)**
    サーバー管理不要なFaaS(Function as a Service)環境。
    -   **Node.js**: アプリケーションロジック、セッション管理、tRPC APIサーバーとして動作。
    -   **Python**: 音声データの処理や、高度な数値計算が必要な処理を担当。

5.  **データストア(DynamoDB + S3)**
    -   **DynamoDB**: セッション、ログ、介入設定、監査ログなどのメタデータを保存。
    -   **S3**: 音声/動画ファイルと解析結果のオブジェクトストレージ。

6.  **AI分析(OpenAI API)**
    外部の高度なAIモデルと連携します。
    -   **Realtime / Whisper**: 音声データのテキスト化。
    -   **GPT-5-mini**: 文脈の理解、セッションの「空気」のスコアリング。

---

## 技術スタック詳細

### フロントエンド (Frontend)
-   **フレームワーク**: React 19
-   **言語**: TypeScript 5.x
-   **ビルドツール**: Vite 6.x
-   **スタイリング**: Tailwind CSS 4
-   **アニメーション**: Framer Motion
-   **UIコンポーネント**: Radix UI

### バックエンド (Backend)
-   **APIフレームワーク**: tRPC (エンドツーエンドの型安全性を提供)
-   **コンピューティング**: AWS Lambda (Web Adapter使用)
-   **ランタイム**: Node.js / Python
-   **AIサービス**: OpenAI API
-   **スキーマ/型定義**: Drizzle ORM（型定義用途、DB実体はDynamoDB）

### インフラストラクチャ (Infrastructure)
-   **構築ツール (IaC)**: AWS CDK (TypeScript)
-   **認証**: Amazon Cognito
-   **CDN**: Amazon CloudFront
-   **ストレージ**: Amazon S3
-   **データベース**: Amazon DynamoDB
-   **APIゲートウェイ**: Amazon API Gateway

---

## セキュリティ実装 (Security)

### 1. ドメイン分離 (Domain Segregation)
フロントエンド（CloudFront配信）とバックエンド（API Gateway）のドメインを物理的に分離することで、同一オリジンポリシーの制限を活用し、クロスサイトスクリプティング(XSS)などのリスクを構造的に低減しています。

### 2. 最小権限の原則 (Least Privilege)
各AWS Lambda関数には、そのタスクを実行するために「必要最低限」のIAM権限のみを付与しています。万が一関数が侵害されても、被害を最小限に抑えます。

### 3. 型安全性 (Type Safety)
tRPCの採用により、フロントエンドからバックエンドまで完全な型安全性を確保しています。定義されていないデータ構造や不正な型のリクエストはコンパイル時および実行時に排除されます。

### 4. コンストラクタ安全性 (Constructor Safety)
ドメイン駆動設計(DDD)の思想に基づき、`SessionEntity`などの重要なデータモデルは、バリデータを通した「常に正しい状態」でのみインスタンス化できるようコードレベルで制限しています。
