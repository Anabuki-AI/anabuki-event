# UUID参加者登録への一本化

## 対象と方針

- 作業ブランチ: `feature/user-registration-api-frontend`
- Rails backend は同名ブランチ（backend PR #17）を更新する。
- frontend は同名ブランチに新しい参加登録フローを積み、既存PR #10と閉じたPR #29は変更しない。
- 参加者の識別子はPostgreSQL UUID、ブラウザの認証状態はRails発行のHttpOnly Cookieセッションだけとする。フロントエンドはトークン・IDを保存しない。

## 削除した旧実装

Railsの未マージ差分では、初期schema migrationから参加者向けの資格情報テーブルを除去し、旧APIを検証するspecと旧仕様の記述を削除した。参加者は `/api/participants`、`/api/participants/me`、`/api/participants/session` のみを使用する。

frontendでは旧登録feature、旧登録・待機・編集ルート、URL queryで表示名を渡す待機画面、及び成功を模倣する導線を削除した。`/participants/new` は参加者を作成し、`/participants/waiting` はCookieを付けた `/participants/me` の結果だけで表示する。

## 意図的に残す参照

管理者・運営者のGoogle OAuth、メールアドレスallowlist、管理者・運営者のセッション、およびDB接続・ログフィルタの資格情報に関する参照は、参加者認証ではないため維持する。プロジェクト直下の旧Java backendにも旧参加者登録実装が残るが、これはこの親ブランチが参照しない旧submodule checkoutであり、Rails backend PR #17の変更対象外として識別した。

## 検証

frontendはNode 22.19.0 / pnpm 10.15.0でlint、typecheck、unit test、production buildを実行する。RailsのローカルRubyとDocker daemonが利用不能な場合は、RSpec・RuboCop・Zeitwerk・Brakemanの実行不能理由を作業報告に記録する。
