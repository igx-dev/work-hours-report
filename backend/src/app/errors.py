"""API のエラー。docs/04_api-design.md の「エラーの形」に合わせる。"""


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details

    def body(self) -> dict:
        body = {"code": self.code, "message": self.message}
        if self.details is not None:
            body["details"] = self.details
        return body


def validation(message: str) -> AppError:
    return AppError(400, "VALIDATION_ERROR", message)


def forbidden(message: str = "この操作はできません") -> AppError:
    return AppError(403, "FORBIDDEN", message)


def not_found(message: str = "見つかりません") -> AppError:
    return AppError(404, "NOT_FOUND", message)
