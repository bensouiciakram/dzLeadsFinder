"""Search normalization helpers shared by the search app models.

Arabic tashkeel is stripped at write time to the normalized search column;
French/English diacritics are removed so keyword matching is diacritic-insensitive.
"""

import re
import unicodedata

_ARABIC_DIACRITICS = {
    *range(0x064B, 0x0653),
    0x0653,
    0x0654,
    0x0655,
    0x0670,
    0x0640,
}
_STRIP_ARABIC = str.maketrans({chr(code): None for code in _ARABIC_DIACRITICS})
_WHITESPACE = re.compile(r'\s+')


def strip_tashkeel(text: str) -> str:
    """Remove Arabic diacritics (tashkeel), tatweel, and superscript alef marks."""
    return text.translate(_STRIP_ARABIC)


def unaccent_text(text: str) -> str:
    """Remove combining diacritical marks (French accents, Arabic diacritics)."""
    decomposed = unicodedata.normalize('NFKD', text)
    return ''.join(char for char in decomposed if not unicodedata.combining(char))


def normalize_search(*parts: str) -> str:
    """Build the normalized search string from the given parts."""
    joined = ' '.join(part for part in parts if part)
    stripped = strip_tashkeel(unaccent_text(joined))
    return _WHITESPACE.sub(' ', stripped).strip().lower()
