# work-hours-report(工数日報)

作業時間を日報で記録し、プロジェクトごとの工数をグラフで見るアプリ。

- 作業者: PC かスマホのブラウザで、その日の作業時間をプロジェクト別に入力する
- 管理者: ダッシュボードで、予定と実績の工数をグラフで見る
- 未提出の人には夕方に Slack で知らせ、週次のまとめも Slack に流す

AWS 上のサーバーレス構成(API Gateway + Lambda + DynamoDB)で動く。画面は Web だけで、スマホの幅にも合わせる。

## 構成

| ディレクトリ | 中身 |
| --- | --- |
| `docs/` | 設計書 |
| `api/` | API 仕様書(OpenAPI) |
| `web/` | Web 画面(React + TypeScript) |
| `backend/` | Lambda 関数(Python)と IaC(AWS SAM) |

## 手元で動かす

画面は「見本モード」で、AWS につながずに動かせる(ブラウザの中の見本データを使う)。メールアドレスが `admin` で始まれば管理者、それ以外は作業者としてログインできる(パスワードは何でもよい)。

```bash
cd web && npm install && npm run dev:mock
```

テスト:

```bash
cd web && npm test
```

```bash
cd backend && python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/pytest
```

## デプロイ

```bash
cd backend && sam build && sam deploy --config-env dev
```

Web は、SAM の出力(`ApiUrl`、`UserPoolId`、`UserPoolClientId`)を `web/.env.production.local` に書いて `npm run build` し、`dist/` を出力の `WebBucketName` の S3 バケットに置く。

## 設計書

1. [要件定義](docs/01_要件定義.md)
2. [アーキテクチャ](docs/02_アーキテクチャ.md)
3. [データ設計](docs/03_データ設計.md)
4. [API 設計](docs/04_API設計.md)
5. [フロントエンド設計](docs/05_フロントエンド設計.md)
6. [バックエンド設計](docs/06_バックエンド設計.md)
7. [開発プロセス](docs/07_開発プロセス.md)
