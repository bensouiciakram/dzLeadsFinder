from typing import Any, Optional

from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(exc: Exception, context: dict[str, Any]) -> Optional[Response]:
    response = exception_handler(exc, context)
    if response is not None and isinstance(exc, APIException) and isinstance(response.data, dict):
        codes = exc.get_codes()
        if codes:
            response.data['code'] = codes
    return response
