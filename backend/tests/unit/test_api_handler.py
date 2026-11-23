"""API の入口(HTTP の出入り)のテスト。API Gateway から届く形のイベントを作って渡す。"""

import json
from datetime import date

import pytest

from app.handlers import api
from tests.fakes import FakeRepo


class FakeContext:
    function_name = "api-fn"
    memory_limit_in_mb = 256
    invoked_function_arn = "arn:aws:lambda:ap-northeast-1:000000000000:function:api-fn"
    aws_request_id = "req-1"


@pytest.fixture
def repo(monkeypatch):
    r = FakeRepo()
    r.add_project("p-001", "受発注システム改修")
    r.put_user({"userId": "u-1", "name": "山田 太郎"})
    monkeypatch.setattr(api, "get_repo", lambda: r)
    monkeypatch.setattr(api, "today_jst", lambda: date(2027, 1, 12))
    return r


def call(method, path, *, body=None, query=None, groups="member", sub="u-1"):
    event = {
        "httpMethod": method,
        "path": path,
        "resource": path,
        "headers": {"Content-Type": "application/json"},
        "queryStringParameters": query,
        "body": json.dumps(body) if body is not None else None,
        "isBase64Encoded": False,
        "requestContext": {
            "requestId": "req-1",
            "authorizer": {"claims": {"sub": sub, "cognito:groups": groups}},
        },
    }
    res = api.handler(event, FakeContext())
    headers = {k: v[0] for k, v in (res.get("multiValueHeaders") or {}).items()}
    headers |= res.get("headers") or {}
    is_json = "json" in headers.get("Content-Type", "")
    data = json.loads(res["body"]) if is_json and res["body"] else res["body"]
    return res["statusCode"], data


def test_自分のプロフィールにはロールが付く(repo):
    status, data = call("GET", "/me", groups="admin,member")
    assert status == 200
    assert data == {"userId": "u-1", "name": "山田 太郎", "roles": ["member", "admin"]}


def test_日報を登録して_月の一覧で読める(repo):
    status, data = call("PUT", "/me/reports/2027-01-12/p-001", body={"hours": 3.5, "note": "設計"})
    assert status == 200 and data["hours"] == 3.5
    status, data = call("GET", "/me/reports", query={"month": "2027-01"})
    assert status == 200 and [r["note"] for r in data["items"]] == ["設計"]


def test_業務ルールのエラーは決まった形で返る(repo):
    call("PUT", "/me/reports/2027-01-12/p-001", body={"hours": 20})
    repo.add_project("p-002", "社内ポータル")
    status, data = call("PUT", "/me/reports/2027-01-12/p-002", body={"hours": 5})
    assert status == 422
    assert data["code"] == "DAILY_LIMIT_EXCEEDED"
    assert data["details"] == {"date": "2027-01-12", "totalHours": 25}


@pytest.mark.parametrize("path,body,query", [
    ("/me/reports/2027-13-01/p-001", {"hours": 1}, None),   # ない日付
    ("/me/reports/2027-01-12/p-001", {"hours": "1"}, None),  # 時間が文字
    ("/me/reports/2027-01-12/p-001", {}, None),              # 時間がない
])
def test_形式の誤りは400(repo, path, body, query):
    status, data = call("PUT", path, body=body, query=query)
    assert (status, data["code"]) == (400, "VALIDATION_ERROR")


def test_月の形式が違うと400(repo):
    status, data = call("GET", "/me/reports", query={"month": "2027-1"})
    assert (status, data["code"]) == (400, "VALIDATION_ERROR")


def test_memberは管理者用のAPIを呼べない(repo):
    status, data = call("GET", "/admin/dashboard/summary", query={"month": "2027-01"})
    assert (status, data["code"]) == (403, "FORBIDDEN")


def test_adminはプロジェクトを登録できる(repo):
    body = {"name": "新しい仕組み", "plannedHours": 80, "startDate": "2027-01-01",
            "endDate": "2027-03-31"}
    status, data = call("POST", "/admin/projects", body=body, groups="admin")
    assert status == 201 and data["status"] == "ACTIVE"


def test_CSVはtext_csvで返る(repo):
    call("PUT", "/me/reports/2027-01-12/p-001", body={"hours": 2})
    status, data = call("GET", "/admin/exports/reports.csv", query={"month": "2027-01"},
                        groups="admin")
    assert status == 200 and "2027-01-12,受発注システム改修,山田 太郎,2," in data
