# Google identity と管理ページ利用許可

## 確定したアクセスモデル

| 区分 | 判定元 | permissions | 許可範囲 |
| --- | --- | --- | --- |
| A / `APPLICANT` | Google本人確認済みで、env allowlistにもactiveな保存済み許可にも該当しない | なし（申請関連APIのみ） | 自分の申請作成・状態確認・ログアウト |
| B / `MANAGEMENT_ACCESS` | Google `sub`とactiveな`admin_users`行が一致 | `MANAGEMENT_PAGE_VIEW`, `ACCESS_REQUEST_APPROVE` | 管理ページ、申請の承認/却下。他者の利用許可解除は不可 |
| C / `ENVIRONMENT_ACCESS` | `ADMIN_EMAIL_ALLOWLIST`の現在値に一致 | Bのpermissions + `MANAGEMENT_ACCESS_REVOKE` | 管理ページ、申請の承認/却下、Bの管理ページ利用許可解除 |

Bは独立した保存先由来のロールではない。B/C/AはいずれもGoogle本人確認済みidentityであり、違いはGoogle identityに対する管理ページ利用許可の判定とcapabilityだけである。既存の一般ユーザー（`app_users`）とは統合しない。

permissionsはセッションに保存された値を信頼せず、Google identity、env allowlist、`admin_users.active`、保存済みGoogle `sub`をサーバーが毎リクエスト再評価して算出する。env allowlistに一致するidentityは保存済み行の有無にかかわらずCとして優先される。envからメールが消えた場合は、保存済みGoogle `sub`とactive状態を再評価する。

## API

- `GET /api/auth/google/status`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/admin/auth/session` — `accessSource`（`APPLICANT` / `MANAGEMENT_ACCESS` / `ENVIRONMENT_ACCESS`）と明示的`permissions`を返す。`role`は返さない
- `POST /api/admin/auth/logout`
- `POST /api/admin/auth/exchange` — Aの承認済み一時セッションを一回限り管理ページ利用セッションへ交換
- `GET /api/admin/access-request` — A自身の最新申請
- `POST /api/admin/access-request` — bodyなし。メール/subは一時Cookieから取得
- `GET /api/admin/access-requests` — `ACCESS_REQUEST_APPROVE`を持つidentityのみ、承認待ち一覧
- `POST /api/admin/access-requests/{requestId}/approve`
- `POST /api/admin/access-requests/{requestId}/reject`
- `GET /api/admin/allowed-emails` — Cの環境設定と保存済み管理ページ利用許可の一覧
- `DELETE /api/admin/allowed-emails/{adminId}` — `MANAGEMENT_ACCESS_REVOKE`を持つCのみ。対象Bの全セッションを即時失効

状態変更APIでは、存在する`Origin`が`PUBLIC_BASE_URL`または`ADMIN_FRONTEND_URL`と同一originかをバックエンドで検査する。

## DB migration

- `V2__create_admin_auth.sql`: 既存の管理ページ利用許可保存先、セッション、OAuth state
- `V3__add_applicant_flow.sql`: A/B/Cのセッション分離、申請テーブル、pending重複制約、承認者情報
- `V4__rename_management_access_sources.sql`: V3の歴史的なセッション値を`MANAGEMENT_ACCESS` / `ENVIRONMENT_ACCESS`へ安全に更新し、新しいcheck制約を適用。既存データは削除しない

テーブル物理名`admin_users`は互換性のため維持するが、意味は管理ページ利用許可の保存先である。`app_users`とは別系統である。

一時Cookieは`admin_applicant_session`、20分。管理ページ利用Cookieは`admin_session`、8時間。双方ともDBにはSHA-256ハッシュのみ保存し、HttpOnly/SameSite=Lax、HTTPS時のみSecureを維持する。

## 確認済みコマンド

- `mise exec -- mvn -B -f backend/pom.xml test`
- `mise exec -- pnpm --dir frontend install --frozen-lockfile`
- `mise exec -- pnpm --dir frontend lint`
- `mise exec -- pnpm --dir frontend typecheck`
- `mise exec -- pnpm --dir frontend test`

## 未確認事項

- 実Google Cloud Console資格情報を使ったOAuth callback・署名鍵ローテーション・ブラウザE2E
- PostgreSQL実環境でのFlyway V4適用、同時承認競合、セッション交換のDB統合テスト
- Docker Desktop、本番リバースプロキシ、HTTPS終端、Cookie属性の実機確認

資格情報・秘密値は生成、表示、記録、コミットしていない。
