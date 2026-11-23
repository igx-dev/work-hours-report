"""設定(Slack の Webhook URL と、通知のオン・オフ)のテスト。"""

import pytest

from app.errors import AppError
from app.services.settings import SettingsService
from tests.fakes import FakeRepo, FakeSecretStore

URL = "https://hooks.slack.com/services/T000/B000/abcd1234"


class FakeSender:
    def __init__(self, fail=False):
        self.sent: list[tuple[str, str]] = []
        self.fail = fail

    def __call__(self, url, text):
        if self.fail:
            raise OSError("Slack に届かない")
        self.sent.append((url, text))


@pytest.fixture
def secrets():
    return FakeSecretStore()


@pytest.fixture
def sender():
    return FakeSender()


@pytest.fixture
def service(secrets, sender):
    return SettingsService(FakeRepo(), secrets, sender)


def test_最初は_Slack未設定で_通知はどちらもオン(service):
    assert service.get() == {"slackConfigured": False, "slackHint": None,
                             "remindEnabled": True, "weeklyReportEnabled": True}


def test_WebhookURLを保存すると_鍵の保管場所に入り_画面には末尾4文字だけ出す(service, secrets):
    settings = service.set_webhook(URL)
    assert secrets.value == URL
    assert settings["slackConfigured"] is True and settings["slackHint"] == "1234"
    assert URL not in str(settings)


def test_SlackのWebhookでないURLは400(service, secrets):
    with pytest.raises(AppError) as e:
        service.set_webhook("https://example.com/hook")
    assert e.value.code == "VALIDATION_ERROR"
    assert secrets.value is None


def test_通知のオンオフを変えられる(service):
    settings = service.update({"remindEnabled": False})
    assert settings["remindEnabled"] is False and settings["weeklyReportEnabled"] is True


def test_テスト送信はSlackに1件送る(service, sender):
    service.set_webhook(URL)
    service.send_test()
    assert sender.sent == [(URL, "工数日報からのテスト送信です。このチャンネルに通知が届きます。")]


def test_未設定でテスト送信すると400(service):
    with pytest.raises(AppError) as e:
        service.send_test()
    assert e.value.code == "VALIDATION_ERROR"


def test_Slackに送れなかったら502(secrets):
    service = SettingsService(FakeRepo(), secrets, FakeSender(fail=True))
    service.set_webhook(URL)
    with pytest.raises(AppError) as e:
        service.send_test()
    assert (e.value.status, e.value.code) == (502, "SLACK_ERROR")
