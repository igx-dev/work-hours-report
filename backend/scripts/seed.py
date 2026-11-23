"""見本のデータを入れる(dev 用)。プロジェクト3つと、メンバー3人の過去3か月分の日報。

使い方:
    TABLE_NAME=work-hours-report-dev python scripts/seed.py <member1の userId> <member2> <member3>

userId は Cognito のユーザーの sub。ユーザーは AWS のコンソールか CLI で先に作っておく。
"""

import random
import sys
from datetime import date, timedelta

import boto3

sys.path.insert(0, "src")
from app.repositories.dynamo import DynamoRepo  # noqa: E402

PROJECTS = [
    ("p-order", "受発注システム改修", 480, "2026-09-01", "2027-02-28"),
    ("p-portal", "社内ポータル", 160, "2026-10-01", "2027-01-31"),
    ("p-stock", "在庫の見える化", 240, "2026-11-01", "2027-04-30"),
]
NAMES = ["山田 太郎", "佐藤 花子", "鈴木 一郎"]
NOTES = ["画面設計", "レビュー", "打ち合わせ", "テスト", "不具合の修正", ""]


def main(user_ids: list[str]) -> None:
    import os

    repo = DynamoRepo(boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"]))
    for pid, name, planned, start, end in PROJECTS:
        repo.put_project({"projectId": pid, "name": name, "plannedHours": planned,
                          "startDate": start, "endDate": end, "status": "ACTIVE"})
    for user_id, name in zip(user_ids, NAMES, strict=False):
        repo.put_user({"userId": user_id, "name": name})

    rng = random.Random(42)
    today = date.today()
    day = today - timedelta(days=90)
    while day < today:
        if day.weekday() < 5:
            for user_id in user_ids:
                active = [p for p in PROJECTS if p[3] <= day.isoformat() <= p[4]]
                split = rng.sample(active, k=min(len(active), rng.choice([1, 2])))
                left = 8.0
                for i, (pid, pname, *_rest) in enumerate(split):
                    hours = left if i == len(split) - 1 else rng.choice([2, 3, 4, 5])
                    left -= hours
                    repo.put_report(user_id, {
                        "date": day.isoformat(), "projectId": pid, "projectName": pname,
                        "hours": float(hours), "note": rng.choice(NOTES),
                        "updatedAt": f"{day.isoformat()}T18:00:00+09:00"})
        day += timedelta(days=1)
    print("見本のデータを入れました")


if __name__ == "__main__":
    main(sys.argv[1:])
