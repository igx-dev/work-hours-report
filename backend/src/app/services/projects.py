"""プロジェクトの一覧・登録・修正。"""

import secrets
from collections.abc import Callable

from app.errors import not_found, validation


def _new_id() -> str:
    return "p-" + secrets.token_hex(4)


class ProjectService:
    def __init__(self, repo, new_id: Callable[[], str] = _new_id):
        self.repo = repo
        self.new_id = new_id

    def list(self, status: str | None = None) -> list[dict]:
        return self.repo.list_projects(status)

    def create(self, data: dict) -> dict:
        project = {**data, "projectId": self.new_id(), "status": "ACTIVE"}
        self._check_period(project)
        self.repo.put_project(project)
        return project

    def update(self, project_id: str, changes: dict) -> dict:
        current = self.repo.get_project(project_id)
        if current is None:
            raise not_found("プロジェクトが見つかりません")
        project = {**current, **changes}
        self._check_period(project)
        self.repo.put_project(project)
        return project

    @staticmethod
    def _check_period(project: dict) -> None:
        if project["endDate"] < project["startDate"]:
            raise validation("終了日は開始日より後にしてください")
