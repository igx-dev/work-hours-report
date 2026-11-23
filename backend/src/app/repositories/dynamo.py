"""DynamoDB の読み書き。キーの形は docs/03_データ設計.md のとおり。"""

from datetime import date
from decimal import Decimal

from boto3.dynamodb.conditions import Key

KEYS = {"PK", "SK", "GSI1PK", "GSI1SK", "type"}


def _to_db(item: dict) -> dict:
    return {k: Decimal(str(v)) if isinstance(v, float | int) and not isinstance(v, bool) else v
            for k, v in item.items()}


def _from_db(item: dict) -> dict:
    return {k: float(v) if isinstance(v, Decimal) else v
            for k, v in item.items() if k not in KEYS}


def create_table(dynamodb, name: str):
    """テストとローカル用。本番のテーブルは template.yaml で作る。"""
    s = {"AttributeType": "S"}
    return dynamodb.create_table(
        TableName=name,
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[{"AttributeName": n, **s} for n in KEYS - {"type"}],
        KeySchema=[{"AttributeName": "PK", "KeyType": "HASH"},
                   {"AttributeName": "SK", "KeyType": "RANGE"}],
        GlobalSecondaryIndexes=[{
            "IndexName": "GSI1",
            "KeySchema": [{"AttributeName": "GSI1PK", "KeyType": "HASH"},
                          {"AttributeName": "GSI1SK", "KeyType": "RANGE"}],
            "Projection": {"ProjectionType": "ALL"},
        }],
    )


class DynamoRepo:
    def __init__(self, table):
        self.table = table

    # --- ユーザー ---
    def get_user(self, user_id):
        item = self.table.get_item(Key={"PK": f"USER#{user_id}", "SK": "PROFILE"}).get("Item")
        return _from_db(item) if item else None

    def put_user(self, user):
        self.table.put_item(Item=_to_db(
            {**user, "PK": f"USER#{user['userId']}", "SK": "PROFILE", "type": "User"}))

    # --- 設定(1件だけ) ---
    def get_settings(self) -> dict:
        item = self.table.get_item(Key={"PK": "SETTINGS", "SK": "APP"}).get("Item")
        return _from_db(item) if item else {}

    def put_settings(self, settings: dict) -> None:
        self.table.put_item(Item={**settings, "PK": "SETTINGS", "SK": "APP", "type": "Settings"})

    # --- プロジェクト(A-05) ---
    def get_project(self, project_id):
        item = self.table.get_item(Key={"PK": f"PROJECT#{project_id}", "SK": "META"}).get("Item")
        return _from_db(item) if item else None

    def list_projects(self, status=None):
        cond = Key("GSI1PK").eq("PROJECTS")
        if status:
            cond &= Key("GSI1SK").begins_with(f"{status}#")
        items = [_from_db(i) for i in self._query(IndexName="GSI1", KeyConditionExpression=cond)]
        return sorted(items, key=lambda p: p["projectId"])

    def put_project(self, project):
        pid = project["projectId"]
        self.table.put_item(Item=_to_db({
            **project, "PK": f"PROJECT#{pid}", "SK": "META", "type": "Project",
            "GSI1PK": "PROJECTS", "GSI1SK": f"{project['status']}#{pid}",
        }))

    # --- 日報(A-01〜A-04) ---
    def put_report(self, user_id, report):
        day, pid = report["date"], report["projectId"]
        self.table.put_item(Item=_to_db({
            **report, "userId": user_id, "type": "Report",
            "PK": f"USER#{user_id}", "SK": f"REPORT#{day}#{pid}",
            "GSI1PK": f"PROJECT#{pid}", "GSI1SK": f"DATE#{day}#USER#{user_id}",
        }))

    def delete_report(self, user_id, day: date, project_id) -> bool:
        res = self.table.delete_item(
            Key={"PK": f"USER#{user_id}", "SK": f"REPORT#{day.isoformat()}#{project_id}"},
            ReturnValues="ALL_OLD")
        return "Attributes" in res

    def list_reports_for_date(self, user_id, day: date):
        return self._mine(user_id, f"REPORT#{day.isoformat()}#")

    def list_reports_for_month(self, user_id, month: str):
        return self._mine(user_id, f"REPORT#{month}-")

    def latest_report_date_before(self, user_id, day: date):
        # SK が「その日より前」のうち、一番後ろの1件を読む(PROFILE は REPORT より前に並ぶ)
        res = self.table.query(
            KeyConditionExpression=Key("PK").eq(f"USER#{user_id}")
            & Key("SK").lt(f"REPORT#{day.isoformat()}"),
            ScanIndexForward=False, Limit=1)
        items = [i for i in res["Items"] if i["SK"].startswith("REPORT#")]
        return date.fromisoformat(items[0]["date"]) if items else None

    def list_project_reports(self, project_id, from_date: str, to_date: str):
        items = self._query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(f"PROJECT#{project_id}")
            & Key("GSI1SK").between(f"DATE#{from_date}", f"DATE#{to_date}~"))
        return [_from_db(i) for i in items]

    def _mine(self, user_id, prefix):
        items = self._query(KeyConditionExpression=Key("PK").eq(f"USER#{user_id}")
                            & Key("SK").begins_with(prefix))
        return [{k: v for k, v in _from_db(i).items() if k != "userId"} for i in items]

    def _query(self, **kwargs):
        items, start = [], None
        while True:
            res = self.table.query(**kwargs, **({"ExclusiveStartKey": start} if start else {}))
            items += res["Items"]
            if not (start := res.get("LastEvaluatedKey")):
                return items
