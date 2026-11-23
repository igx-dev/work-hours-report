"""ユーザー管理(admin)。ログインの情報は Cognito(directory)に持ち、
日報の画面やグラフに出す名前だけを DynamoDB(repo)にも書いておく。"""

from app.errors import AppError, not_found, validation

ROLES = ("member", "admin")


def _check_roles(roles) -> list[str]:
    if not isinstance(roles, list) or not roles or any(r not in ROLES for r in roles):
        raise validation("役割は member と admin から1つ以上選んでください")
    return [r for r in ROLES if r in roles]


class UserService:
    def __init__(self, directory, repo):
        self.directory = directory
        self.repo = repo

    def list(self) -> list[dict]:
        return sorted(self.directory.list_users(), key=lambda u: u["name"])

    def create(self, data: dict) -> dict:
        roles = _check_roles(data.get("roles"))
        if self.directory.find_by_email(data["email"]):
            raise AppError(409, "ALREADY_EXISTS", "このメールアドレスは、もう登録されています")
        user = self.directory.create_user(data["name"], data["email"], roles)
        self.repo.put_user({"userId": user["userId"], "name": user["name"]})
        return user

    def update(self, me: str, user_id: str, changes: dict) -> dict:
        user = self.directory.get_user(user_id)
        if user is None:
            raise not_found("ユーザーが見つかりません")
        if user_id == me:
            if "roles" in changes and "admin" not in changes["roles"]:
                raise validation("自分の管理者の役割は外せません")
            if changes.get("enabled") is False:
                raise validation("自分の利用は止められません")

        if "name" in changes:
            self.directory.set_name(user_id, changes["name"])
            self.repo.put_user({"userId": user_id, "name": changes["name"]})
        if "roles" in changes:
            self.directory.set_roles(user_id, _check_roles(changes["roles"]))
        if "enabled" in changes:
            self.directory.set_enabled(user_id, bool(changes["enabled"]))
        return self.directory.get_user(user_id)
