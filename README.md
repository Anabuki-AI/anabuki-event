# Anabuki Event

Anabuki Event は、バックエンド・フロントエンド・ドキュメントを Git サブモジュールとして管理する親リポジトリです。

```text
anabuki-event/
├─ backend/       # Rails 8 API / PostgreSQL（Java backendの移行先）
├─ frontend/      # Nuxt 4 / Vue 3 / TypeScript
├─ docs/          # プロジェクトドキュメント
├─ .env.example   # プロジェクト全体の環境変数テンプレート
├─ .mise.toml      # ツールバージョンと開発タスク
└─ README.md
```

## サブモジュールの自動追従

`backend` または `frontend` の `main` へのpush後、各リポジトリのCIが成功すると、親リポジトリのサブモジュール参照を成功したコミットへ自動更新します。親リポジトリには `chore(submodules): ...` コミットが作成されます。

初回設定として、`backend` と `frontend` の両リポジトリで、Actions secret `PARENT_REPOSITORY_TOKEN` を登録してください。これは `Anabuki-AI/anabuki-event` に対して **Contents: Read and write** 権限を持つfine-grained personal access token、または同等のGitHub Appトークンです。トークンは親リポジトリだけを対象にし、子リポジトリへの権限は不要です。

親リポジトリのSettings → Actions → Generalでは、ワークフローに対する **Read and write permissions** を許可してください。`backend` と `frontend` が同時に更新された場合も、親側ワークフローが順番に処理します。すでに新しいコミットが `main` にある場合、古いCI結果は反映せず、最新コミットのCI成功通知を待ちます。

## Clone

新しく取得する場合は、サブモジュールも同時にcloneします。

```bash
git clone --recurse-submodules https://github.com/Anabuki-AI/anabuki-event.git
cd anabuki-event
```

すでに親リポジトリをclone済みの場合は、次のコマンドでサブモジュールを取得します。

```bash
git submodule update --init --recursive
```

## 必要なソフトウェア

- Git
- [mise](https://mise.jdx.dev/installing-mise.html)
- Docker Desktop

Ruby、Node.js、pnpmはmiseがプロジェクトに必要なバージョンをインストールします。OSへ個別にインストールする必要はありません。

| ツール | バージョン |
| --- | --- |
| Ruby | 3.4.7 |
| Node.js | 22.19.0 |
| pnpm | 10.15.0 |
| PostgreSQL | 16（Docker） |

### Windowsへのmiseインストール

PowerShellではScoopの利用を推奨します。

```powershell
scoop install mise
Add-Content $PROFILE '(&mise activate pwsh) | Out-String | Invoke-Expression'
. $PROFILE
```

Scoopを利用しない場合はwingetでもインストールできます。

```powershell
winget install jdx.mise
```

インストール後、問題がある場合は診断コマンドを実行してください。

```powershell
mise doctor
```

Nuxtの初回セットアップ時に匿名テレメトリへの参加確認が表示される場合があります。これはNuxt自身の確認であり、参加するかどうかは任意です。

## 環境変数

DB接続などのローカル設定に加えて、外部公開URLとOAuth callback URLも、`backend/` や `frontend/` ではなく、**親プロジェクト直下の `.env` で一元管理**します。これらの値はブラウザの生成元・リダイレクトURIと環境全体で一致させます。

```text
anabuki-event/
├─ .env.example   # Git管理するテンプレート
└─ .env           # 各開発者のローカル設定（Git管理しない）
```

通常は後述の `mise run setup` が、初回のみ `.env.example` を `.env` へコピーします。セットアップ前に値を編集したい場合は、手動でも作成できます。

### PowerShell

```powershell
Copy-Item .env.example .env
```

### Bash / Git Bash

```bash
cp .env.example .env
```

`.mise.toml` がルートの `.env` を読み込み、mise経由で起動するバックエンド、Docker Compose、Nuxtへ環境変数を渡します。`backend/.env` と `frontend/.env` は作成しません。

| 環境変数 | デフォルト値 | 用途 |
| --- | --- | --- |
| `POSTGRES_USER` | `anabuki` | PostgreSQLユーザー |
| `POSTGRES_PASSWORD` | `anabuki` | PostgreSQLパスワード |
| `POSTGRES_HOST` / `POSTGRES_PORT` | `localhost` / `5433` | Rails専用PostgreSQLの接続先 |
| `DATABASE_URL` | `postgresql://…/anabuki_event_rails_development` | Rails APIのDB接続先（Java DBとは別） |
| `RAILS_MAX_THREADS` | `5` | RailsのDBコネクションプール上限 |
| `PORT` | `8080` | バックエンドのHTTPポート |
| `NUXT_BACKEND_BASE_URL` | `http://localhost:8080` | Nuxtから参照するバックエンドURL |
| `NUXT_PUBLIC_API_BASE` | `/api` | ブラウザ側のAPIベースパス |

公開URLとGoogle OAuthのブラウザ/コールバック境界も、`.env` で管理します。Googleのclient secretはバックエンドだけで使用し、Gitへ記録しません。

| 環境変数 | 開発値 | 用途 |
| --- | --- | --- |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | 外部公開する一般フロントエンドの基準URL |
| `ADMIN_FRONTEND_URL` | `http://localhost:3000/admin` | 管理者フロントエンドのURL |
| `GOOGLE_OAUTH_CALLBACK_URL` | `http://localhost:8080/api/auth/google/callback` | Google OAuth callback URL |

公開URLの3変数は `.env` で管理し、`.env.example` にも非秘密の開発値を記載します。

> **DB保護:** Rails は `anabuki_event_rails_*` と `rails-postgres-data` を使用します。Java/Flyway の `anabuki_event` DB・volumeや本番DBをこの移行ブランチの `db:reset`・migration対象にしません。既存本番データの移行は、承認済みバックアップ、dry-run、照合を含む別手順として実施してください。

### 本番相当のURLへ切り替える場合

ルート `.env` の公開URL設定を、次のように対象環境のFQDNへ変更します。

1. `PUBLIC_BASE_URL` を一般公開フロントエンドのFQDNへ変更する。
2. `ADMIN_FRONTEND_URL` を管理者フロントエンドのFQDN（または管理者パス）へ変更する。
3. `GOOGLE_OAUTH_CALLBACK_URL` をOAuth実装が受け付けるcallback endpointのFQDNへ変更する。
4. Google Cloud Consoleの承認済みJavaScript生成元と承認済みリダイレクトURIを、上記の実際のscheme・host・pathと完全一致させる。

miseはルート `.env` を読み込むため、これらの値もmise経由で起動する各サービスへ渡されます。本番値をローカル設定へ残さないよう、環境ごとに `.env` を設定してください。
`.env` には認証情報などが入る可能性があるため、コミットしないでください。共有する変数を追加した場合は、値を安全なサンプルにしたうえで `.env.example` も更新します。

## 初回セットアップ

プロジェクトルートで実行します。

```powershell
git submodule update --init --recursive
mise trust
mise install
mise run setup
```

`mise run setup` は、ルート `.env` が存在しない場合に `.env.example` から作成し、`pnpm-lock.yaml` に従ってフロントエンドの依存関係をインストールします。既存の `.env` は上書きしません。

## 開発起動

最初にDocker Desktopを起動し、画面上でEngineの起動が完了するまで待ってください。その後、バックエンドとPostgreSQLをDockerで起動し、Nuxt開発サーバーを起動します。

```powershell
mise run dev
```

`mise run dev` は最初にルート `.env` の存在を確認し、存在しなければ `.env.example` から作成します。その後、Docker Engineを確認し、ルート `.env` を明示的に指定してDocker ComposeとNuxtを起動します。フロントエンド依存関係が未インストールの場合だけ、先に `mise run setup` を実行してください。

開発サーバー実行中に `Ctrl+C` を押すと、Nuxtを終了してから `docker compose down` を実行し、バックエンドとPostgreSQLも停止します。Nuxtがエラー終了した場合も同じクリーンアップを行います。

通常は次のURLを使用します。

- フロントエンド: `http://localhost:3000`
- バックエンド: `http://localhost:8080`
- ヘルスチェック: `http://localhost:8080/health`

終了後、Dockerサービスを停止します。

```powershell
mise run stop
```

## 管理者Google OAuth・承認フロー

Google OAuth成功後、env allowlistに一致するGoogle identityは`ENVIRONMENT_ACCESS`、`admin_identities.admin_enabled=true`でGoogle `sub`が固定されたidentityは`MANAGEMENT_ACCESS`、それ以外の本人確認済みidentityは短時間の`APPLICANT`になります。`admin_identities`はGoogle identityと管理ページ利用許可の保存先であり、既存一般ユーザーとは統合しません。APPLICANTはメールやsubをリクエスト本文へ送らず、サーバー側一時セッションから自分の申請を作成できます。MANAGEMENT_ACCESSとENVIRONMENT_ACCESSは承認待ち申請を承認または却下し、承認時は対象Google identityへ管理ページ利用許可を付与します。

APPLICANTは承認をポーリングし、バックエンドの一回限りexchange APIで一時Cookieを失効させて8時間の管理ページ利用Cookieへ交換します。申請は作成元のA用一時セッションと端末単位で紐付き、申請期限も20分です。セッションの期限切れ・ログアウト・失効時はPENDING申請をCANCELLEDとして履歴に残し、B/Cの通常一覧から除外します。管理ページ利用許可を持つBは申請を承認・却下できますが、他者の利用許可を解除できません。env allowlist由来のCは同じ承認権限に加えてBの管理ページ利用許可を解除できます。Cの環境設定は管理画面/APIから変更できず、毎リクエスト現在値を再評価します。

## 主なコマンド

### プロジェクト全体

| コマンド | 内容 |
| --- | --- |
| `mise tasks` | 利用可能な全タスクを表示 |
| `mise run setup` | ルート `.env` を初期作成し、フロントエンド依存関係をインストール |
| `mise run dev` | Dockerバックエンド・DBとNuxtを開発起動 |
| `mise run stop` | Dockerサービスを停止 |
| `mise run logs` | Dockerログを追跡表示 |
| `mise run test` | バックエンドとフロントエンドのテストを実行 |
| `mise run check` | backend testとfrontend lint・型検査・testを実行 |
| `mise run build` | バックエンドとフロントエンドをビルド |
| `mise run ci` | 全チェック後に全ビルドを実行 |

### バックエンド

| コマンド | 内容 |
| --- | --- |
| `mise run backend:dev` | Rails APIとRails専用PostgreSQLをDockerで前面起動 |
| `mise run backend:run` | Rails専用PostgreSQLをDocker、APIをローカルRubyで起動 |
| `mise run backend:test` | Railsテストを実行 |
| `mise run backend:build` | Rails eager loading・routesを検証 |

### フロントエンド

| コマンド | 内容 |
| --- | --- |
| `mise run frontend:install` | lockfileに従って依存関係をインストール |
| `mise run frontend:dev` | Nuxt開発サーバーを起動 |
| `mise run frontend:lint` | ESLintを実行 |
| `mise run frontend:typecheck` | TypeScript / Vueの型検査を実行 |
| `mise run frontend:test` | Vitestを実行 |
| `mise run frontend:check` | lint・型検査・テストを順番に実行 |
| `mise run frontend:build` | Nuxtの本番ビルドを作成 |

### データベース

| コマンド | 内容 |
| --- | --- |
| `mise run db:up` | PostgreSQLだけをバックグラウンド起動 |
| `mise run db:down` | Composeサービスを停止し、DBデータは保持 |
| `mise run db:reset` | DBボリュームを削除してPostgreSQLを再作成 |

`mise run db:reset` はローカルDBの全データを削除するため、実行前に確認が表示されます。

## miseをシェルへactivateしない場合

シェルactivateを設定していなくても、`mise run` と `mise exec` は必要なツールとルート `.env` を読み込んで実行します。

```powershell
mise run check
mise exec -- java -version
mise exec -- node --version
```

### 端末ごとのセッション

`admin_identities`がGoogle identityと管理ページ利用許可（`admin_enabled`）の本体です。旧V2〜V4の`admin_users`/`admin_sessions`はV5で安全に移行します。sub付きの既存許可はUUID identityへ引き継ぎ、旧セッションは端末hashを復元できないため破棄して再ログインを要求します。

認証Cookieはブラウザプロファイル単位のランダム`admin_device_id`とログインごとのランダム`admin_session`または短期`admin_applicant_session`です。物理端末ID・MAC・fingerprintは利用せず、DBにはdevice/session両方のSHA-256だけを保存します。同じ人物の複数端末は同時に利用でき、申請は作成元セッションのdevice hash・session key hash・session UUIDを照合して延命を防ぎます。同じブラウザの再ログインはsession keyをローテーションし、旧A申請を失効させます。端末一覧、ハッシュ、セッション行は管理UIへ表示しません。

## RailsバックエンドのRSpec・Que・Sentry

RailsバックエンドはRSpecへ移行し、`mise run backend:test` がPostgreSQL上で `rails db:create db:migrate` と `bundle exec rspec` を実行します。`mise run backend:build` はRails eager loadingとroutesを検証します。

Active JobはRedisではなくPostgreSQL-backed Queを利用します。`mise run backend:dev` はComposeの `postgres`、`db-prepare`、Rails API、Que workerを順に起動します。ローカルRubyでworkerだけを起動する場合は `mise run backend:worker` を使います。workerのキューは `QUE_WORKER_COUNT` で調整できます。

Sentryは `SENTRY_DSN`、`SENTRY_ENVIRONMENT`、`SENTRY_RELEASE`、`SENTRY_ENABLED_ENVIRONMENTS` で設定します。開発/test環境は送信しない設定で、実DSNはsecret storeまたはCI secretにだけ設定してください。cookie、authorization/token、password、credential、email等はRailsログとSentryイベントから収集しない構成です。
