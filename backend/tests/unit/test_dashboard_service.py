"""ダッシュボードの集計のテスト。集計用のデータは持たず、日報を読んで足し算する。"""

import pytest

from app.errors import AppError
from app.services.dashboard import DashboardService
from tests.fakes import FakeRepo


@pytest.fixture
def repo():
    r = FakeRepo()
    r.add_project("p-001", "受発注システム改修", planned=100, start="2026-12-01")
    r.add_project("p-002", "社内ポータル", planned=40, start="2027-01-01")
    r.put_user({"userId": "u-1", "name": "山田 太郎"})
    r.put_user({"userId": "u-2", "name": "佐藤 花子"})
    for user, day, project, hours in [
        ("u-1", "2026-12-20", "p-001", 8),
        ("u-1", "2027-01-08", "p-001", 5),
        ("u-2", "2027-01-08", "p-001", 2.5),
        ("u-2", "2027-01-09", "p-002", 4),
        ("u-1", "2027-02-01", "p-001", 7),  # 対象の月より後
    ]:
        r.put_report(user, {"date": day, "projectId": project, "hours": hours})
    return r


def test_月次集計は_その月の合計と_月末までの累計を返す(repo):
    summary = DashboardService(repo).summary("2027-01")
    assert summary == {
        "month": "2027-01",
        "items": [
            {"projectId": "p-001", "projectName": "受発注システム改修",
             "plannedHours": 100, "actualHoursToDate": 15.5, "monthHours": 7.5},
            {"projectId": "p-002", "projectName": "社内ポータル",
             "plannedHours": 40, "actualHoursToDate": 4, "monthHours": 4},
        ],
    }


def test_プロジェクトの推移は月ごと_メンバーごとに足す(repo):
    result = DashboardService(repo).project("p-001", "2026-12", "2027-02")
    assert result["project"]["projectId"] == "p-001"
    assert result["months"] == [
        {"month": "2026-12", "totalHours": 8,
         "byUser": [{"userId": "u-1", "userName": "山田 太郎", "hours": 8}]},
        {"month": "2027-01", "totalHours": 7.5,
         "byUser": [{"userId": "u-1", "userName": "山田 太郎", "hours": 5},
                    {"userId": "u-2", "userName": "佐藤 花子", "hours": 2.5}]},
        {"month": "2027-02", "totalHours": 7,
         "byUser": [{"userId": "u-1", "userName": "山田 太郎", "hours": 7}]},
    ]


def test_日報のない月も0時間として並ぶ(repo):
    months = DashboardService(repo).project("p-002", "2026-12", "2027-01")["months"]
    assert [(m["month"], m["totalHours"]) for m in months] == [("2026-12", 0), ("2027-01", 4)]


def test_期間の始めが終わりより後なら400(repo):
    with pytest.raises(AppError) as e:
        DashboardService(repo).project("p-001", "2027-02", "2027-01")
    assert e.value.code == "VALIDATION_ERROR"


def test_ないプロジェクトは404(repo):
    with pytest.raises(AppError) as e:
        DashboardService(repo).project("p-404", "2027-01", "2027-01")
    assert e.value.code == "NOT_FOUND"


def test_CSVは日付_プロジェクト_メンバー_時間_メモの列でBOM付き(repo):
    csv_text = DashboardService(repo).csv("2027-01")
    assert csv_text.startswith("﻿")
    assert csv_text[1:].splitlines() == [
        "日付,プロジェクト,メンバー,時間,メモ",
        "2027-01-08,受発注システム改修,山田 太郎,5,",
        "2027-01-08,受発注システム改修,佐藤 花子,2.5,",
        "2027-01-09,社内ポータル,佐藤 花子,4,",
    ]
