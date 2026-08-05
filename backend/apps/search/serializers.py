"""Serializers for the search API endpoints."""

from rest_framework import serializers

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
    keyword = serializers.CharField(max_length=200, required=False, allow_blank=True)
    include_unknown_size = serializers.BooleanField(required=False)

    def validate_include_unknown_size(self, value: bool | None) -> bool | None:
        if value is not None and not self.context.get('include_company_fields'):
            raise serializers.ValidationError(
                'include_unknown_size is only valid for company search.'
            )
        return value
