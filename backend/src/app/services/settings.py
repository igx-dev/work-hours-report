"""設定(admin)。Slack の Webhook URL と、通知のオン・オフ。

Webhook URL は知っていれば誰でも投稿できてしまうので、鍵の保管場所(Secrets Manager)に置き、
画面からは書き込むだけにする(読み出しは末尾4文字だけ)。オン・オフは DynamoDB に置く。
"""

from collections.abc import Callable

from app.errors import AppError, validation

WEBHOOK_PREFIX = "https://hooks.slack.com/"
DEFAULTS = {"remindEnabled": True, "weeklyReportEnabled": True}
TEST_MESSAGE = "工数日報からのテスト送信です。このチャンネルに通知が届きます。"


def current(repo) -> dict:
    """保存されている設定に、決まりの初期値(どちらもオン)を足したもの。"""
    return {**DEFAULTS, **repo.get_settings()}


class SettingsService:
    def __init__(self, repo, secrets, send: Callable[[str, str], None]):
        self.repo = repo
        self.secrets = secrets
        self.send = send

    def get(self) -> dict:
        stored = current(self.repo)
        hint = stored.get("slackHint")
        return {
            "slackConfigured": hint is not None,
            "slackHint": hint,
            "remindEnabled": stored["remindEnabled"],
            "weeklyReportEnabled": stored["weeklyReportEnabled"],
        }

    def update(self, changes: dict) -> dict:
        self.repo.put_settings({**current(self.repo), **changes})
        return self.get()

    def set_webhook(self, url: str) -> dict:
        if not url.startswith(WEBHOOK_PREFIX):
            raise validation(
                "Slack の Incoming Webhook の URL"
                "(https://hooks.slack.com/ で始まる)を入れてください")
        self.secrets.put(url)
        self.repo.put_settings({**current(self.repo), "slackHint": url[-4:]})
        return self.get()

    def send_test(self) -> None:
        url = self.secrets.get()
        if not url or not self.get()["slackConfigured"]:
            raise validation("Slack の Webhook URL がまだ設定されていません")
        try:
            self.send(url, TEST_MESSAGE)
        except Exception:
            raise AppError(502, "SLACK_ERROR",
                           "Slack に送れませんでした。URL が正しいか確かめてください") from None
