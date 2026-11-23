"""Cognito の読み書きのテスト。moto で偽の Cognito を立てる。"""

import boto3
import pytest
from moto import mock_aws

from app.clients.cognito import CognitoDirectory


@pytest.fixture
def directory(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "ap-southeast-2")
    with mock_aws():
        client = boto3.client("cognito-idp")
        created = client.create_user_pool(PoolName="test", UsernameAttributes=["email"])
        pool = created["UserPool"]["Id"]
        for group in ("member", "admin"):
            client.create_group(UserPoolId=pool, GroupName=group)
        yield CognitoDirectory(pool, client)


def test_作って_一覧と1人分を読める(directory):
    user = directory.create_user("山田 太郎", "yamada@example.com", ["member", "admin"])
    assert user["name"] == "山田 太郎" and user["roles"] == ["member", "admin"]
    assert user["enabled"] is True
    assert directory.get_user(user["userId"]) == user
    assert directory.list_users() == [user]


def test_メールアドレスで探せる(directory):
    user = directory.create_user("山田 太郎", "yamada@example.com", ["member"])
    assert directory.find_by_email("yamada@example.com")["userId"] == user["userId"]
    assert directory.find_by_email("nobody@example.com") is None


def test_名前_役割_利用の可否を変えられる(directory):
    user_id = directory.create_user("山田 太郎", "yamada@example.com", ["member"])["userId"]
    directory.set_name(user_id, "山田 一郎")
    directory.set_roles(user_id, ["admin"])
    directory.set_enabled(user_id, False)
    user = directory.get_user(user_id)
    assert (user["name"], user["roles"], user["enabled"]) == ("山田 一郎", ["admin"], False)


def test_いない人はNone(directory):
    assert directory.get_user("00000000-0000-0000-0000-000000000000") is None
