"""Slack の Incoming Webhook に投稿する。Webhook の URL は Secrets Manager に置く。

SLACK_SECRET_ARN が空の時(Slack をまだつないでいない時)は、投稿せずにログに出す。
"""

import json
import urllib.request

import boto3
from aws_lambda_powertools import Logger

logger = Logger(service="slack")


class SlackWebhook:
    def __init__(self, secret_arn: str):
        self.secret_arn = secret_arn
        self._url: str | None = None

    def post(self, text: str) -> None:
        if not self.secret_arn:
            logger.info("Slack が未設定のため投稿しません", extra={"text": text})
            return
        if self._url is None:
            client = boto3.client("secretsmanager")
            self._url = client.get_secret_value(SecretId=self.secret_arn)["SecretString"]
        req = urllib.request.Request(
            self._url, data=json.dumps({"text": text}).encode(),
            headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as res:
            res.read()
