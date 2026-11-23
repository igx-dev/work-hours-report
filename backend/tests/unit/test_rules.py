"""業務ルール(入力ルール)のテスト。docs/01_requirements.md の「入力ルール」に対応する。"""

from datetime import date

from app.services.rules import daily_total_error, editable_error, future_error, validate_hours

# --- 時間の単位と範囲 ---


def test_15分単位でない時間はエラー():
    assert validate_hours(1.1) == "15分単位で入力してください"


def test_0点25から24時間はOK():
    assert validate_hours(0.25) is None
    assert validate_hours(24) is None


def test_0時間や24時間を超える時間はエラー():
    assert validate_hours(0) == "0.25〜24時間で入力してください"
    assert validate_hours(24.25) == "0.25〜24時間で入力してください"


# --- 1日の合計は 24 時間まで ---


def test_ほかのプロジェクトと合わせて24時間ちょうどはOK():
    assert daily_total_error(other_hours=[8, 8], new_hours=8) is None


def test_ほかのプロジェクトと合わせて24時間を超えるとエラー():
    assert daily_total_error(other_hours=[8, 8], new_hours=8.25) == 24.25


# --- 直せるのは当月と前月まで ---


TODAY = date(2027, 1, 12)


def test_当月と前月の日報は直せる():
    assert editable_error(date(2027, 1, 1), today=TODAY, is_admin=False) is None
    assert editable_error(date(2026, 12, 1), today=TODAY, is_admin=False) is None


def test_前々月の日報は直せない():
    message = editable_error(date(2026, 11, 30), today=TODAY, is_admin=False)
    assert message == "締めた月の日報は直せません"


def test_adminは締めた月も直せる():
    assert editable_error(date(2026, 11, 30), today=TODAY, is_admin=True) is None



def test_今日までは出せる():
    assert future_error(date(2027, 1, 12), today=TODAY) is None
    assert future_error(date(2027, 1, 11), today=TODAY) is None


def test_未来の日付には出せない():
    assert future_error(date(2027, 1, 13), today=TODAY) == "未来の日付には登録できません"
