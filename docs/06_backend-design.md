# バックエンド設計

最終更新: 2026-11-23

## 方針

- Python 3.12、arm64(Graviton)の Lambda
- [Powertools for AWS Lambda (Python)](https://docs.powertools.aws.dev/lambda/python/latest/) でルーティングとログをそろえる。入力の形の確認は、ハンドラーの中の小さな関数で行う(読めばすぐ分かる量に留める)
- IaC は AWS SAM(`backend/template.yaml`)。ローカルでは `sam local start-api` で動かす
- 関数は役割ごとに分け、それぞれに必要な権限だけを与える
- 処理は「ハンドラー(HTTP の出入り)」「サービス(業務ルール)」「リポジトリ(DynamoDB)」の3層に分け、業務ルールを DynamoDB なしでテストできるようにする

## 関数

| 関数 | 起動元 | 担当 | DynamoDB の権限 |
| --- | --- | --- | --- |
| `api-fn` | API Gateway(全エンドポイント) | 日報、プロジェクト、ダッシュボード、CSV | 読み書き |
| `remind-fn` | EventBridge Scheduler(平日 18:00 JST) | 未提出者を Slack に投稿 | 読み取りのみ(+ Cognito のユーザー一覧) |
| `weekly-report-fn` | EventBridge Scheduler(月曜 9:00 JST) | 週次レポートを Slack に投稿 | 読み取りのみ |
| `alarm-fn` | SNS(CloudWatch アラーム) | アラームを Slack に流す | なし |

定期処理のスケジュールは prod だけ有効にし、dev では止めておく(dev で試す時は関数を手で呼ぶ)。Slack の Secrets Manager の ARN が空の時は、投稿せずにログに出す。

API は1つの関数にまとめ、中でパスごとに処理を振り分ける(Powertools の `APIGatewayRestResolver`)。関数が少ない方が、設定とデプロイが簡単になる。

## ディレクトリ

```
backend/
├── template.yaml           SAM テンプレート
├── samconfig.toml          環境ごとのデプロイ設定(dev / prod)
├── src/
├── scripts/seed.py         dev に見本のデータを入れる
├── src/app/
│   ├── handlers/           関数ごとの入口(api.py、scheduled.py: remind / weekly_report / alarm)
│   ├── services/           業務ルール(rules.py, reports.py, projects.py, dashboard.py, notify.py)
│   ├── repositories/       DynamoDB の読み書き(dynamo.py)
│   ├── clients/            Slack、Cognito
│   ├── errors.py           API のエラーの形
│   └── holidays.json       祝日の一覧(未提出者の投稿を休む日)
└── tests/
    ├── fakes.py            テスト用の偽リポジトリ(辞書で DynamoDB の代わりをする)
    ├── unit/               業務ルール、サービス、API の入口のテスト(DynamoDB なし)
    └── integration/        moto で DynamoDB を立てたテスト
```

## 主な処理

### 日報の登録(`PUT /me/reports/{date}/{projectId}`)

1. パスとボディの形を確かめる(日付の形式、時間が数値か)。0.25 単位と 0.25〜24 は業務ルール(`rules.py`)で確かめる
2. 締めた月なら 403(admin を除く)
3. Project を読み、`ACTIVE` でなければ 422(`PROJECT_CLOSED`)
4. その日の自分の日報を読み、今回の分を置き換えた合計が 24 を超えたら 422(`DAILY_LIMIT_EXCEEDED`)
5. Report を書き込み、200 を返す

### ダッシュボード(`/admin/dashboard/*`)

1. 対象のプロジェクトの日報を GSI1 で期間を指定して読む
2. 月ごと、メンバーごとに時間を足し算する
3. 累計(プロジェクト開始からその月末まで)と予定工数を並べて返す

### 未提出者の投稿(`remind-fn`)

1. 祝日なら何もしない(祝日の一覧は `holidays.json`。年に1回、内閣府の一覧から更新する)
2. Cognito から member グループのユーザー一覧を取る
3. 1人ずつ当日の日報があるかを確かめ、ない人の名前を集める
4. 「今日の日報がまだの人: 山田さん、佐藤さん」と入力画面へのリンクを、Slack のチャンネルに Incoming Webhook で1回投稿する(全員出していれば投稿しない)

### 週次レポート(`weekly-report-fn`)

先週の月曜〜日曜の、プロジェクト別の合計と予定に対する消化率を Slack に投稿する。予定の 80% を超えたプロジェクトは先頭に出す。

## ログと監視

- ログは JSON(Powertools Logger)。相関 ID、ユーザー ID、関数名を必ず入れる。日報のメモやメールアドレスはログに出さない
- アラーム(Slack に通知): Lambda のエラー、API Gateway の 5xx

## 外部サービスとの接続

| 接続先 | 方法 | 鍵の置き場所 |
| --- | --- | --- |
| Slack | Incoming Webhook(投稿先のチャンネルは1つ) | Secrets Manager |

## 人が増えたら

| 困ること | 対応 |
| --- | --- |
| チャンネルに名前を出されたくない人がいる | Slack の Bot で本人にダイレクトメッセージを送る |
| API の関数が大きくなる | リソースごとに関数を分け、権限も分ける |
