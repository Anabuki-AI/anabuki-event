# 管理者Google OAuth実装メモ

## 実装範囲

- Google Authorization Code Flowをバックエンドだけで実施。
- `state`をDBへSHA-256ハッシュで保存し、HttpOnlyの一時Cookieと照合して一度だけ消費する。`nonce`にも同じランダム値を使い、ID tokenで照合する。
- Googleライブラリの`GoogleIdTokenVerifier`で署名・有効期限・issuer・audienceを検証し、コード側でも`iss`、`aud`、`exp`、`email_verified`、`sub`、`nonce`を確認する。
- 許可判定は`ADMIN_EMAIL_ALLOWLIST`（個別メールのみ）と`admin_users.active`の和集合。Google Workspaceドメイン指定は受け付けない。
- CookieにはJWTを入れず、32バイト乱数のIDだけを保存。DBにはそのSHA-256ハッシュを保存し、セッションもDB側の有効性を毎回確認する。
- DB管理者を無効化すると、トランザクション内で関連セッションを失効する。セッション照会もactive DB管理者とのJOINを要求するため、即時反映される。
- envのみの管理者はDB管理者IDなしのセッションとして利用できる。UIには環境変数由来として表示し、UIから無効化しない。
- `SESSION_SECRET`/`AUTH_TOKEN_SECRET`は使用しない。セッションIDはサーバー側でハッシュ化して保存するため、署名用秘密値を増やしていない。
- Secure属性は`PUBLIC_BASE_URL`のschemeが`https`の場合だけ付け、ローカルHTTPでは付けない。CookieはHttpOnly、Path=/、SameSite=Lax。

## 主要ファイル

- `backend/src/main/java/xyz/adrianweb/admin/AdminAuthService.java`
- `backend/src/main/java/xyz/adrianweb/admin/JdbcAdminRepository.java`
- `backend/src/main/java/xyz/adrianweb/routes/AdminRoutes.java`
- `backend/src/main/resources/db/migration/V2__create_admin_auth.sql`
- `frontend/app/pages/admin/index.vue`
- `frontend/app/features/admin-auth/components/AdminGoogleLoginPanel.vue`
- `backend/docker-compose.yml`

## 確認済みコマンド

- `mise exec -- mvn -B -f backend/pom.xml test`
- `mise exec -- pnpm --dir frontend lint`
- `mise exec -- pnpm --dir frontend typecheck`
- `mise exec -- pnpm --dir frontend test`
- `mise exec -- pnpm --dir frontend build`
- `mise exec -- mvn -B -f backend/pom.xml -DskipTests package`（最終確認で実行する）

## 未確認事項

- 実Google Cloud Console資格情報を設定した手動ログイン。
- Googleからの実Authorization Code、署名鍵ローテーション、許可済み/未許可メールでのブラウザE2E。
- 本番リバースプロキシ配下でのCookieドメイン・HTTPS終端・NuxtからAPIへの同一オリジン構成。
- Docker Desktop上でのPostgreSQL起動、Flyway V2適用、バックエンドコンテナへの全OAuth環境変数の実渡し。

資格情報やローカル`.env`の値は記録・コミットしない。
