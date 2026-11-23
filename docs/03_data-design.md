# データ設計

最終更新: 2026-11-23

DynamoDB のテーブルは1つ(シングルテーブル設計)、索引(GSI)も1つだけにする。先にアクセスパターンを決め、それに合わせてキーを作る。

## アクセスパターン

| ID | 読み書き | 誰が | キー |
| --- | --- | --- | --- |
| A-01 | 自分の日報を月単位で取得 | member | PK = `USER#<userId>`, SK begins_with `REPORT#2027-01` |
| A-02 | 自分の日報を1件登録・上書き・削除 | member | PK = `USER#<userId>`, SK = `REPORT#<date>#<projectId>` |
| A-03 | ある日の自分の合計時間を確認(24h チェック) | システム | PK = `USER#<userId>`, SK begins_with `REPORT#<date>` |
| A-04 | プロジェクトの日報を期間で取得(グラフ、CSV) | admin | GSI1: PK = `PROJECT#<projectId>`, SK between `DATE#<from>` and `DATE#<to>~` |
| A-05 | プロジェクトの一覧 | 全員 | GSI1: PK = `PROJECTS`, SK begins_with `<status>#` |
| A-06 | ある日に日報を出していない member を探す | システム | member ごとに A-03 を引き、日報がない人を集める |

GSI1 は「プロジェクトから日報を引く」と「プロジェクトの一覧」の2つに使う。キーの値が重ならないので、1つの索引で足りる。

## テーブル: `work-hours-report-<env>`

| 項目 | 型 | 説明 |
| --- | --- | --- |
| `PK` | S | パーティションキー |
| `SK` | S | ソートキー |
| `GSI1PK` / `GSI1SK` | S | 索引のキー |
| `type` | S | `User` / `Project` / `Report` |

課金はオンデマンド。ポイントインタイムリカバリを有効にする。

## アイテムの種類

### User(ユーザー)

| 項目 | 例 |
| --- | --- |
| PK / SK | `USER#u-123` / `PROFILE` |
| name | 山田 太郎 |
| active | true |

Cognito の `sub` を `userId` に使う。ロール(admin / member)とメールアドレスは Cognito にだけ持ち、このテーブルには置かない。

### Project(プロジェクト)

| 項目 | 例 |
| --- | --- |
| PK / SK | `PROJECT#p-001` / `META` |
| GSI1PK / GSI1SK | `PROJECTS` / `ACTIVE#p-001` |
| name | 受発注システム改修 |
| plannedHours | 480 |
| startDate / endDate | 2027-01-01 / 2027-03-31 |
| status | `ACTIVE` または `CLOSED` |

### Report(日報)

| 項目 | 例 |
| --- | --- |
| PK / SK | `USER#u-123` / `REPORT#2027-01-12#p-001` |
| GSI1PK / GSI1SK | `PROJECT#p-001` / `DATE#2027-01-12#USER#u-123` |
| hours | 3.5(Number) |
| note | 画面設計のレビュー |
| updatedAt | 2027-01-12T17:40:00+09:00 |

## 集計の仕方

集計用のデータは持たない。ダッシュボードを開いた時に、A-04 でプロジェクトの日報を読み、Lambda の中で足し算する。

- 1プロジェクト・半年分でも、数人なら数百件。1回の読み取りで返せる量に収まる
- 全プロジェクトの集計は、A-05 で一覧を取り、プロジェクトごとに A-04 を引く
- 書き込みと集計がずれることがない

## 整合性の守り方

- 24 時間チェック: その日の自分の日報を読み、合計を確かめてから書く
- 終了したプロジェクトへの登録: 書く前に Project を読み、`status` が `ACTIVE` でなければ断る
- この2つのチェックと書き込みの間に、同じ人が別の画面から同時に書くことはまずないので、ロックやトランザクションは使わない

## 人が増えたら

| 困ること | 対応 |
| --- | --- |
| ダッシュボードが遅くなる | 日報を書いた時に月の合計を足し込んでおく(DynamoDB Streams + 集計 Lambda) |
| 未提出者を探すのに時間がかかる | 日付から日報を引く索引を足す |
| 同時に書かれて24時間を超える | `TransactWriteItems` と条件付き書き込みにする |
