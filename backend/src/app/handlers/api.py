"""api-fn: API Gateway からの全リクエストを受け、パスごとに振り分ける。

HTTP の出入り(認可、入力の形の確認、レスポンスの形)だけをここで行い、
業務ルールは services/ に任せる。
"""

import os
import re
from datetime import date
from functools import cache

import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayRestResolver, CORSConfig, Response
from aws_lambda_powertools.logging import correlation_paths

from app.clients.cognito import CognitoDirectory
from app.errors import AppError, forbidden, validation
from app.repositories.dynamo import DynamoRepo
from app.services.dashboard import DashboardService
from app.services.projects import ProjectService
from app.services.reports import ReportService, _today_jst
from app.services.users import UserService

logger = Logger(service="api")
cors = CORSConfig(allow_origin=os.environ.get("APP_URL", "*"), max_age=600)
app = APIGatewayRestResolver(cors=cors)

MONTH = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
PROJECT_ID = re.compile(r"^p-[0-9a-z]+$")
STATUSES = {"ACTIVE", "CLOSED"}
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@cache
def get_repo():
    return DynamoRepo(boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"]))


@cache
def get_directory():
    return CognitoDirectory(os.environ["USER_POOL_ID"])


def today_jst() -> date:
    return _today_jst()


# --- 認証情報とパラメーター ---


def claims() -> dict:
    return app.current_event.request_context.authorizer.claims or {}


def user_id() -> str:
    return claims()["sub"]


def roles() -> list[str]:
    raw = claims().get("cognito:groups", "")
    groups = {g for g in re.split(r"[\s,\[\]]+", raw) if g}
    return [r for r in ("member", "admin") if r in groups]


def is_admin() -> bool:
    return "admin" in roles()


def require_admin() -> None:
    if not is_admin():
        raise forbidden("管理者だけが使えます")


def month_param(name: str = "month") -> str:
    value = app.current_event.get_query_string_value(name) or ""
    if not MONTH.match(value):
        raise validation(f"{name} は YYYY-MM の形で指定してください")
    return value


def date_path(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise validation("日付は YYYY-MM-DD の形で指定してください") from None


def project_path(value: str) -> str:
    if not PROJECT_ID.match(value):
        raise validation("プロジェクト ID の形が違います")
    return value


def body() -> dict:
    data = app.current_event.json_body
    if not isinstance(data, dict):
        raise validation("JSON のオブジェクトを送ってください")
    return data


def number(data: dict, key: str, *, required=True) -> float | None:
    value = data.get(key)
    if value is None and not required:
        return None
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise validation(f"{key} は数値で指定してください")
    return float(value)


def text(data: dict, key: str, *, max_length: int, required=True) -> str | None:
    value = data.get(key)
    if value is None and not required:
        return None
    if not isinstance(value, str) or (required and not value) or len(value) > max_length:
        raise validation(f"{key} は {max_length} 文字までの文字で指定してください")
    return value


def reports() -> ReportService:
    return ReportService(get_repo(), today=today_jst)


# --- 自分 ---


@app.get("/me")
def get_me():
    user = get_repo().get_user(user_id()) or {}
    return {"userId": user_id(), "name": user.get("name") or claims().get("email", ""),
            "roles": roles()}


@app.get("/me/reports")
def list_my_reports():
    month = month_param()
    return {"month": month, "items": reports().list_month(user_id(), month)}


@app.put("/me/reports/<day>/<project_id>")
def put_my_report(day: str, project_id: str):
    data = body()
    note = text(data, "note", max_length=500, required=False) if data.get("note") else ""
    return reports().put(user_id(), date_path(day), project_path(project_id),
                         number(data, "hours"), note, is_admin=is_admin())


@app.delete("/me/reports/<day>/<project_id>")
def delete_my_report(day: str, project_id: str):
    reports().delete(user_id(), date_path(day), project_path(project_id), is_admin=is_admin())
    return Response(status_code=204, body="")


# --- プロジェクト ---


@app.get("/projects")
def list_projects():
    status = app.current_event.get_query_string_value("status")
    if status is not None and status not in STATUSES:
        raise validation("status は ACTIVE か CLOSED で指定してください")
    return {"items": ProjectService(get_repo()).list(status)}


def project_fields(data: dict, *, required: bool) -> dict:
    fields = {
        "name": text(data, "name", max_length=100, required=required),
        "plannedHours": number(data, "plannedHours", required=required),
        "startDate": data.get("startDate"),
        "endDate": data.get("endDate"),
    }
    for key in ("startDate", "endDate"):
        if fields[key] is not None or required:
            date_path(str(fields[key]))
    if not required and "status" in data:
        if data["status"] not in STATUSES:
            raise validation("status は ACTIVE か CLOSED で指定してください")
        fields["status"] = data["status"]
    fields = {k: v for k, v in fields.items() if v is not None}
    if not fields:
        raise validation("変える項目を1つ以上送ってください")
    if fields.get("plannedHours", 0) < 0 or fields.get("plannedHours", 0) * 4 % 1:
        raise validation("予定工数は 0 以上の 15分単位で指定してください")
    return fields


@app.post("/admin/projects")
def create_project():
    require_admin()
    project = ProjectService(get_repo()).create(project_fields(body(), required=True))
    return Response(status_code=201, content_type="application/json", body=project)


@app.patch("/admin/projects/<project_id>")
def update_project(project_id: str):
    require_admin()
    changes = project_fields(body(), required=False)
    return ProjectService(get_repo()).update(project_path(project_id), changes)


# --- ダッシュボードと CSV ---


@app.get("/admin/dashboard/summary")
def dashboard_summary():
    require_admin()
    return DashboardService(get_repo()).summary(month_param())


@app.get("/admin/dashboard/projects/<project_id>")
def dashboard_project(project_id: str):
    require_admin()
    return DashboardService(get_repo()).project(
        project_path(project_id), month_param("from"), month_param("to"))


@app.get("/admin/exports/reports.csv")
def export_csv():
    require_admin()
    month = month_param()
    return Response(
        status_code=200,
        content_type="text/csv; charset=utf-8",
        body=DashboardService(get_repo()).csv(month),
        headers={"Content-Disposition": f'attachment; filename="reports-{month}.csv"'},
    )


# --- ユーザー管理 ---


def users() -> UserService:
    return UserService(get_directory(), get_repo())


@app.get("/admin/users")
def list_users():
    require_admin()
    return {"items": users().list()}


@app.post("/admin/users")
def create_user():
    require_admin()
    data = body()
    email = text(data, "email", max_length=254)
    if not EMAIL.match(email):
        raise validation("メールアドレスの形が違います")
    user = users().create({"name": text(data, "name", max_length=100), "email": email,
                           "roles": data.get("roles")})
    return Response(status_code=201, content_type="application/json", body=user)


@app.patch("/admin/users/<target_id>")
def update_user(target_id: str):
    require_admin()
    data = body()
    changes = {}
    if "name" in data:
        changes["name"] = text(data, "name", max_length=100)
    if "roles" in data:
        changes["roles"] = data["roles"]
    if "enabled" in data:
        if not isinstance(data["enabled"], bool):
            raise validation("enabled は true か false で指定してください")
        changes["enabled"] = data["enabled"]
    if not changes:
        raise validation("変える項目を1つ以上送ってください")
    return users().update(user_id(), target_id, changes)


# --- エラー ---


@app.exception_handler(AppError)
def handle_app_error(e: AppError):
    return Response(status_code=e.status, content_type="application/json", body=e.body())


@app.exception_handler(Exception)
def handle_unexpected(e: Exception):
    correlation_id = app.current_event.request_context.request_id
    logger.exception("想定外のエラー")
    return Response(status_code=500, content_type="application/json", body={
        "code": "INTERNAL_ERROR", "message": "想定外のエラーです", "correlationId": correlation_id})


@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_REST)
def handler(event, context):
    return app.resolve(event, context)
