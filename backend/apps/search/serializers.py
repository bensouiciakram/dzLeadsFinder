"""Serializers for the search API endpoints."""

from rest_framework import serializers

from apps.search import quota
from apps.search.filters import SENIORITY_BANDS, SIZE_BANDS


class SearchFiltersSerializer(serializers.Serializer):
    industry = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False)
    wilaya = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=58), required=False
    )
    seniority = serializers.ListField(
        child=serializers.ChoiceField(choices=SENIORITY_BANDS), required=False
    )
    size = serializers.ListField(child=serializers.ChoiceField(choices=SIZE_BANDS), required=False)
    keyword = serializers.CharField(
        max_length=quota.MAX_KEYWORD_LENGTH, required=False, allow_blank=True
    )
    include_unknown_size = serializers.BooleanField(required=False)

    def validate_seniority(self, value: list[str]) -> list[str]:
        if value and self.context.get('include_company_fields'):
            raise serializers.ValidationError('seniority is only valid for people search.')
        return value

    def validate_size(self, value: list[str]) -> list[str]:
        if value and not self.context.get('include_company_fields'):
            raise serializers.ValidationError('size is only valid for company search.')
        return value

    def validate_include_unknown_size(self, value: bool | None) -> bool | None:
        if value is not None and not self.context.get('include_company_fields'):
            raise serializers.ValidationError(
                'include_unknown_size is only valid for company search.'
            )
        return value
