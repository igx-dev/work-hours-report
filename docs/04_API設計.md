# API 設計

最終更新: 2026-11-23

API の正は [`api/openapi.yaml`](../api/openapi.yaml)(OpenAPI 3.0)。この文書は方針と一覧だけを書く。

## 方針

- **仕様を先に書く**: 画面やバックエンドを作る前に `openapi.yaml` を更新し、マージリクエストでレビューする。フロントとバックはこれを約束として並行に作る
- **型は生成する**: Web の TypeScript の型は `openapi-typescript` で生成し、手で書かない。バックエンドは同じ定義に合わせて、ハンドラーで入力の形を確かめる
- **Swagger UI**: dev 環境に Swagger UI を置き、ブラウザから API を試せるようにする
- **REST**: リソースは名詞、操作は HTTP メソッド。自分のデータは `/me/...`、管理者用は `/admin/...` に分ける
- **日付と時刻**: 日付は `YYYY-MM-DD`、時刻は ISO 8601(`+09:00` 付き)。月は `YYYY-MM`

## 認証・認可

- ログインは Cognito(Web から Amplify Auth で使う)
- API は `Authorization: Bearer <ID トークン>` で呼ぶ。API Gateway の Cognito オーソライザーが検証する
- `/admin/...` は Lambda 内で `cognito:groups` に `admin` があるかを確かめ、なければ 403
- `/me/...` のユーザー ID はトークンの `sub` から取る。パスやクエリでは受け取らない(他人のデータを指定できないように)

## エンドポイント一覧

| メソッド | パス | 説明 | ロール | 機能 ID |
| --- | --- | --- | --- | --- |
| GET | `/me` | 自分のプロフィール | 全員 | F-01 |
| GET | `/me/reports?month=2027-01` | 自分の日報(月単位) | member | F-03 |
| PUT | `/me/reports/{date}/{projectId}` | 日報の登録・上書き | member | F-02 |
| DELETE | `/me/reports/{date}/{projectId}` | 日報の削除 | member | F-02 |
| GET | `/projects?status=ACTIVE` | プロジェクト一覧 | 全員 | F-02 |
| POST | `/admin/projects` | プロジェクトの登録 | admin | F-04 |
| PATCH | `/admin/projects/{projectId}` | プロジェクトの修正・終了 | admin | F-04 |
| GET | `/admin/dashboard/summary?month=2027-01` | 全プロジェクトの月次集計 | admin | F-05, F-06 |
| GET | `/admin/dashboard/projects/{projectId}?from=2026-10&to=2027-03` | 1プロジェクトの月次推移と内訳 | admin | F-05〜F-07 |
| GET | `/admin/exports/reports.csv?month=2027-01` | 工数の CSV | admin | F-08 |
| GET | `/admin/users` | ユーザーの一覧 | admin | F-11 |
| POST | `/admin/users` | ユーザーの招待 | admin | F-11 |
| PATCH | `/admin/users/{userId}` | 名前・役割の変更、利用の停止と再開 | admin | F-11 |
| GET | `/admin/settings` | 設定(Slack をつないであるか、末尾4文字、通知のオン・オフ) | admin | F-12 |
| PATCH | `/admin/settings` | 通知のオン・オフ | admin | F-12 |
| PUT | `/admin/settings/slack-webhook` | Slack の Webhook URL を保存(書き込むだけ) | admin | F-12 |
| POST | `/admin/settings/slack-test` | Slack にテスト送信 | admin | F-12 |

## エラーの形

すべてのエラーは同じ形で返す。

```json
{
  "code": "DAILY_LIMIT_EXCEEDED",
  "message": "1日の合計が24時間を超えます",
  "details": { "date": "2027-01-12", "totalHours": 25.0 }
}
```

| HTTP | code | いつ |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 形式の誤り(時間が 0.25 単位でない、未来の日付など) |
| 401 | `UNAUTHORIZED` | トークンがない、期限切れ |
| 403 | `FORBIDDEN` | admin でない、締めた月の修正 |
| 404 | `NOT_FOUND` | 日報やプロジェクト、ユーザーがない |
| 409 | `ALREADY_EXISTS` | 同じメールアドレスのユーザーがもういる |
| 422 | `DAILY_LIMIT_EXCEEDED` | 1日の合計が 24 時間を超える |
| 422 | `PROJECT_CLOSED` | 終了したプロジェクトへの登録 |
| 429 | `TOO_MANY_REQUESTS` | API Gateway のスロットリング |
| 500 | `INTERNAL_ERROR` | 想定外。ログに相関 ID を残し、レスポンスにも返す |
| 502 | `SLACK_ERROR` | テスト送信で Slack に送れなかった |

## 制限

- スロットリング: 1ユーザーあたり 10 リクエスト/秒、バースト 20(使用量プランではなくステージ設定で全体に掛ける)
- 一覧は1か月分を一度に返す(最大でも1人 31 日 × 数件)ためページングしない。CSV だけはプロジェクト数が増えた時に備えて S3 に書き出して署名付き URL を返す形に変えられるようにしておく
