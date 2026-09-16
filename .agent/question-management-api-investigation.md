# 問題管理 API 実装に向けた調査記録

調査対象: `C:/Users/yuzum/Desktop/anabuki/anabuki-event/.worktree/feature/question-management-api`
調査時点の親リポジトリ HEAD: `719e093dc04dcc41b4015edbd23e75d01d9f31a7`

> この記録は調査のみを目的とする。コード、設定、サブモジュール参照、Git 参照は変更していない。

## 1. 作業場所・ブランチと main 更新時の注意

- 対象 worktree は `feature/question-management-api` ブランチであり、HEAD は `719e093` である。
- このコミットは `origin/main` と同一である。従って、作業ブランチは **`origin/main` の `719e093` を基点**としている。
- 親リポジトリ直下の `main` worktree は別の場所（`C:/Users/yuzum/Desktop/anabuki/anabuki-event`）にあり、ローカル `main` は `33ba30b`、追跡先 `origin/main` に対して **ahead 14 / behind 10** で分岐している。
- よって、直下のローカル `main` を「最新の main」と見なしたり、そこから submodule を更新したりしない。作業開始時に必要な基点は `origin/main` を明示して確認する。
- 親リポジトリには機能ブランチを作らず、実装時の変更・PR は `backend` / `frontend` 各サブモジュールのリポジトリに作成する。各サブモジュールの main への反映成功後、親リポジトリの submodule 参照は自動更新される運用である。
- main に未マージの変更は 0 ベースで扱う。今回の実装開始前に親・子リポジトリ双方の基点を再確認し、未マージ履歴への互換コードは追加しない。

## 2. 固定されているサブモジュール

親リポジトリの `719e093` が指す submodule は次の固定コミットである。いずれも対象 worktree では detached HEAD である。

| サブモジュール | URL | 親リポジトリが固定するコミット | 補足 |
| --- | --- | --- | --- |
| `backend` | `Anabuki-AI/anabuki-event-backend-rails` | `d7b644dda5b9a0bfaf15d7c9719af0f885144219` | Rails backend。ローカル `backend` の `origin/main` は `99657e7` まで進んでいるが、親の固定先ではない。 |
| `frontend` | `Anabuki-AI/anabuki-event-frontend` | `ea1ed831b31e9f5a3fac89719b0fc8f1d383a87a` | Nuxt frontend。ローカル `frontend` の `origin/main` は `3ca3141` まで進んでいるが、親の固定先ではない。 |
| `docs` | `Anabuki-AI/anabuki-event-docs` | `8e0bd9e31275335695603b3e9ba2b6130bee1b5b` | 今回の実装対象外。 |

以降の「現行」は、特記しない限りこの親リポジトリに固定された `backend@d7b644d` / `frontend@ea1ed83` を指す。

## 3. frontend PR #16（問題管理画面）の概要

問題管理に該当するのは frontend の PR #16 である。

- マージコミット: `b9476fb`（PR #16、`feature/admin-problem-management`）
- PR 題名: **「問題管理画面（一覧・追加・編集・自信度倍率変更）」**
- PR head: `f213f44985a81edb515cff04314ad39902fa59bd`
- 主な内容:
  - 問題一覧（`/event_operator/management`）
  - 問題の追加（`/admin/problems/new`）と編集（`/admin/problems/:id/edit`）
  - 4択、正解、問題文の入力・必須チェック
  - 全問題共通の「自信度あり / 普通 / なし」の倍率表示・変更モーダル
  - 折り畳み式の問題詳細、サイドバー、一覧内部スクロール
  - 画像表示用の `imageUrl` はあるが、追加時の画像アップロードは disabled の仮 UI

この PR は現在の親リポジトリ固定 frontend (`ea1ed83`) には含まれない。したがって、現行画面に PR #16 の実装があることを前提にせず、必要部分を現在の frontend 基点へ取り込む／再実装する必要がある。

なお backend にも PR #16（`ab8405f`、operator access request flow）が存在するが、問題管理 API を追加する PR ではない。番号だけで backend PR #16 と frontend PR #16 を混同しないこと。

## 4. 画面が要求する API contract

PR #16 の `app/features/problems/api/client.ts` で mock を無効化した場合に要求される contract は以下である。API base は frontend の `/api` であるため、実際の backend path は `/api/admin/...` となる。

### 問題

| 操作 | HTTP / path | 要求・応答 |
| --- | --- | --- |
| 一覧取得 | `GET /api/admin/questions` | `QuestionApiModel[]` を返す。 |
| 1件取得 | `GET /api/admin/questions/:id` | `QuestionApiModel` を返す。 |
| 作成 | `POST /api/admin/questions` | request body は `questionText`, `choiceA`, `choiceB`, `choiceC`, `choiceD`, `correctAnswer`。作成済み `QuestionApiModel` を返す。 |
| 更新 | `PUT /api/admin/questions/:id` | 作成と同じ body。更新済み `QuestionApiModel` を返す。 |

`QuestionApiModel` は次の形である。

```ts
{
  id: number
  questionText: string
  choiceA: string
  choiceB: string
  choiceC: string
  choiceD: string
  correctAnswer: 'A' | 'B' | 'C' | 'D'
  imageUrl?: string
}
```

画面側の制約は、問題文必須・最大 200 文字、各選択肢必須・最大 100 文字、正解は A〜D のいずれかである。backend でも同じ不変条件を検証し、422 のエラー本文を既存形式 `{ "error": "..." }` に揃えるべきである。存在しない ID は既存 `ApplicationController` の方針どおり 404 とする。

### 自信度倍率（全問題共通設定）

| 操作 | HTTP / path | 要求・応答 |
| --- | --- | --- |
| 現在値取得 | `GET /api/admin/confidence-multipliers` | `{ high: string, normal: string, low: string }` |
| 1段階更新 | `PATCH /api/admin/confidence-multipliers/:level` | body: `{ confidenceMultiplier: number }`。更新後の3段階すべてを同じ形で返す。 |

`:level` は `high` / `normal` / `low`。画面の想定範囲は 0〜9.99、小数第2位までで、既定表示値は `high: "2.00"`, `normal: "1.00"`, `low: "0.50"` である。永続化する数値型、レスポンスを数値にするか2桁文字列にするか、既定値の最終仕様は実装前に決める必要がある（現 PR の TypeScript contract は文字列を前提にしている）。

### 共通事項

- 問題管理画面は管理操作であるため、全 endpoint に既存の管理セッション認証・権限認可を適用する。未認証は 401、認可不足は既存 API と整合する 403 を返す。
- 変更系 endpoint は既存 controller と同じ origin 検証を通す。
- 現在の共通 client は `$fetch` を利用し、`toApiError` でエラーを正規化する。API のエラー JSON は既存の `{ error: string }` を維持する。
- 画像のアップロード、削除、画像 URL の生成を行う request は PR #16 の client には存在しない。`imageUrl` は表示のみで、画像機能の contract は未決定である。

## 5. 現行 backend / frontend とのギャップ

### backend (`d7b644d`)

- routes は health、Google 認証、管理者認証・アクセス申請・許可メール管理のみであり、`/api/admin/questions` と `/api/admin/confidence-multipliers` は存在しない。
- 問題、選択肢、正解、自信度倍率に対応する model、migration、controller、policy、request spec は存在しない。
- 旧 Javalin のユーザー登録 API は Rails 移行時に意図的に非公開になっている（`POST /api/users` は 404）。これは問題管理 API と独立して扱う。
- backend の取得済み `origin/main`（`99657e7`）には operator access flow と admin API status が追加されているが、問題管理 endpoint は確認できない。固定先との差分を取り込む場合でも、問題 API は新規実装が必要である。

### frontend (`ea1ed83`)

- 現行ページはホーム、ユーザー登録、待機、ニックネーム編集であり、`app/features/problems`、問題管理ページ、管理用スタイルは存在しない。
- 現行 `createUser()` はすでに存在しない `POST /api/users` を呼ぶため、問題管理とは別にユーザー登録画面と Rails backend の契約不整合がある。
- API proxy は `/api` を backend `http://localhost:8080` へ送る設定である。問題 API は同じ base を使用できる。
- PR #16 は問題 client に `const USE_MOCK = true` を固定している。画面の確認はできても、実 backend への通信、認証失敗、API バリデーション、永続化は確認できない。

## 6. 発見した UI / 画面実装上の問題

PR #16 の head (`f213f44`) を確認した結果、実装に着手する前に解消または方針決定すべき問題は次のとおりである。

1. **一覧へ戻る URL が実際の一覧 URL と一致しない。**
   一覧ページは `/event_operator/management` だが、追加・編集画面の「問題一覧へ戻る」とキャンセル処理は `/event_operator/problem-management` を参照している。この URL に対応する page は PR head に存在せず、戻る・キャンセルが 404 になる。
2. **サイドバーの複数リンク先が PR head に存在しない。**
   `/event_operator`、`/event_operator/voting-rate`、`/admin/quiz-control` は `app/pages` に対応 page が確認できない。表示するナビゲーションは実在する route に限定するか、各画面を同一リリースで提供する必要がある。
3. **`nuxt.config.ts` に `css` キーが二重にある。**
   PR #16 head は `css: ['~/assets/css/main.css', '~/assets/css/management.css']` の後に `css: ['~/assets/css/questionedit.css']` を重複定義している。JavaScript object では後者が前者を上書きするため、問題管理用 `management.css`（および基本 `main.css`）が読み込まれず、画面レイアウトが崩れる。設定は1つに統合する必要がある。
4. **実 API へ接続していない。**
   `USE_MOCK = true` のため、追加・更新・倍率変更はブラウザ内の配列だけを変更する。リロードで消え、認証・権限・通信失敗・backend の入力検証も確認できない。
5. **画像は利用者に見えるが操作できない仮機能である。**
   問題追加フォームには disabled の file input があり「準備中」と表示される。画像がリリース要件なら upload / storage / delete を含む API と編集時の UI を設計する。要件外なら、誤解を避けるため当面 UI を表示しない方針も検討する。
6. **保存成功後に一覧へ戻らない。**
   作成・更新成功後はフォームに成功メッセージを表示するだけで、一覧の再読込や遷移をしない。運営者の連続登録フローとして、成功後の遷移先（一覧へ戻る、同じフォームで続けて登録、明示的な戻る導線）を決める必要がある。

## 7. 推奨実装順

1. **仕様と責務を確定する。** 問題の公開・編集権限、削除の要否、問題数の上限、問題文・選択肢の文字数、画像、倍率の意味・型・既定値を決める。
2. **backend のデータモデルと migration を作る。** 問題本体と4択・正解をどう正規化するか、全問題共通の倍率をどこへ永続化するかを確定する。未マージ変更は 0 ベースで整理する。
3. **backend の認可付き API と request spec を先に完成させる。** 一覧・詳細・作成・更新・倍率取得・更新について、成功、401、403、404、422、境界値をテストする。返却 JSON を上記 contract と固定する。
4. **frontend に API 型・client を実装する。** mock と `USE_MOCK` を本番 client に残さず、contract test または API mock をテスト専用へ分離する。エラー表示、loading、再試行を既存 `request` / `toApiError` の流儀で統一する。
5. **画面を現在の frontend 基点に実装する。** まず一覧、次に追加・編集、最後に倍率モーダルとする。route を一貫して `/event_operator/management`（または合意した新 URL）に統一し、存在しないサイドバーリンクは出さない。
6. **画像を独立した後続機能として扱う。** 画像が必須でなければ問題 CRUD の完了条件から外す。必須なら API/storage/容量・形式制限/表示/削除を設計してから有効化する。
7. **PC / タブレットで UI と操作を検証する。** プロジェクト規約では event 開催者画面は PC・タブレット、Admin 画面は PC が対象である。対象画面の区分を先に確定し、対象幅で長い問題文、26問程度の一覧、モーダル、キーボード操作を確認する。

## 8. 実装開始前の決定事項

- 問題管理を「event 開催者」画面として実装するのか、「Admin」画面として実装するのか。これにより対象端末、URL、認可主体が変わる。
- canonical な route は `/event_operator/management` とするか、`/event_operator/problem-management` とするか。既存 UI 内の表記を統一する。
- 問題のデータ設計: 4択固定か、将来の選択肢数可変を許容するか。画像 URL を Question に含めるか、別リソースにするか。
- CRUD の範囲: 今回は一覧・詳細・作成・更新だけか、削除、並べ替え、公開状態、出題順も必要か。
- 入力制約: 200 / 100 文字、4択、正解 A〜D を正式仕様とするか。backend が返す validation error の文言・形式をどうするか。
- 倍率: `high` / `normal` / `low` の意味、0〜9.99・小数2桁、既定値 2.00 / 1.00 / 0.50、数値または2桁文字列の返却形式、全問題共通であることを確定する。
- 認可: 誰が閲覧・作成・更新・倍率変更できるか。既存の管理セッションにどの permission を追加／要求するか。
- 画像: 今回リリースに含めるか。含める場合の storage、許可 MIME type・容量、URL の公開範囲、更新・削除方法を決める。
- 保存完了後の UX: 一覧遷移、連続追加、トースト／成功表示、未保存変更時の離脱確認を決める。
- frontend PR #16 の過去実装を cherry-pick 的に再利用するか、現在の frontend `main` を基点に必要な画面のみ再実装するか。二重 `css`、壊れた route、mock 固定をそのまま持ち込まない。

## 9. 実装完了内容（2026-04-12）

> この節は実装済み worktree の内容と検証結果を記録する追記である。親リポジトリの submodule 参照、ソース、および Git 参照はこのドキュメント更新では変更していない。

### 実装ブランチと基点

| サブモジュール | 実装ブランチ | 実装開始基点 HEAD | 基点の参照 |
| --- | --- | --- | --- |
| `backend` | `feature/question-management-api` | `99657e74c542f9bd92aa395974e9f56b7db94f4a` | `origin/main`（`admin-api-status` マージ後） |
| `frontend` | `feature/question-management-api` | `3ca314164be3c749ef2d4320630174b93081da49` | `origin/main`（user-registration マージ後） |

両サブモジュールは上記基点からの未コミット実装状態であり、親 worktree の固定 SHA は更新していない。今回のタスクではコミットも行わない。

### 実装済み API contract

すべて `/api/admin` 配下で、管理セッションと `MANAGEMENT_PAGE_VIEW` permission を必須とする。未認証は 401、permission 不足は 403、存在しない問題は 404 を返す。変更系（POST / PUT / PATCH / DELETE）は same-origin 検証を通過する必要がある。

| 操作 | HTTP / path | request / response |
| --- | --- | --- |
| 問題一覧 | `GET /api/admin/questions` | `position` 昇順の `Question[]` |
| 問題詳細 | `GET /api/admin/questions/:id` | `Question` |
| 問題作成 | `POST /api/admin/questions` | flat な問題 payload を受け、作成した `Question` を 201 で返す |
| 問題更新 | `PUT /api/admin/questions/:id` | flat な問題 payload を受け、更新済み `Question` を返す |
| 問題削除 | `DELETE /api/admin/questions/:id` | hard delete、204 No Content |
| 倍率取得 | `GET /api/admin/confidence-multipliers` | `{ high: string, normal: string, low: string }`（常に小数第2位まで） |
| 倍率更新 | `PATCH /api/admin/confidence-multipliers/:level` | `{ confidenceMultiplier: number }` を受け、3段階すべての倍率を返す |

問題の primary payload / response は `questionText`、`choiceA`〜`choiceD`、`correctAnswer`（`A`〜`D`）である。response はさらに `id`、`position`、`imageUrl`（`string | null`）、`createdAt`、`updatedAt` を含む。422 は `{ error, fieldErrors }` とし、`fieldErrors` は frontend と一致する camelCase key（例: `questionText`、`choiceA`、`correctAnswer`）で返す。過去 PR #16 互換として、入力時のみ `choices: { A..D }` と `correctChoice` も受け付けるが、返却 contract は flat 形式に統一している。

### frontend の主要改修

- mock client と `USE_MOCK`、mock 用テストを廃止し、cookie を `credentials: 'include'` で送る実 API client に置換した。作成・更新・削除・一覧/詳細取得・倍率取得/更新のすべてが上記 API を使用する。
- canonical route を `/admin/problems`、`/admin/problems/new`、`/admin/problems/:id/edit` に統一した。旧 `/event_operator/management` は query / hash を保った `/admin/problems` への redirect のみとし、存在しない URL へ戻る導線を除去した。
- 一覧・追加・編集の全 canonical page に `admin` middleware を適用した。middleware は session API で `MANAGEMENT_PAGE_VIEW` を確認し、401 / 403 は `/admin` へ遷移する。
- 問題一覧に削除確認 dialog を追加し、削除成功時は一覧を即時更新してバックグラウンドで再取得する。問題番号には DB id ではなく永続 `position` を表示する。
- フォームはクライアント側必須検証に加え、backend の 422 `fieldErrors` を各問題文・選択肢・正解フィールドへ表示する。401 / 403 / 404 / 422 は利用者向けメッセージに正規化し、一覧、詳細、倍率に再試行 UI を設けた。
- 倍率 modal は API から3段階を取得して保存し、`confidenceMultiplier` を number として送信する。表示は `formatMultiplier` で小数第2位までに統一し、0〜9.99・小数第2位までを検証する。
- 画像アップロードの disabled 仮 UI は削除した。`imageUrl` は API から返った既存 URL を表示するのみであり、アップロード機能は本実装の対象外である。

### backend のモデル・DB・安全策

- `Question` と `ConfidenceMultiplier`、両 policy、controller、migration、model / policy / request spec を追加した。policy は両リソースの操作に `MANAGEMENT_PAGE_VIEW` を要求する。
- `questions` は `position`（unique・正整数）、4択、正解、任意 `image_url`、timestamps を保持する。DB check constraint で position の正数と正解 A〜D を保証し、model でも問題文最大200文字、選択肢最大100文字、URL最大2048文字、HTTP(S) URL を検証する。文字列は保存前に trim する。
- 新規問題の position 採番は PostgreSQL transaction advisory lock と unique index により直列化し、同時作成時の重複を防ぐ。削除は hard delete で、既存問題の position は詰め直さない。
- `confidence_multipliers` は `high` / `normal` / `low` の一意行、`decimal(3,2)`、DB check constraint を持つ。取得時に `2.00` / `1.00` / `0.50` を idempotent に初期化し、0〜9.99・小数第2位までを model / DB で制限する。
- controller は文字列であるべき問題パラメータに object / array 等が来た場合も、更新前に 422 の field error として拒否する。CORS は PUT / PATCH / DELETE の利用・preflight に必要なメソッドを許可し、変更リクエスト自体は既存の origin 保護を維持する。

### レビューで判明し、修正済みの事項

1. **422 field errors:** `ApiError` が `fieldErrors` を保持・正規化し、flat な backend key をフォームの `choices.A`〜`choices.D` へ確実に map するよう修正した。これによりサーバー検証エラーが汎用メッセージだけで失われない。
2. **倍率の type:** API client の `updateConfidenceMultiplier` は文字列ではなく `number` を受け、modal で検証後に `Number(...)` を明示して送るよう修正した。backend の `Numeric` 要求と TypeScript contract が一致する。
3. **`QuestionFormFields` import:** `QuestionForm.vue` に `QuestionFormFields.vue` の明示 import を追加した。コンポーネント自動 import に依存せず、unit test / 型解決を安定させた。

### 検証結果

| 対象 | 結果 | 備考 |
| --- | --- | --- |
| frontend unit tests | **102 tests pass** | 問題 API client、削除 dialog、422 field error、倍率 UI を含む。 |
| backend RuboCop | pass | 実装対象を含む静的スタイル検査。 |
| backend Zeitwerk check | pass | autoload / eager load を確認。 |
| backend Brakeman | pass | 静的セキュリティ検査。 |
| backend RSpec | 未実行 | PostgreSQL、Docker、Ruby 環境の不備により実行できなかった。request spec は追加済み。 |
| frontend typecheck / lint | 未完 | 実行環境が Node 20 であり、project が要求する Node `>=22.19.0` を満たさない。加えて `oxc` dependency の解決問題がある。 |
