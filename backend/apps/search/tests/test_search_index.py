from apps.search.search_index import normalize_search, strip_tashkeel, unaccent_text


class TestStripTashkeel:
    def test_removes_tashkeel_diacritics(self) -> None:
        assert strip_tashkeel('شَرِكَةُ التِّجَارَةِ') == 'شركة التجارة'

    def test_removes_extended_arabic_marks(self) -> None:
        assert strip_tashkeel('\u0653\u0654\u0655\u0670\u0640') == ''

    def test_removes_tatweel_from_word(self) -> None:
        assert strip_tashkeel('قـطر') == 'قطر'

    def test_keeps_non_arabic_untouched(self) -> None:
        assert strip_tashkeel('Électricité') == 'Électricité'

    def test_empty_string(self) -> None:
        assert strip_tashkeel('') == ''


class TestUnaccentText:
    def test_removes_french_accents(self) -> None:
        assert unaccent_text('Électricité Générale') == 'Electricite Generale'

    def test_keeps_plain_ascii(self) -> None:
        assert unaccent_text('Constantine SARL') == 'Constantine SARL'

    def test_empty_string(self) -> None:
        assert unaccent_text('') == ''


class TestNormalizeSearch:
    def test_lowercase_unaccent_and_collapse(self) -> None:
        assert normalize_search('  BÂTIMENT  ', 'ÉNERGIE', '') == 'batiment energie'

    def test_arabic_tashkeel_stripped(self) -> None:
        assert normalize_search('شَرِكَةُ التِّجَارَةِ') == 'شركة التجارة'

    def test_mixed_arabic_and_latin(self) -> None:
        assert normalize_search('شَرِكَة', 'Oran') == 'شركة oran'

    def test_single_part(self) -> None:
        assert normalize_search('  SARL  ') == 'sarl'

    def test_all_empty_parts(self) -> None:
        assert normalize_search('', '', '') == ''

    def test_parts_with_internal_whitespace(self) -> None:
        assert normalize_search('  a   b  ', 'c') == 'a b c'

    def test_preserves_arabic_letters(self) -> None:
        assert normalize_search('قسنطينة') == 'قسنطينة'

    def test_strips_invisible_format_characters(self) -> None:
        assert normalize_search('SARL\u200bÉLECTRICITÉ') == 'sarl electricite'
        assert normalize_search('A\u200dB') == 'a b'
        assert normalize_search('A\u00adB') == 'a b'
        assert normalize_search('\u200c') == ''

    def test_turkish_dotted_i_folds_cleanly(self) -> None:
        assert normalize_search('İSTANBUL') == 'istanbul'
