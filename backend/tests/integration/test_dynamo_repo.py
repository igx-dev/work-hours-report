"""DynamoDB のキーで正しく読み書きできるかのテスト。moto で偽の DynamoDB を立てる。"""

from datetime import date

import boto3
import pytest
from moto import mock_aws

from app.repositories.dynamo import DynamoRepo, create_table


@pytest.fixture
def repo(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "ap-northeast-1")
    with mock_aws():
        table = create_table(boto3.resource("dynamodb"), "test-table")
        yield DynamoRepo(table)


def report(day, project, hours, note=""):
    return {"date": day, "projectId": project, "projectName": "名前", "hours": hours,
            "note": note, "updatedAt": "2027-01-12T17:40:00+09:00"}


def test_日報を書いて_その日の分と月の分を読める(repo):
    repo.put_report("u-1", report("2027-01-12", "p-001", 3.5))
    repo.put_report("u-1", report("2027-01-12", "p-002", 2))
    repo.put_report("u-1", report("2027-02-01", "p-001", 1))
    repo.put_report("u-2", report("2027-01-12", "p-001", 8))

    day = repo.list_reports_for_date("u-1", date(2027, 1, 12))
    assert [(r["projectId"], r["hours"]) for r in day] == [("p-001", 3.5), ("p-002", 2)]
    assert len(repo.list_reports_for_month("u-1", "2027-01")) == 2


def test_時間はDecimalではなく数値で返る(repo):
    repo.put_report("u-1", report("2027-01-12", "p-001", 3.5))
    hours = repo.list_reports_for_date("u-1", date(2027, 1, 12))[0]["hours"]
    assert hours == 3.5 and isinstance(hours, float)


def test_削除すると消え_なければFalse(repo):
    repo.put_report("u-1", report("2027-01-12", "p-001", 3.5))
    assert repo.delete_report("u-1", date(2027, 1, 12), "p-001") is True
    assert repo.delete_report("u-1", date(2027, 1, 12), "p-001") is False


def test_指定の日より前で一番新しい日報の日付(repo):
    repo.put_report("u-1", report("2027-01-07", "p-001", 1))
    repo.put_report("u-1", report("2027-01-08", "p-001", 1))
    repo.put_report("u-1", report("2027-01-12", "p-001", 1))
    assert repo.latest_report_date_before("u-1", date(2027, 1, 12)) == date(2027, 1, 8)
    assert repo.latest_report_date_before("u-1", date(2027, 1, 7)) is None


def test_プロジェクトの日報を期間で読める_索引GSI1(repo):
    repo.put_report("u-1", report("2026-12-31", "p-001", 1))
    repo.put_report("u-1", report("2027-01-08", "p-001", 2))
    repo.put_report("u-2", report("2027-01-31", "p-001", 3))
    repo.put_report("u-2", report("2027-01-31", "p-002", 9))
    items = repo.list_project_reports("p-001", "2027-01-01", "2027-01-31")
    assert [(r["date"], r["userId"], r["hours"]) for r in items] == [
        ("2027-01-08", "u-1", 2), ("2027-01-31", "u-2", 3)]


def test_プロジェクトを状態で絞って一覧できる_状態を変えると索引も変わる(repo):
    base = {"plannedHours": 10, "startDate": "2027-01-01", "endDate": "2027-03-31"}
    repo.put_project({**base, "projectId": "p-001", "name": "A", "status": "ACTIVE"})
    repo.put_project({**base, "projectId": "p-002", "name": "B", "status": "ACTIVE"})
    repo.put_project({**base, "projectId": "p-002", "name": "B", "status": "CLOSED"})
    assert [p["projectId"] for p in repo.list_projects("ACTIVE")] == ["p-001"]
    assert [p["projectId"] for p in repo.list_projects()] == ["p-001", "p-002"]
    assert repo.get_project("p-002")["plannedHours"] == 10


def test_ユーザーを書いて読める(repo):
    repo.put_user({"userId": "u-1", "name": "山田 太郎"})
    assert repo.get_user("u-1") == {"userId": "u-1", "name": "山田 太郎"}
    assert repo.get_user("u-9") is None


def test_プロフィールしかない人は直前の日報なし(repo):
    repo.put_user({"userId": "u-1", "name": "山田 太郎"})
    assert repo.latest_report_date_before("u-1", date(2027, 1, 12)) is None
