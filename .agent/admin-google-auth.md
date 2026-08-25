# Google identity・端末単位セッション設計

## 確定モデル

| 区分 | 判定元 | permissions | 許可範囲 |
| --- | --- | --- | --- |
| A / `APPLICANT` | Google本人確認済み、allowlist外、`admin_enabled=false` | 申請関連のみ | 自分の申請、状態確認、exchange、ログアウト |
| B / `MANAGEMENT_ACCESS` | Google `sub`と`admin_identities`が一致し`admin_enabled=true` | `MANAGEMENT_PAGE_VIEW`, `ACCESS_REQUEST_APPROVE` | 管理ページ、申請の承認/却下。Bは他者の解除不可 |
| C / `ENVIRONMENT_ACCESS` | リクエスト時の`ADMIN_EMAIL_ALLOWLIST`へ現在一致 | B + `MANAGEMENT_ACCESS_REVOKE` | Bの操作に加えてBの利用許可解除 |

CはDBの`admin_enabled`を根拠にしない。毎リクエスト環境値を再読込し、C > B > Aの順に再評価する。B/CはAを承認可能、CのみBを解除可能であり、Bは独立ロールではない。

## 永続化

- `admin_identities`: UUID固定のGoogle identity本体。`google_sub`、email、`admin_enabled`、`granted_by`、`granted_at`、`revoked_at`を保持する。
- `admin_device_sessions`：履歴ログではなく有効状態。`device_id_hash`に一意制約を置き、1 identity・1ブラウザプロファイルの有効行をupsertする。session key/device keyはSHA-256ハッシュのみ保存し、`last_seen_at`をリクエストごとに更新する。
- Aの一時セッションも同じ端末状態行で管理し、承認exchangeはその行を同一トランザクションでsession key/sourceごと置換する。DBには無制限のログイン履歴を残さない。
- `admin_access_requests`は承認フローの業務履歴として維持し、申請のpending重複制約を維持する。

## V5移行方針

V2〜V4は変更しない。V5で次を行う。

1. `admin_identities`を作成し、既存`admin_users`のうちGoogle subがある行をUUID identityへコピー。既存active=trueは`admin_enabled=true`として継承する。`granted_by`は旧スキーマに根拠がないためNULL、`granted_at`は旧作成日時を利用する。
2. Google subがない旧行は安全に推測できないため移行せず、次回Googleログイン後に申請/承認を要求する。
3. `admin_access_requests`に承認者identity UUID列を追加する。
4. 旧`admin_sessions`はdevice hashがなく、既存opaque hashを平文へ戻せないため、新セッションへ移行せず`DROP`する。全利用者に安全な再ログインを要求する。旧`admin_users`もidentity移行後に削除し、参照整合性を切断しない順序で旧セッションを先に削除する。
5. `admin_device_sessions`を作成し、device hash/session key hash各32 bytes、source、期限、last seen、revocation、device labelを保持する。device hash一意制約でupsertする。

旧DBにおけるallowlist相当者は、現在の環境値と一致する間だけCとして扱う。V5でDB grantへ特別なC根拠を作らない。allowlistから外れた場合は、移行された`admin_enabled`がtrueならB、falseならAとして再評価する。

## Cookieとセキュリティ境界

- `admin_device_id`: ブラウザプロファイルごとのランダム32 byte IDをbase64url化。長期Cookie、HttpOnly、HTTPS時Secure、SameSite=Lax。
- `admin_session`: B/Cのログインごとに新規ランダム秘密キー。8時間。
- `admin_applicant_session`: Aの一時ランダム秘密キー。20分。
- 端末IDだけでは認証せず、必ずdevice hashとsession key hashの両方をDB照合する。Cookie削除、シークレット、別ブラウザは別端末扱い。物理端末ID/MAC/fingerprintは使わない。
- 同じidentityの複数PC/スマホは同時に有効。同じブラウザプロファイルの再ログインはdevice行をupsertし、旧session keyを無効化する。ログアウトは現在端末だけを失効する。Cによる解除は対象identityの全device行を即時失効する。
- OAuth state/nonce、Google ID tokenの署名・iss・aud・exp・email_verified・sub照合、Origin検査、HttpOnly/Secure/SameSite、未設定OAuthの503安全失敗を維持する。

## API/UI境界

APIのstatus/session responseと許可一覧はemail、source、activeのみを返す。identity UUID、device ID、ハッシュ、session行はUIに返さない。端末一覧UI・通知は実装しない。APIの解除URLだけUUIDを受け取る。

## 確認コマンドと未確認事項

実行済み:

- `mise exec -- mvn -B test`（backend）
- `pnpm install --frozen-lockfile`（frontend、Node 20のためengine warning）

未確認:

- frontend lint/typecheck/test/build（rolldownのWindows native optional binding欠落でNuxt prepareが停止）
- PostgreSQL実環境でのV5適用、既存データコピー、同時upsert/承認/exchange
- 実Google OAuth callbackと複数ブラウザCookie、Docker Desktop、本番HTTPS終端のE2E
- 秘密情報を生成、表示、記録、コミットしていない
