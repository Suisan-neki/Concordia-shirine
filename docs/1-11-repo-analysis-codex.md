# 1/11 リポジトリ解析 Codex

このドキュメントは、今回の一連の修正内容と、その背景（なぜそのままだと問題だったか）を整理したものです。

## 1. セキュリティスコアの計算と保存

### 変更点
- クライアントのスコア計算が100を超える問題を修正。
- スコアの最終計算をサーバー側に移し、クライアントからの入力を受け取らないように変更。
- サーバー計算したスコアをレスポンスで返し、UIはその値を優先。
- 保存失敗時はスコア表示を行わず、「保存失敗しました」を表示。

### なぜ問題だったか
- 元の計算は `*100` が重複しており、100を超えてAPIのバリデーションに引っかかるため、保存が失敗していた。
- クライアント計算をそのまま保存すると、改ざん耐性がなく、信頼できる指標にならない。
- 保存失敗時にローカルスコアを表示すると、実際の保存結果と乖離してユーザーが誤認する可能性がある。

## 2. Cookie設定とCSRF対策

### 変更点
- Cookieの`SameSite`をデフォルト`lax`に変更し、`none`指定時でもHTTPSでなければ`lax`にフォールバック。
- 状態変更リクエスト（POST/PUT/PATCH/DELETE）に対して、`Origin`チェックを追加。
- `ALLOWED_ORIGINS`と`COOKIE_SAMESITE`の環境変数を追加。

### なぜ問題だったか
- `SameSite=None`をHTTPで使うと、多くのブラウザがCookie自体を無視するため、認証が不安定になる。
- `SameSite=None`はクロスサイト送信を許すので、CSRF対策なしではセッションが悪用されるリスクがある。
- Originチェックがないと、クロスサイトのPOSTが通ってしまう可能性がある。

## 3. API URLフォールバック

### 変更点
- `VITE_API_URL`未設定時に`/api/trpc`へ正しくフォールバックするよう修正。

### なぜ問題だったか
- 文字列テンプレート内で`undefined/trpc`になり、APIが呼べずクライアントが常に失敗する。

## 4. 認証フロー（Cognito前提）

### 変更点
- Cognito Hosted UIから`id_token`を受け取り、ローカル保存してAPIリクエストに`Authorization: Bearer`で付与。
- サーバー側でCognitoのJWKSを使い`id_token`を検証し、`ctx.user`を構築。
- 旧OAuth callbackは`OAUTH_SERVER_URL`が設定されている場合のみ読み込むよう整理。
- 追加の環境変数: `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_JWKS_URL`。

### なぜ問題だったか
- クライアントはCognitoのImplicit Grantで`/`に戻る一方、サーバーは`/api/oauth/callback`前提だったため認証が成立しなかった。
- サーバー側はCookieベースで独自JWTを検証しており、Cognitoのトークンとは不整合だった。
- `id_token`をサーバーで検証しないと、真正性を担保できない。

## 5. 追加の注意事項

- サブドメイン分離構成（`app.example.com`と`api.example.com`等）の場合は、`ALLOWED_ORIGINS`の設定が必須。
- 本番環境では`COOKIE_SAMESITE=none`を使う場合、必ずHTTPSで運用する必要がある。

