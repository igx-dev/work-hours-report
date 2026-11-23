"""Slack への投稿(未提出者のお知らせ、週次レポート)のテスト。"""

from datetime import date

import pytest

from app.services.notify import NotifyService
from tests.fakes import FakeRepo

APP_URL = "https://example.cloudfront.net"


class FakeSlack:
    def __init__(self):
        self.posts: list[str] = []

    def post(self, text: str) -> None:
        self.posts.append(text)


MEMBERS = [{"userId": "u-1", "name": "山田"}, {"userId": "u-2", "name": "佐藤"},
           {"userId": "u-3", "name": "鈴木"}]


@pytest.fixture
def repo():
    r = FakeRepo()
    r.add_project("p-001", "受発注システム改修", planned=100, start="2027-01-01")
    r.add_project("p-002", "社内ポータル", planned=40, start="2027-01-01")
    return r


def service(repo, slack, holidays=()):
    return NotifyService(repo, slack, members=lambda: MEMBERS, app_url=APP_URL,
                         holidays=set(holidays))


def test_日報を出していない人の名前を1回だけ投稿する(repo):
    repo.put_report("u-2", {"date": "2027-01-12", "projectId": "p-001", "hours": 8})
    slack = FakeSlack()
    service(repo, slack).remind(date(2027, 1, 12))
    assert slack.posts == [f"今日の日報がまだの人: 山田さん、鈴木さん\n入力はこちら: {APP_URL}/"]


def test_全員出していれば投稿しない(repo):
    for m in MEMBERS:
        repo.put_report(m["userId"], {"date": "2027-01-12", "projectId": "p-001", "hours": 8})
    slack = FakeSlack()
    service(repo, slack).remind(date(2027, 1, 12))
    assert slack.posts == []


def test_祝日は投稿しない(repo):
    slack = FakeSlack()
    service(repo, slack, holidays={"2027-01-11"}).remind(date(2027, 1, 11))
    assert slack.posts == []


def test_週次レポートは先週の合計と消化率_80パーセントを超えたものが先(repo):
    for user, day, project, hours in [
        ("u-1", "2027-01-05", "p-001", 8),   # 先週より前(累計には入る)
        ("u-1", "2027-01-11", "p-001", 10),  # 先週の月曜
        ("u-2", "2027-01-17", "p-002", 34),  # 先週の日曜
        ("u-2", "2027-01-18", "p-002", 4),   # 今週(入らない)
    ]:
        repo.put_report(user, {"date": day, "projectId": project, "hours": hours})
    slack = FakeSlack()
    service(repo, slack).weekly_report(date(2027, 1, 18))
    assert slack.posts == [
        "先週(1/11〜1/17)の工数\n"
        "⚠️ 社内ポータル: 34時間(予定の85%)\n"
        "・受発注システム改修: 10時間(予定の18%)"
    ]
