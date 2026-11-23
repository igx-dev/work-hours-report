"""日報の登録・削除・複製。ルールの中身は rules.py、保存は repository に任せる。"""

from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone

from app.errors import AppError, forbidden, not_found, validation
from app.services import rules

JST = timezone(timedelta(hours=9))


def _today_jst() -> date:
    return datetime.now(JST).date()


class ReportService:
    def __init__(self, repo, today: Callable[[], date] = _today_jst):
        self.repo = repo
        self.today = today

    def list_month(self, user_id: str, month: str) -> list[dict]:
        return self.repo.list_reports_for_month(user_id, month)

    def put(self, user_id, day: date, project_id, hours, note, *, is_admin) -> dict:
        if message := rules.validate_hours(hours):
            raise validation(message)
        self._check_editable(day, is_admin)
        project = self._active_project(project_id)

        others = [r["hours"] for r in self.repo.list_reports_for_date(user_id, day)
                  if r["projectId"] != project_id]
        if (total := rules.daily_total_error(others, hours)) is not None:
            raise AppError(422, "DAILY_LIMIT_EXCEEDED", "1日の合計が24時間を超えます",
                           {"date": day.isoformat(), "totalHours": total})

        report = {
            "date": day.isoformat(),
            "projectId": project_id,
            "projectName": project["name"],
            "hours": hours,
            "note": note or "",
            "updatedAt": datetime.now(JST).isoformat(timespec="seconds"),
        }
        self.repo.put_report(user_id, report)
        return report

    def delete(self, user_id, day: date, project_id, *, is_admin) -> None:
        self._check_editable(day, is_admin)
        if not self.repo.delete_report(user_id, day, project_id):
            raise not_found("日報が見つかりません")

    def copy_from_previous(self, user_id, day: date, *, is_admin) -> dict:
        """直前に日報を出した日の内容で、その日の日報をまるごと置き換える。"""
        self._check_editable(day, is_admin)
        source = self.repo.latest_report_date_before(user_id, day)
        if source is None:
            raise not_found("複製できる日報がありません")
        source_reports = self.repo.list_reports_for_date(user_id, source)
        # 先に全部確かめてから書き換える(途中で失敗して半端にならないように)
        for r in source_reports:
            self._active_project(r["projectId"])

        for r in self.repo.list_reports_for_date(user_id, day):
            self.repo.delete_report(user_id, day, r["projectId"])
        items = [
            self.put(user_id, day, r["projectId"], r["hours"], r.get("note", ""),
                     is_admin=is_admin)
            for r in source_reports
        ]
        return {"sourceDate": source.isoformat(), "items": items}

    def _check_editable(self, day: date, is_admin: bool) -> None:
        if message := rules.editable_error(day, today=self.today(), is_admin=is_admin):
            raise forbidden(message)

    def _active_project(self, project_id: str) -> dict:
        project = self.repo.get_project(project_id)
        if project is None:
            raise not_found("プロジェクトが見つかりません")
        if project["status"] != "ACTIVE":
            raise AppError(422, "PROJECT_CLOSED", "終了したプロジェクトには登録できません")
        return project
