"""日報の入力ルール。docs/01_requirements.md の「入力ルール」をそのままコードにしたもの。"""

from collections.abc import Iterable
from datetime import date

MIN_HOURS = 0.25
MAX_HOURS = 24
DAILY_LIMIT = 24


def validate_hours(hours: float) -> str | None:
    """時間が 0.25〜24 で、15分(0.25時間)単位ならエラーなし(None)。"""
    if not MIN_HOURS <= hours <= MAX_HOURS:
        return "0.25〜24時間で入力してください"
    if (hours * 4) != int(hours * 4):
        return "15分単位で入力してください"
    return None


def daily_total_error(other_hours: Iterable[float], new_hours: float) -> float | None:
    """同じ日のほかのプロジェクトと合わせて 24 時間を超えたら、その合計を返す。"""
    total = sum(other_hours) + new_hours
    return total if total > DAILY_LIMIT else None


def editable_error(target: date, today: date, is_admin: bool) -> str | None:
    """当月と前月の日報だけ直せる。admin は締めた月も直せる。"""
    if is_admin:
        return None
    first_of_this_month = today.replace(day=1)
    first_of_last_month = (
        first_of_this_month.replace(year=today.year - 1, month=12)
        if today.month == 1
        else first_of_this_month.replace(month=today.month - 1)
    )
    if target < first_of_last_month:
        return "締めた月の日報は直せません"
    return None


def future_error(target: date, today: date) -> str | None:
    """未来の日付の日報は出せない(今日まで)。"""
    if target > today:
        return "未来の日付には登録できません"
    return None
