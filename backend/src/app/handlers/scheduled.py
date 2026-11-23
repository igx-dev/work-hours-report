"""remind-fn と weekly-report-fn: EventBridge Scheduler から呼ばれる。"""

import json
import os
from datetime import datetime
from pathlib import Path

from aws_lambda_powertools import Logger

from app.clients.cognito import list_members
from app.clients.secrets import SecretStore
from app.clients.slack import SlackWebhook
from app.handlers.api import get_repo
from app.services.notify import NotifyService
from app.services.reports import JST

logger = Logger(service="scheduled")
HOLIDAYS = set(json.loads((Path(__file__).parent.parent / "holidays.json").read_text()))


def _slack() -> SlackWebhook:
    arn = os.environ.get("SLACK_SECRET_ARN", "")
    return SlackWebhook(SecretStore(arn) if arn else None)


def _service() -> NotifyService:
    return NotifyService(
        get_repo(), _slack(),
        members=lambda: list_members(os.environ["USER_POOL_ID"]),
        app_url=os.environ["APP_URL"], holidays=HOLIDAYS)


@logger.inject_lambda_context
def remind(event, context):
    _service().remind(datetime.now(JST).date())


@logger.inject_lambda_context
def weekly_report(event, context):
    _service().weekly_report(datetime.now(JST).date())


@logger.inject_lambda_context
def alarm(event, context):
    """CloudWatch アラーム(SNS 経由)を Slack に流す。設定のオン・オフに関係なく、いつも流す。"""
    slack = _slack()
    for record in event.get("Records", []):
        message = json.loads(record["Sns"]["Message"])
        slack.post(f"🚨 {message.get('AlarmName')}: {message.get('NewStateReason')}")
