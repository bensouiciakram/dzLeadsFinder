import pytest
from rest_framework.exceptions import ValidationError

from apps.search.filters import (
    COMPANY_SORT_FIELDS,
    PEOPLE_SORT_FIELDS,
    SEARCH_FILTER_KEYS,
    SENIORITY_BANDS,
    SIZE_BANDS,
    parse_filters,
    parse_page,
    parse_sort,
)

pytestmark = pytest.mark.django_db


class TestBandTaxonomy:
    def test_seniority_bands_match_spine(self) -> None:
        assert SENIORITY_BANDS == [
            'owner_founder',
            'c_level',
            'director',
            'manager',
            'individual_contributor',
        ]

    def test_size_bands_match_spine(self) -> None:
        assert SIZE_BANDS == ['1-10', '11-50', '51-200', '201-500', '500+']

    def test_sort_whitelists(self) -> None:
        assert PEOPLE_SORT_FIELDS == frozenset({'name', 'role', 'company_name', 'wilaya_code'})
        assert COMPANY_SORT_FIELDS == frozenset(
            {'name', 'size_band', 'wilaya_code', 'people_count'}
        )

    def test_filter_keys_match_spec(self) -> None:
        assert SEARCH_FILTER_KEYS == frozenset(
            {'industry', 'wilaya', 'seniority', 'keyword', 'size', 'include_unknown_size'}
        )


class TestParseFiltersValid:
    def test_none_yields_empty_filters(self) -> None:
        result = parse_filters(None)
        assert result.industry == []
        assert result.wilaya == []
        assert result.seniority == []
        assert result.keyword is None
        assert result.include_unknown_size is False

    def test_empty_string_yields_empty_filters(self) -> None:
        result = parse_filters('')
        assert result.keyword is None
        assert result.industry == []

    def test_valid_people_payload(self) -> None:
        result = parse_filters(
            '{"industry": [1, 2], "wilaya": [31], "seniority": ["director"], "keyword": "cafe"}'
        )
        assert result.industry == [1, 2]
        assert result.wilaya == [31]
        assert result.seniority == ['director']
        assert result.keyword == 'cafe'

    def test_valid_company_payload(self) -> None:
        result = parse_filters(
            '{"industry": [3], "wilaya": [16], "size": ["11-50"], '
            '"include_unknown_size": true, "keyword": "batiment"}',
            include_company_fields=True,
        )
        assert result.industry == [3]
        assert result.size == ['11-50']
        assert result.include_unknown_size is True
        assert result.keyword == 'batiment'

    def test_unknown_keys_are_ignored(self) -> None:
        result = parse_filters('{"industry": [1], "bogus_key": "x", "page": 2}')
        assert result.industry == [1]
        assert result.keyword is None

    def test_empty_lists_are_no_op(self) -> None:
        result = parse_filters('{"industry": [], "wilaya": []}')
        assert result.industry == []
        assert result.wilaya == []

    def test_blank_keyword_becomes_none(self) -> None:
        result = parse_filters('{"keyword": "  "}')
        assert result.keyword is None


class TestParseFiltersInvalid:
    def test_malformed_json(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_filters('{not json')
        assert 'invalid_filters' in exc.value.get_codes()

    def test_non_dict_json(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_filters('[1, 2]')
        assert 'invalid_filters' in exc.value.get_codes()

    def test_industry_not_a_list(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_filters('{"industry": "construction"}')
        assert 'invalid_filter' in exc.value.get_codes()

    def test_wilaya_out_of_range(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_filters('{"wilaya": [99]}')
        assert 'invalid_filter' in exc.value.get_codes()

    def test_seniority_not_in_bands(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_filters('{"seniority": ["ceo"]}')
        assert 'invalid_filter' in exc.value.get_codes()

    def test_size_not_in_bands(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_filters('{"size": ["huge"]}', include_company_fields=True)
        assert 'invalid_filter' in exc.value.get_codes()

    def test_keyword_too_long(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_filters('{"keyword": "' + 'a' * 201 + '"}')
        assert 'invalid_filter' in exc.value.get_codes()

    def test_include_unknown_size_not_a_bool(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_filters('{"include_unknown_size": 123}', include_company_fields=True)
        assert 'invalid_filter' in exc.value.get_codes()

    def test_include_unknown_size_rejected_on_people(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_filters('{"include_unknown_size": true}')
        assert 'invalid_filter' in exc.value.get_codes()

    def test_size_rejected_on_people(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_filters('{"size": ["11-50"]}')
        assert 'invalid_filter' in exc.value.get_codes()

    def test_seniority_rejected_on_companies(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_filters('{"seniority": ["director"]}', include_company_fields=True)
        assert 'invalid_filter' in exc.value.get_codes()

    def test_oversized_payload_rejected(self) -> None:
        huge = '{"keyword": "' + 'a' * 9000 + '"}'
        with pytest.raises(ValidationError) as exc:
            parse_filters(huge)
        assert 'invalid_filters' in exc.value.get_codes()


class TestParseSort:
    def test_none_defaults_to_name_asc(self) -> None:
        assert parse_sort(None, PEOPLE_SORT_FIELDS) == ('name', 'asc')

    def test_bare_field_defaults_to_asc(self) -> None:
        assert parse_sort('name', PEOPLE_SORT_FIELDS) == ('name', 'asc')

    def test_field_with_direction(self) -> None:
        assert parse_sort('name:desc', PEOPLE_SORT_FIELDS) == ('name', 'desc')

    def test_multicolon_uses_last_segment(self) -> None:
        assert parse_sort('company_name:desc', PEOPLE_SORT_FIELDS) == ('company_name', 'desc')

    def test_non_whitelisted_field(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_sort('email:asc', PEOPLE_SORT_FIELDS)
        assert 'invalid_sort' in exc.value.get_codes()

    def test_bad_direction(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_sort('name:sideways', PEOPLE_SORT_FIELDS)
        assert 'invalid_sort' in exc.value.get_codes()

    def test_company_sort_fields_are_not_people_fields(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_sort('people_count:asc', PEOPLE_SORT_FIELDS)
        assert 'invalid_sort' in exc.value.get_codes()


class TestParsePage:
    def test_none_defaults_to_one(self) -> None:
        assert parse_page(None) == 1

    def test_valid_page(self) -> None:
        assert parse_page('3') == 3

    def test_non_integer_page(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_page('abc')
        assert 'invalid_page' in exc.value.get_codes()

    def test_zero_page(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_page('0')
        assert 'invalid_page' in exc.value.get_codes()

    def test_negative_page(self) -> None:
        with pytest.raises(ValidationError) as exc:
            parse_page('-2')
        assert 'invalid_page' in exc.value.get_codes()

