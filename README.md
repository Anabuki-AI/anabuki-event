# Anabuki Event

Anabuki Event は、バックエンド・フロントエンド・ドキュメントを Git サブモジュールとして管理する親リポジトリです。

```text
anabuki-event/
├─ backend/       # Java 25 / Javalin / PostgreSQL
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

Java、Maven、Node.js、pnpmはmiseがプロジェクトに必要なバージョンをインストールします。OSへ個別にインストールする必要はありません。

| ツール | バージョン |
| --- | --- |
| Java | Temurin 25 |
| Maven | 3.9.11 |
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

DB接続などのローカル設定は、`backend/` や `frontend/` ではなく、**親プロジェクト直下の `.env` で一元管理**します。外部公開URLとOAuth callback URLは、ブラウザの生成元・リダイレクトURIと環境全体で一致させるため、`.mise.toml` の `[env]` にあるグローバルURL設定で管理します。

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
| `JDBC_URL` | `jdbc:postgresql://localhost:5432/anabuki_event` | ローカルJava起動時のDB接続先 |
| `DB_POOL_SIZE` | `10` | バックエンドのDBコネクションプール数 |
| `PORT` | `8080` | バックエンドのHTTPポート |
| `NUXT_BACKEND_BASE_URL` | `http://localhost:8080` | Nuxtから参照するバックエンドURL |
| `NUXT_PUBLIC_API_BASE` | `/api` | ブラウザ側のAPIベースパス |

公開URLとGoogle OAuthのブラウザ/コールバック境界は、`.mise.toml` の `[env]` にあるグローバルURL設定で管理します。`.env` には重複して定義しません。OAuth自体の実装、API、DB設定はこの設定変更には含まれません。

| 環境変数 | 開発値 | 用途 |
| --- | --- | --- |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | 外部公開する一般フロントエンドの基準URL |
| `ADMIN_FRONTEND_URL` | `http://localhost:3000/admin` | 管理者フロントエンドのURL |
| `GOOGLE_OAUTH_CALLBACK_URL` | `http://localhost:8080/api/auth/google/callback` | 将来のGoogle OAuth callback URL（現時点では未実装） |

公開URLの3変数は `.mise.toml` が管理するため、`.env.example` には重複して記載しません。

### 本番相当のURLへ切り替える場合

`.mise.toml` の `[env]` にある「公開URL設定」ブロックだけを、次のように対象環境のFQDNへ変更します。

1. `PUBLIC_BASE_URL` を一般公開フロントエンドのFQDNへ変更する。
2. `ADMIN_FRONTEND_URL` を管理者フロントエンドのFQDN（または管理者パス）へ変更する。
3. `GOOGLE_OAUTH_CALLBACK_URL` をOAuth実装が受け付けるcallback endpointのFQDNへ変更する。
4. Google Cloud Consoleの承認済みJavaScript生成元と承認済みリダイレクトURIを、上記の実際のscheme・host・pathと完全一致させる。

`[env]` の値は、同名のローカル `.env` がある場合そちらで上書きされます。本番値を意図せずローカル設定へ残さないため、これら3変数を `.env` に追加しないでください。
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
| `mise run backend:dev` | バックエンドとPostgreSQLをDockerで前面起動 |
| `mise run backend:run` | PostgreSQLをDocker、APIをローカルJavaで起動 |
| `mise run backend:test` | Mavenテストを実行 |
| `mise run backend:build` | 実行可能JARを作成 |

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
