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
| `web/` | Web 画面(React + TypeScript)※未作成 |
| `backend/` | Lambda 関数(Python)と IaC(AWS SAM)※未作成 |

## 設計書

1. [要件定義](docs/01_requirements.md)
2. [アーキテクチャ](docs/02_architecture.md)
3. [データ設計](docs/03_data-design.md)
4. [API 設計](docs/04_api-design.md)
5. [フロントエンド設計](docs/05_frontend-design.md)
6. [バックエンド設計](docs/06_backend-design.md)
7. [開発プロセス](docs/07_development-process.md)
