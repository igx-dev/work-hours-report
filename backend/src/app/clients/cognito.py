"""Cognito の読み書き。ユーザーの一覧、招待、名前・役割・利用の可否の変更。

get_user の userId は Cognito の sub。Cognito の操作はユーザー名で行うので、
sub からユーザー名を探してから操作する。
"""

import boto3

ROLES = ("member", "admin")


def _attrs(user: dict) -> dict:
    return {a["Name"]: a["Value"] for a in user.get("Attributes", user.get("UserAttributes", []))}


class CognitoDirectory:
    def __init__(self, user_pool_id: str, client=None):
        self.pool = user_pool_id
        self.client = client or boto3.client("cognito-idp")

    def _members_of(self, group: str) -> set[str]:
        names = set()
        for page in self.client.get_paginator("list_users_in_group").paginate(
                UserPoolId=self.pool, GroupName=group):
            names |= {u["Username"] for u in page["Users"]}
        return names

    def _to_user(self, raw: dict, groups: dict[str, set[str]]) -> dict:
        attrs = _attrs(raw)
        return {
            "userId": attrs["sub"],
            "name": attrs.get("name", ""),
            "email": attrs.get("email", ""),
            "roles": [r for r in ROLES if raw["Username"] in groups[r]],
            "enabled": raw.get("Enabled", True),
        }

    def _raw_users(self, filter_: str | None = None) -> list[dict]:
        kwargs = {"UserPoolId": self.pool, **({"Filter": filter_} if filter_ else {})}
        users = []
        for page in self.client.get_paginator("list_users").paginate(**kwargs):
            users += page["Users"]
        return users

    def _groups(self) -> dict[str, set[str]]:
        return {r: self._members_of(r) for r in ROLES}

    def list_users(self) -> list[dict]:
        groups = self._groups()
        return [self._to_user(u, groups) for u in self._raw_users()]

    def _find(self, filter_: str) -> dict | None:
        found = self._raw_users(filter_)
        return self._to_user(found[0], self._groups()) if found else None

    def get_user(self, user_id: str) -> dict | None:
        return self._find(f'sub = "{user_id}"')

    def find_by_email(self, email: str) -> dict | None:
        return self._find(f'email = "{email}"')

    def _username(self, user_id: str) -> str:
        return self._raw_users(f'sub = "{user_id}"')[0]["Username"]

    def create_user(self, name: str, email: str, roles: list[str]) -> dict:
        """招待する。仮のパスワードを書いたメールが Cognito から届く。"""
        raw = self.client.admin_create_user(
            UserPoolId=self.pool, Username=email, DesiredDeliveryMediums=["EMAIL"],
            UserAttributes=[{"Name": "email", "Value": email},
                            {"Name": "email_verified", "Value": "true"},
                            {"Name": "name", "Value": name}],
        )["User"]
        for role in roles:
            self.client.admin_add_user_to_group(
                UserPoolId=self.pool, Username=raw["Username"], GroupName=role)
        return self._to_user(raw, {r: ({raw["Username"]} if r in roles else set()) for r in ROLES})

    def set_name(self, user_id: str, name: str) -> None:
        self.client.admin_update_user_attributes(
            UserPoolId=self.pool, Username=self._username(user_id),
            UserAttributes=[{"Name": "name", "Value": name}])

    def set_roles(self, user_id: str, roles: list[str]) -> None:
        username = self._username(user_id)
        for role in ROLES:
            if role in roles:
                self.client.admin_add_user_to_group(
                    UserPoolId=self.pool, Username=username, GroupName=role)
            else:
                self.client.admin_remove_user_from_group(
                    UserPoolId=self.pool, Username=username, GroupName=role)

    def set_enabled(self, user_id: str, enabled: bool) -> None:
        username = self._username(user_id)
        if enabled:
            self.client.admin_enable_user(UserPoolId=self.pool, Username=username)
        else:
            self.client.admin_disable_user(UserPoolId=self.pool, Username=username)
            # すでにログインしている画面からも、追い出す
            self.client.admin_user_global_sign_out(UserPoolId=self.pool, Username=username)


def list_members(user_pool_id: str) -> list[dict]:
    """未提出者を探すため: member グループで、利用を止めていない人。"""
    return [{"userId": u["userId"], "name": u["name"]}
            for u in CognitoDirectory(user_pool_id).list_users()
            if "member" in u["roles"] and u["enabled"]]
