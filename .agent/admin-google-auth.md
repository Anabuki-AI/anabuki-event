# 管理者Google OAuth・承認フロー実装メモ

## 確定した権限

| ロール | 判定元 | 許可範囲 |
| --- | --- | --- |
| `APPLICANT` | Google ID token本人確認済み、env/active DB管理者ではない | 自分の申請作成・状態確認・ログアウトのみ |
| `DB_ADMIN` | `admin_users.active = true`、保存済みGoogle `sub`一致 | 管理画面、申請の承認/却下。削除APIなし |
| `ENV_ADMIN` | `ADMIN_EMAIL_ALLOWLIST`の現在値 | 管理画面、申請の承認/却下、DB管理者の無効化 |

env allowlist判定を毎リクエスト先に行い、envとDBの両方に該当する場合は`ENV_ADMIN`を優先する。envからメールが消えた場合は、同一セッションに保持されたDB管理者IDとGoogle `sub`を再評価する。

## API

- `GET /api/auth/google/status`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/admin/auth/session` — A/B/Cの現在ロールを返す
- `POST /api/admin/auth/logout`
- `POST /api/admin/auth/exchange` — Aの承認済み一時セッションを一回限りBへ交換
- `GET /api/admin/access-request` — A自身の最新申請
- `POST /api/admin/access-request` — bodyなし。メール/subは一時Cookieから取得
- `GET /api/admin/access-requests` — B/Cのみ、承認待ち一覧
- `POST /api/admin/access-requests/{requestId}/approve`
- `POST /api/admin/access-requests/{requestId}/reject`
- `GET /api/admin/allowed-emails` — CのメールとDB管理者の一覧。Cと重なるDB行は除外
- `DELETE /api/admin/allowed-emails/{adminId}` — Cのみ。DB管理者と全セッションを即時失効

状態変更APIでは、存在する`Origin`が`PUBLIC_BASE_URL`または`ADMIN_FRONTEND_URL`と同一originかをバックエンドで検査する。

## DB migration

- `V2__create_admin_auth.sql`: 既存の管理者、セッション、OAuth state
- `V3__add_applicant_flow.sql`:
  - `admin_sessions.session_type`を追加し、A/B/CのCookie/TTL境界をDBでも分離
  - `admin_access_requests`を追加
  - applicant Google `sub`のpending重複を部分ユニーク制約で防止
  - 承認者/却下者のメール・sub・日時を保存

一時Cookieは`admin_applicant_session`、20分。管理Cookieは`admin_session`、8時間。双方ともDBにはSHA-256ハッシュのみ保存し、HttpOnly/SameSite=Lax、HTTPS時のみSecureを維持する。

## 確認済みコマンド

- `mise exec -- mvn -B -f backend/pom.xml test`
- `mise exec -- pnpm --dir frontend install --frozen-lockfile`
- `mise exec -- pnpm --dir frontend lint`
- `mise exec -- pnpm --dir frontend typecheck`
- `mise exec -- pnpm --dir frontend test`

## 未確認事項

- 実Google Cloud Console資格情報を使ったOAuth callback・署名鍵ローテーション・ブラウザE2E
- PostgreSQL実環境でのFlyway V3適用、同時承認競合、セッション交換のDB統合テスト
- Docker Desktop、本番リバースプロキシ、HTTPS終端、Cookie属性の実機確認

資格情報・秘密値は生成、表示、記録、コミットしていない。
