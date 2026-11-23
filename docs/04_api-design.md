# API 設計

最終更新: 2026-11-23

API の正は [`api/openapi.yaml`](../api/openapi.yaml)(OpenAPI 3.0)。この文書は方針と一覧だけを書く。

## 方針

- **仕様を先に書く**: 画面やバックエンドを作る前に `openapi.yaml` を更新し、マージリクエストでレビューする。フロントとバックはこれを約束として並行に作る
- **型は生成する**: Web の TypeScript の型は `openapi-typescript` で生成し、手で書かない。バックエンドは同じ定義を API Gateway のリクエスト検証に使う
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
| GET | `/me/reports?month=2027-01` | 自分の日報(月単位) | member | F-04 |
| PUT | `/me/reports/{date}/{projectId}` | 日報の登録・上書き | member | F-02 |
| DELETE | `/me/reports/{date}/{projectId}` | 日報の削除 | member | F-02 |
| POST | `/me/reports/{date}/copy-from-previous` | 直前の日報を複製 | member | F-03 |
| GET | `/projects?status=ACTIVE` | プロジェクト一覧 | 全員 | F-02 |
| POST | `/admin/projects` | プロジェクトの登録 | admin | F-05 |
| PATCH | `/admin/projects/{projectId}` | プロジェクトの修正・終了 | admin | F-05 |
| GET | `/admin/dashboard/summary?month=2027-01` | 全プロジェクトの月次集計 | admin | F-06, F-07 |
| GET | `/admin/dashboard/projects/{projectId}?from=2026-10&to=2027-03` | 1プロジェクトの月次推移と内訳 | admin | F-06〜F-08 |
| GET | `/admin/exports/reports.csv?month=2027-01` | 工数の CSV | admin | F-09 |

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
| 400 | `VALIDATION_ERROR` | 形式の誤り(時間が 0.25 単位でないなど) |
| 401 | `UNAUTHORIZED` | トークンがない、期限切れ |
| 403 | `FORBIDDEN` | admin でない、締めた月の修正 |
| 404 | `NOT_FOUND` | 日報やプロジェクトがない |
| 422 | `DAILY_LIMIT_EXCEEDED` | 1日の合計が 24 時間を超える |
| 422 | `PROJECT_CLOSED` | 終了したプロジェクトへの登録 |
| 429 | `TOO_MANY_REQUESTS` | API Gateway のスロットリング |
| 500 | `INTERNAL_ERROR` | 想定外。ログに相関 ID を残し、レスポンスにも返す |

## 制限

- スロットリング: 1ユーザーあたり 10 リクエスト/秒、バースト 20(使用量プランではなくステージ設定で全体に掛ける)
- 一覧は1か月分を一度に返す(最大でも1人 31 日 × 数件)ためページングしない。CSV だけはプロジェクト数が増えた時に備えて S3 に書き出して署名付き URL を返す形に変えられるようにしておく
