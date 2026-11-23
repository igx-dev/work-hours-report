"""ユーザー管理のテスト。Cognito の代わりに偽物(FakeDirectory)を使う。"""

import pytest

from app.errors import AppError
from app.services.users import UserService
from tests.fakes import FakeDirectory, FakeRepo

ADMIN = "u-admin"


@pytest.fixture
def directory():
    d = FakeDirectory()
    d.add(ADMIN, "管理 花子", "admin@example.com", ["member", "admin"])
    d.add("u-1", "山田 太郎", "yamada@example.com", ["member"])
    return d


@pytest.fixture
def repo():
    return FakeRepo()


@pytest.fixture
def service(directory, repo):
    return UserService(directory, repo)


def test_一覧は名前_メール_役割_状態を返す(service):
    users = {u["userId"]: u for u in service.list()}
    assert users["u-1"] == {"userId": "u-1", "name": "山田 太郎", "email": "yamada@example.com",
                        "roles": ["member"], "enabled": True}


def test_追加すると招待され_日報の名前用にテーブルにも名前が入る(service, directory, repo):
    user = service.create({"name": "佐藤 花子", "email": "sato@example.com", "roles": ["member"]})
    assert user["enabled"] is True
    assert directory.invited == ["sato@example.com"]
    assert repo.get_user(user["userId"]) == {"userId": user["userId"], "name": "佐藤 花子"}


def test_同じメールアドレスはもう登録できない(service):
    with pytest.raises(AppError) as e:
        service.create({"name": "別人", "email": "yamada@example.com", "roles": ["member"]})
    assert (e.value.status, e.value.code) == (409, "ALREADY_EXISTS")


def test_役割が1つもなければ400(service):
    with pytest.raises(AppError) as e:
        service.create({"name": "X", "email": "x@example.com", "roles": []})
    assert e.value.code == "VALIDATION_ERROR"


def test_名前と役割を変えられる(service, repo):
    user = service.update(ADMIN, "u-1", {"name": "山田 一郎", "roles": ["member", "admin"]})
    assert user["name"] == "山田 一郎" and user["roles"] == ["member", "admin"]
    assert repo.get_user("u-1")["name"] == "山田 一郎"


def test_利用を止めて_戻せる(service):
    assert service.update(ADMIN, "u-1", {"enabled": False})["enabled"] is False
    assert service.update(ADMIN, "u-1", {"enabled": True})["enabled"] is True


def test_自分の管理者の役割は外せない(service):
    with pytest.raises(AppError) as e:
        service.update(ADMIN, ADMIN, {"roles": ["member"]})
    assert e.value.code == "VALIDATION_ERROR"
    assert "自分" in e.value.message


def test_自分の利用は止められない(service):
    with pytest.raises(AppError) as e:
        service.update(ADMIN, ADMIN, {"enabled": False})
    assert e.value.code == "VALIDATION_ERROR"


def test_いない人は404(service):
    with pytest.raises(AppError) as e:
        service.update(ADMIN, "u-404", {"name": "X"})
    assert e.value.code == "NOT_FOUND"
