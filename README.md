# Concordia Wave

> 「ヒューマンセキュリティなくしてサイバーセキュリティは実現しない」

対話の揺らぎを可視化し、判断の自由をそっと守るプロダクト。

## コンセプト

Concordia Waveは、会議やミーティングにおける「見えない圧力」を可視化するWebアプリケーションです。

### 守りたいもの

- **「はい」と言ってしまう0.5秒前の、まだ自由な心**
- **気まずさや沈黙のせいで飲み込まれてしまう違和感**
- **場の流れに押し流される前の「本当はこう思っている」の可能性**

### Human Decision Security

従来のセキュリティは、データやネットワークを守ることに焦点を当ててきました。

しかし、Concordia Waveは「人の判断の自由」を守ることを目指します。

技術的な防御（サイバーセキュリティ）が、心理的な安全（ヒューマンセキュリティ）を支え、
その逆もまた真なのです。

## 機能

### 対話の揺らぎの可視化

- **波の生成**: 文字起こしや発話の変化をもとに、有機的な波で対話の揺らぎをリアルタイムに表現
- **シーン判定**: 静寂、調和、一方的、沈黙の4つの状態を自動検出
- **セキュリティバリア**: 画面端の光が「結界」として、保護状態を視覚化

### 介入機能

- **リアルタイム検知**: 「一方的」や「沈黙」状態が続くと自動で検知
- **穏やかな通知**: 通知音とヒントメッセージで、参加者に気づきを促す
- **カスタマイズ可能**: 介入のタイミングや方法を設定可能

### レポート出力

- **セッション分析**: 対話の傾向やセキュリティスコアを分析
- **Markdown/HTML出力**: 振り返りに活用できるレポートを生成

### 気づかないうちに守られている

以下のセキュリティ機能が、ユーザーが意識することなくバックグラウンドで動作しています：

| 機能 | 説明 |
|------|------|
| **暗号化** | セッションデータを暗号化 |
| **レート制限** | 異常なアクセスパターンを制限 |
| **入力サニタイズ** | 不正な入力パターンの検知 |
| **監査ログ** | セキュリティイベントを自動記録 |

ログインユーザーは「詳細」ボタンから、これらの守護者たちの働きを確認できます。

## 技術スタック

- **フロントエンド**: React 19 + TypeScript + Tailwind CSS 4
- **バックエンド**: FastAPI (Python) + REST API
- **データベース**: AWS DynamoDB
- **認証**: OAuth 2.0 + JWT
- **波生成**: Perlin Noise Algorithm
- **音声分析**: Web Audio API + Web Speech API

## リポジトリ構成

- `client/`: フロントエンド（React/Vite）
- `server_python/`: FastAPIバックエンド
- `shared/`: フロント/バック共通の型・定数
- `cdk/`: インフラ定義（AWS CDK）
- `src/`: ローカル音声プロトタイプ（Webアプリ本番経路では未使用）

## 開発

### セットアップ

```bash
# フロントエンド依存関係のインストール
pnpm install

# DynamoDBテーブルの作成
# AWS CLIを使用してテーブルを作成する場合:
# (dev環境を指定する場合は引数で切り替え可能)
./scripts/create-dynamodb-table.sh dev
# 作成されるテーブル:
# - concordia-users-*
# - concordia-securityAuditLogs-*
# - concordia-interviews-*
# - concordia-sessions-*
# - concordia-sessionLogs-*
# - concordia-interventionSettings-*

# または、AWS CDKを使用してインフラをデプロイする場合:
# cd cdk && cdk deploy
```

### バックエンド（FastAPI）
```bash
cd server_python
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

### フロントエンド
```bash
pnpm dev
```

### テストの実行
```bash
pnpm test
```

### 品質チェック（最低限）
```bash
# フロントエンド型チェック
pnpm check

# バックエンドテスト
cd server_python
pytest
```

#### 環境変数

- `server_python/.env`: FastAPIの環境変数（`.env.example`を参照）
- `VITE_API_URL`: フロントエンドからFastAPIのURLを指定（例: `http://localhost:8000`）

## 哲学

> あなたがこの祠を訪れた瞬間、見えない結界が展開されました。
> 
> それは、あなたが気づくことなく、静かに、しかし確実に動き始めています。
> 
> あなたの言葉を守り、あなたの判断の自由を守り、あなたが安心して対話できる空間を創り出すために。
> 
> これは、技術が人を守る物語です。

詳しくは [システムアーキテクチャ詳細](docs/architecture.md) をご覧ください。

## ライセンス

MIT License

---

Concordia Wave — Human Decision Security
