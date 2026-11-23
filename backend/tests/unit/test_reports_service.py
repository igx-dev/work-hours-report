"""日報の登録・削除・複製のテスト。DynamoDB の代わりにメモリ上の偽物(FakeRepo)を使う。"""

from datetime import date

import pytest

from app.errors import AppError
from app.services.reports import ReportService
from tests.fakes import FakeRepo

TODAY = date(2027, 1, 12)


@pytest.fixture
def repo():
    r = FakeRepo()
    r.add_project("p-001", "受発注システム改修", status="ACTIVE")
    r.add_project("p-002", "社内ポータル", status="ACTIVE")
    r.add_project("p-999", "旧サイト改修", status="CLOSED")
    return r


@pytest.fixture
def service(repo):
    return ReportService(repo, today=lambda: TODAY)


def put(service, *, day="2027-01-12", project="p-001", hours=3.5, note="", admin=False):
    return service.put("u-1", date.fromisoformat(day), project, hours, note, is_admin=admin)


def test_日報を登録すると保存され_プロジェクト名も付く(service, repo):
    report = put(service, hours=3.5, note="レビュー")
    assert report["projectName"] == "受発注システム改修"
    assert repo.reports_of("u-1", date(2027, 1, 12)) == [report]


def test_同じ日と同じプロジェクトで登録し直すと上書きになる(service, repo):
    put(service, hours=3)
    put(service, hours=5)
    assert [r["hours"] for r in repo.reports_of("u-1", date(2027, 1, 12))] == [5]


def test_15分単位でない時間は400(service):
    with pytest.raises(AppError) as e:
        put(service, hours=1.1)
    assert (e.value.status, e.value.code) == (400, "VALIDATION_ERROR")


def test_締めた月は403(service):
    with pytest.raises(AppError) as e:
        put(service, day="2026-11-30")
    assert (e.value.status, e.value.code) == (403, "FORBIDDEN")


def test_ないプロジェクトは404(service):
    with pytest.raises(AppError) as e:
        put(service, project="p-404")
    assert e.value.code == "NOT_FOUND"


def test_終了したプロジェクトには登録できない(service):
    with pytest.raises(AppError) as e:
        put(service, project="p-999")
    assert (e.value.status, e.value.code) == (422, "PROJECT_CLOSED")


def test_1日の合計が24時間を超えると422(service):
    put(service, project="p-001", hours=16)
    with pytest.raises(AppError) as e:
        put(service, project="p-002", hours=8.25)
    assert (e.value.status, e.value.code) == (422, "DAILY_LIMIT_EXCEEDED")
    assert e.value.details == {"date": "2027-01-12", "totalHours": 24.25}


def test_上書きの時は元の時間を合計に数えない(service):
    put(service, project="p-001", hours=16)
    put(service, project="p-002", hours=8)
    put(service, project="p-002", hours=8)  # 同じ内容で登録し直しても 24 時間のまま


def test_日報を削除できる_なければ404(service, repo):
    put(service)
    service.delete("u-1", date(2027, 1, 12), "p-001", is_admin=False)
    assert repo.reports_of("u-1", date(2027, 1, 12)) == []
    with pytest.raises(AppError) as e:
        service.delete("u-1", date(2027, 1, 12), "p-001", is_admin=False)
    assert e.value.code == "NOT_FOUND"


def test_直前に出した日の日報を複製できる(service, repo):
    put(service, day="2027-01-08", project="p-001", hours=5, note="設計")
    put(service, day="2027-01-08", project="p-002", hours=3)
    result = service.copy_from_previous("u-1", date(2027, 1, 12), is_admin=False)
    assert result["sourceDate"] == "2027-01-08"
    assert [(r["projectId"], r["hours"], r["note"]) for r in result["items"]] == [
        ("p-001", 5, "設計"),
        ("p-002", 3, ""),
    ]
    assert len(repo.reports_of("u-1", date(2027, 1, 12))) == 2


def test_複製元がなければ404(service):
    with pytest.raises(AppError) as e:
        service.copy_from_previous("u-1", date(2027, 1, 12), is_admin=False)
    assert e.value.code == "NOT_FOUND"


def test_複製は_その日の内容を前回の内容にまるごと置き換える(service, repo):
    put(service, day="2027-01-08", project="p-001", hours=5)
    put(service, day="2027-01-12", project="p-002", hours=2)
    service.copy_from_previous("u-1", date(2027, 1, 12), is_admin=False)
    assert [(r["projectId"], r["hours"]) for r in repo.reports_of("u-1", date(2027, 1, 12))] == [
        ("p-001", 5)
    ]


def test_複製元に終了したプロジェクトがあれば_何も変えずに422(service, repo):
    put(service, day="2027-01-08", project="p-001", hours=5)
    put(service, day="2027-01-12", project="p-002", hours=2)
    repo.projects["p-001"]["status"] = "CLOSED"
    with pytest.raises(AppError) as e:
        service.copy_from_previous("u-1", date(2027, 1, 12), is_admin=False)
    assert e.value.code == "PROJECT_CLOSED"
    assert [r["projectId"] for r in repo.reports_of("u-1", date(2027, 1, 12))] == ["p-002"]
