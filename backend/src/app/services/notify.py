"""Slack への投稿。未提出者のお知らせ(平日 18:00)と週次レポート(月曜 9:00)。"""

from collections.abc import Callable
from datetime import date, timedelta

WARN_RATE = 0.8


class NotifyService:
    def __init__(self, repo, slack, *, members: Callable[[], list[dict]], app_url: str,
                 holidays: set[str]):
        self.repo = repo
        self.slack = slack
        self.members = members
        self.app_url = app_url.rstrip("/")
        self.holidays = holidays

    def remind(self, today: date) -> None:
        if today.isoformat() in self.holidays:
            return
        missing = [m["name"] for m in self.members()
                   if not self.repo.list_reports_for_date(m["userId"], today)]
        if missing:
            names = "、".join(f"{n}さん" for n in missing)
            self.slack.post(f"今日の日報がまだの人: {names}\n入力はこちら: {self.app_url}/")

    def weekly_report(self, today: date) -> None:
        monday = today - timedelta(days=today.weekday() + 7)
        sunday = monday + timedelta(days=6)
        rows = []
        for project in self.repo.list_projects("ACTIVE"):
            reports = (
                self.repo.list_project_reports(
                    project["projectId"], project["startDate"], sunday.isoformat())
                if project["startDate"] <= sunday.isoformat()
                else []  # 先週の終わりまでに、まだ始まっていない
            )
            week = sum(r["hours"] for r in reports if r["date"] >= monday.isoformat())
            total = sum(r["hours"] for r in reports)
            rate = total / project["plannedHours"] if project["plannedHours"] else 0
            rows.append((rate, project["name"], week))

        rows.sort(key=lambda row: row[0] < WARN_RATE)  # 予定の 80% を超えたものを先に
        lines = [f"先週({monday.month}/{monday.day}〜{sunday.month}/{sunday.day})の工数"]
        for rate, name, week in rows:
            mark = "⚠️ " if rate >= WARN_RATE else "・"
            lines.append(f"{mark}{name}: {week:g}時間(予定の{rate:.0%})")
        self.slack.post("\n".join(lines))
