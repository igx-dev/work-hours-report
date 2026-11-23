"""テスト用の偽リポジトリ。本物(DynamoRepo)と同じメソッドを、辞書で実装する。"""

from datetime import date


class FakeRepo:
    def __init__(self):
        self.projects: dict[str, dict] = {}
        self.reports: dict[tuple[str, str, str], dict] = {}
        self.users: dict[str, dict] = {}

    # --- テストの準備用 ---
    def add_project(self, project_id, name, status="ACTIVE", planned=100,
                    start="2026-10-01", end="2027-03-31"):
        self.projects[project_id] = {
            "projectId": project_id, "name": name, "status": status,
            "plannedHours": planned, "startDate": start, "endDate": end,
        }

    def reports_of(self, user_id, day: date):
        return self.list_reports_for_date(user_id, day)

    # --- 本物と同じメソッド ---
    def get_project(self, project_id):
        return self.projects.get(project_id)

    def list_projects(self, status=None):
        items = sorted(self.projects.values(), key=lambda p: p["projectId"])
        return [p for p in items if status is None or p["status"] == status]

    def put_project(self, project):
        self.projects[project["projectId"]] = dict(project)

    def get_user(self, user_id):
        return self.users.get(user_id)

    def put_user(self, user):
        self.users[user["userId"]] = dict(user)

    def put_report(self, user_id, report):
        self.reports[(user_id, report["date"], report["projectId"])] = dict(report, userId=user_id)

    def delete_report(self, user_id, day: date, project_id) -> bool:
        return self.reports.pop((user_id, day.isoformat(), project_id), None) is not None

    def list_reports_for_date(self, user_id, day: date):
        return self._mine(user_id, day.isoformat())

    def list_reports_for_month(self, user_id, month: str):
        return self._mine(user_id, month)

    def latest_report_date_before(self, user_id, day: date):
        dates = [d for (u, d, _) in self.reports if u == user_id and d < day.isoformat()]
        return date.fromisoformat(max(dates)) if dates else None

    def list_project_reports(self, project_id, from_date: str, to_date: str):
        if from_date > to_date:  # 本物の DynamoDB と同じく、逆さまの範囲はエラーにする
            raise ValueError("from_date が to_date より後です")
        items = [r for (_, d, p), r in self.reports.items()
                 if p == project_id and from_date <= d <= to_date]
        return sorted(items, key=lambda r: (r["date"], r["userId"]))

    def _mine(self, user_id, prefix):
        items = [{k: v for k, v in r.items() if k != "userId"}
                 for (u, d, _), r in self.reports.items() if u == user_id and d.startswith(prefix)]
        return sorted(items, key=lambda r: (r["date"], r["projectId"]))


class FakeDirectory:
    """テスト用の偽 Cognito。本物(CognitoDirectory)と同じメソッドを持つ。"""

    def __init__(self):
        self.users: dict[str, dict] = {}
        self.invited: list[str] = []

    def add(self, user_id, name, email, roles, enabled=True):
        self.users[user_id] = {"userId": user_id, "name": name, "email": email,
                               "roles": list(roles), "enabled": enabled}

    def list_users(self):
        return [dict(u) for u in self.users.values()]

    def get_user(self, user_id):
        u = self.users.get(user_id)
        return dict(u) if u else None

    def find_by_email(self, email):
        return next((dict(u) for u in self.users.values() if u["email"] == email), None)

    def create_user(self, name, email, roles):
        user_id = f"u-{len(self.users) + 1}"
        self.add(user_id, name, email, roles)
        self.invited.append(email)
        return dict(self.users[user_id])

    def set_name(self, user_id, name):
        self.users[user_id]["name"] = name

    def set_roles(self, user_id, roles):
        self.users[user_id]["roles"] = list(roles)

    def set_enabled(self, user_id, enabled):
        self.users[user_id]["enabled"] = enabled
