"""鍵の保管場所(Secrets Manager)。Slack の Webhook URL を1つだけ持つ。"""

import boto3

UNSET = "unset"  # まだ設定していない時の値(Secrets Manager は空の値を持てないため)


class SecretStore:
    def __init__(self, secret_arn: str, client=None):
        self.secret_arn = secret_arn
        self.client = client or boto3.client("secretsmanager")

    def get(self) -> str | None:
        value = self.client.get_secret_value(SecretId=self.secret_arn)["SecretString"]
        return None if value in ("", UNSET) else value

    def put(self, value: str) -> None:
        self.client.put_secret_value(SecretId=self.secret_arn, SecretString=value)
