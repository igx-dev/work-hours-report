"""Slack の Incoming Webhook に投稿する。Webhook の URL は鍵の保管場所(Secrets Manager)から読む。

URL がまだ設定されていない時は、投稿せずにログに出す。
"""

import json
import urllib.request

from aws_lambda_powertools import Logger

logger = Logger(service="slack")


def post_to_webhook(url: str, text: str) -> None:
    req = urllib.request.Request(
        url, data=json.dumps({"text": text}).encode(),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as res:
        res.read()


class SlackWebhook:
    def __init__(self, secrets):
        self.secrets = secrets

    def post(self, text: str) -> None:
        url = self.secrets.get() if self.secrets else None
        if not url:
            logger.info("Slack が未設定のため投稿しません")
            return
        post_to_webhook(url, text)
