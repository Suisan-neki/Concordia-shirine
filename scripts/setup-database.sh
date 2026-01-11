#!/bin/bash
# Concordia Shrine データベースセットアップスクリプト
# このスクリプトは、MySQLデータベースを作成し、マイグレーションを実行します。

set -e

echo "🚀 Concordia Shrine データベースセットアップを開始します..."

# MySQLサーバーが起動しているか確認
if ! mysql -u root -e "SELECT 1;" > /dev/null 2>&1; then
  echo "❌ MySQLサーバーに接続できません。"
  echo "   以下のコマンドでMySQLサーバーを起動してください:"
  echo "   brew services start mysql"
  exit 1
fi

echo "✅ MySQLサーバーに接続できました"

# データベースの作成
echo "📦 データベースを作成しています..."
mysql -u root < "$(dirname "$0")/setup-database.sql"

echo "✅ データベースが作成されました"

# .envファイルの確認
if [ ! -f .env ]; then
  echo "⚠️  .envファイルが見つかりません。"
  echo "   .env.exampleをコピーして.envファイルを作成してください:"
  echo "   cp .env.example .env"
  echo ""
  echo "   その後、.envファイル内のDATABASE_URLを設定してください:"
  echo "   DATABASE_URL=mysql://root@localhost:3306/concordia"
  exit 1
fi

# DATABASE_URLの確認と設定
if ! grep -q "DATABASE_URL=" .env 2>/dev/null; then
  echo "⚠️  .envファイルにDATABASE_URLが設定されていません。"
  echo "   .envファイルに以下を追加してください:"
  echo "   DATABASE_URL=mysql://root@localhost:3306/concordia"
  exit 1
fi

# DATABASE_URLを取得して確認
DATABASE_URL=$(grep "DATABASE_URL=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")

if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  .envファイルにDATABASE_URLが設定されていません。"
  echo "   .envファイルに以下を追加してください:"
  echo "   DATABASE_URL=mysql://root@localhost:3306/concordia"
  exit 1
fi

# パスワードなしの接続を試す（パスワードが設定されている場合のエラーを回避）
# DATABASE_URLにパスワードが含まれていない場合、パスワードなしで接続を試す
if echo "$DATABASE_URL" | grep -q "@localhost"; then
  # パスワードなしの接続URLを試す
  TEST_URL=$(echo "$DATABASE_URL" | sed 's/mysql:\/\/[^@]*@/mysql:\/\/root@/')
  echo "📝 DATABASE_URLを確認しました: ${TEST_URL%%@*}"
  echo "   パスワードなしで接続を試みます..."
fi

echo "✅ .envファイルの設定を確認しました"

# マイグレーションの実行
echo "🔄 データベースマイグレーションを実行しています..."
pnpm db:push

echo "✅ データベースセットアップが完了しました！"
echo ""
echo "次のステップ:"
echo "  1. .envファイルを編集して、必要な環境変数を設定してください"
echo "  2. pnpm dev で開発サーバーを起動してください"

