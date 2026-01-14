# Issue #26 対応内容

## 反映した内容
- Cognito 認証スタックの更新を既存設定に合わせ、フロントエンドの Import 依存を解除しました。
- DynamoDB のアプリ用テーブルを拡張し、セキュリティ監査ログ/セッション/セッションログ/介入設定を追加しました。
- `concordia-users-dev` 既存テーブルは保持しつつ、`id-index` 未整備時のフォールバック取得を追加しました。
- Step Functions 側のバケット通知を切り替え、Storage スタックの通知リソースを整理しました。
- CDK デプロイを通し、全スタックの更新を完了しました。

## デプロイ結果
- `ConcordiaAuth-dev` / `ConcordiaStorage-dev` / `ConcordiaLambda-dev` / `ConcordiaStepFunctions-dev` / `ConcordiaApi-dev` 更新完了
- `ConcordiaFrontend-dev` は変更なし

## 補足
- 既存の `concordia-users-dev` を保持したため、`cdk deploy --all -c useExistingTables=true` を使用しました。
- ユーザーID検索は `id-index` が無い場合でもスキャンで代替可能です。必要なら後で GSI を追加してください。
