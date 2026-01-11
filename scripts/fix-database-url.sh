#!/bin/bash
# DATABASE_URLを修正するスクリプト
# パスワードなしの接続URLに変更します

set -e

if [ ! -f .env ]; then
  echo "❌ .envファイルが見つかりません。"
  exit 1
fi

# 現在のDATABASE_URLを確認
CURRENT_URL=$(grep "DATABASE_URL=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")

if [ -z "$CURRENT_URL" ]; then
  echo "⚠️  .envファイルにDATABASE_URLが設定されていません。"
  echo "   以下を追加します:"
  echo "   DATABASE_URL=mysql://root@localhost:3306/concordia"
  
  # .envファイルに追加
  echo "" >> .env
  echo "DATABASE_URL=mysql://root@localhost:3306/concordia" >> .env
  echo "✅ DATABASE_URLを追加しました"
else
  echo "📝 現在のDATABASE_URL: $CURRENT_URL"
  
  # パスワードなしのURLに変更
  NEW_URL="mysql://root@localhost:3306/concordia"
  
  # .envファイルを更新
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=$NEW_URL|" .env
  else
    # Linux
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=$NEW_URL|" .env
  fi
  
  echo "✅ DATABASE_URLを更新しました: $NEW_URL"
fi

echo ""
echo "次のステップ:"
echo "  pnpm db:push でマイグレーションを再実行してください"

