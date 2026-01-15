# Concordia Shrine - FastAPI Backend

FastAPIベースのバックエンドAPIサーバーです。

## セットアップ

### 1. 依存関係のインストール

```bash
pip install -r requirements.txt
```

### 2. 環境変数の設定

`.env.example`をコピーして`.env`を作成し、必要な環境変数を設定してください。

```bash
cp .env.example .env
```

### 3. サーバーの起動

```bash
uvicorn main:app --reload
```

開発環境では`--reload`オプションでホットリロードが有効になります。

## API エンドポイント

### 認証

- `GET /api/v1/auth/me` - 現在のユーザー情報を取得
- `POST /api/v1/auth/logout` - ログアウト
- `GET /api/v1/auth/cognito/callback` - Cognito OAuthコールバック

### セッション管理

- `POST /api/v1/sessions/start` - セッションを開始
- `POST /api/v1/sessions/{session_id}/end` - セッションを終了
- `GET /api/v1/sessions` - セッション一覧を取得
- `GET /api/v1/sessions/{session_id}` - セッション詳細を取得
- `DELETE /api/v1/sessions/{session_id}` - セッションを削除
- `POST /api/v1/sessions/{session_id}/logs` - ログエントリを追加

### 介入設定

- `GET /api/v1/intervention/settings` - 介入設定を取得
- `PUT /api/v1/intervention/settings` - 介入設定を更新

### セキュリティ

- `GET /api/v1/security/stats` - セキュリティ統計を取得
- `GET /api/v1/security/summary/{session_id}` - セキュリティサマリーを取得

### 管理者

- `GET /api/v1/admin/users` - ユーザー一覧を取得
- `GET /api/v1/admin/users/{user_id}` - ユーザー詳細を取得
- `DELETE /api/v1/admin/users/{user_id}` - ユーザーを削除
- `GET /api/v1/admin/audit-logs` - 監査ログを取得

## 開発

### テスト

```bash
pytest
```

### コードフォーマット

```bash
black .
```

### 型チェック

```bash
mypy .
```

## デプロイ

本番環境では、環境変数`NODE_ENV=production`を設定してください。

```bash
NODE_ENV=production uvicorn main:app --host 0.0.0.0 --port 8000
```
