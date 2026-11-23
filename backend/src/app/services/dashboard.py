"""ダッシュボードと CSV。集計用のデータは持たず、開いた時に日報を読んで足し算する。"""

import csv
import io
from collections import defaultdict

from app.errors import not_found, validation


def _months(from_month: str, to_month: str) -> list[str]:
    year, month = map(int, from_month.split("-"))
    result = []
    while (current := f"{year:04d}-{month:02d}") <= to_month:
        result.append(current)
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return result


def _fmt(hours: float) -> str:
    return f"{hours:g}"


class DashboardService:
    def __init__(self, repo):
        self.repo = repo

    def summary(self, month: str) -> dict:
        items = []
        for project in self.repo.list_projects():
            month_end = f"{month}-31"
            reports = (
                self.repo.list_project_reports(
                    project["projectId"], project["startDate"], month_end)
                if project["startDate"] <= month_end
                else []  # その月の終わりまでに、まだ始まっていない
            )
            items.append({
                "projectId": project["projectId"],
                "projectName": project["name"],
                "plannedHours": project["plannedHours"],
                "actualHoursToDate": sum(r["hours"] for r in reports),
                "monthHours": sum(r["hours"] for r in reports if r["date"].startswith(month)),
            })
        return {"month": month, "items": items}

    def project(self, project_id: str, from_month: str, to_month: str) -> dict:
        if from_month > to_month:
            raise validation("期間の始めは終わりより前にしてください")
        project = self.repo.get_project(project_id)
        if project is None:
            raise not_found("プロジェクトが見つかりません")

        by_month: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for r in self.repo.list_project_reports(project_id, f"{from_month}-01", f"{to_month}-31"):
            by_month[r["date"][:7]][r["userId"]] += r["hours"]

        months = []
        for month in _months(from_month, to_month):
            users = by_month.get(month, {})
            months.append({
                "month": month,
                "totalHours": sum(users.values()),
                "byUser": [{"userId": u, "userName": self._user_name(u), "hours": h}
                           for u, h in users.items()],
            })
        return {"project": project, "months": months}

    def csv(self, month: str) -> str:
        rows = []
        for project in self.repo.list_projects():
            for r in self.repo.list_project_reports(
                    project["projectId"], f"{month}-01", f"{month}-31"):
                rows.append((r["date"], project["projectId"], r["userId"], project["name"],
                             r["hours"], r.get("note", "")))
        rows.sort(key=lambda row: row[:3])

        out = io.StringIO()
        writer = csv.writer(out, lineterminator="\r\n")
        writer.writerow(["日付", "プロジェクト", "メンバー", "時間", "メモ"])
        for day, _, user_id, name, hours, note in rows:
            writer.writerow([day, name, self._user_name(user_id), _fmt(hours), note])
        return "﻿" + out.getvalue()

    def _user_name(self, user_id: str) -> str:
        user = self.repo.get_user(user_id)
        return user["name"] if user else user_id
