from django.conf import settings
from djoser.views import TokenCreateView as DjoserTokenCreateView
from djoser.views import TokenDestroyView as DjoserTokenDestroyView
from rest_framework import status
from rest_framework.response import Response


class TokenCreateView(DjoserTokenCreateView):
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        from .auth import TokenWithVersionAccessToken
        token = TokenWithVersionAccessToken.for_user(user)
        response = Response(
            {'detail': 'Login successful'},
            status=status.HTTP_200_OK,
        )
        response.set_cookie(
            key=settings.SIMPLE_JWT['AUTH_COOKIE'],
            value=str(token),
            httponly=settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY'],
            secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
            samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
            path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
        )
        return response


class TokenDestroyView(DjoserTokenDestroyView):
    def post(self, request, *args, **kwargs):
        response = Response(
            {'detail': 'Logout successful'},
            status=status.HTTP_200_OK,
        )
        response.delete_cookie(
            key=settings.SIMPLE_JWT['AUTH_COOKIE'],
            path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
        )
        return response
