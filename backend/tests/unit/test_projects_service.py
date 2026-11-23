"""プロジェクトの登録・修正のテスト。"""

import pytest

from app.errors import AppError
from app.services.projects import ProjectService
from tests.fakes import FakeRepo

NEW = {"name": "新しい仕組み", "plannedHours": 120, "startDate": "2027-01-01",
       "endDate": "2027-06-30"}


def test_登録するとACTIVEで保存され_IDが振られる():
    repo = FakeRepo()
    project = ProjectService(repo, new_id=lambda: "p-abc").create(NEW)
    assert project == {**NEW, "projectId": "p-abc", "status": "ACTIVE"}
    assert repo.get_project("p-abc") == project


def test_終了日が開始日より前なら400():
    with pytest.raises(AppError) as e:
        ProjectService(FakeRepo()).create({**NEW, "endDate": "2026-12-31"})
    assert e.value.code == "VALIDATION_ERROR"


def test_修正は送った項目だけ変わる():
    repo = FakeRepo()
    service = ProjectService(repo, new_id=lambda: "p-abc")
    service.create(NEW)
    updated = service.update("p-abc", {"status": "CLOSED"})
    assert updated["status"] == "CLOSED"
    assert updated["name"] == "新しい仕組み"


def test_ないプロジェクトの修正は404():
    with pytest.raises(AppError) as e:
        ProjectService(FakeRepo()).update("p-404", {"status": "CLOSED"})
    assert e.value.code == "NOT_FOUND"
