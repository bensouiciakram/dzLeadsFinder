"""Localized strings for the export surface (the quota.py/messages.py pattern).

The server `detail` is the ops/debug surface; the 4.5 modal renders its own
static localized copy, never these values. Header LABELS are consumed by the
file builders (FR-3 — only headers localize); data values never translate.
Copy marked [PENDING REVIEW] awaits native-speaker review (the Q7
translation-review assumption).
"""

# Stable column orders (FR-2 — the underlying column order is stable for CSV
# export; DESIGN.md#L330).
EXPORT_PEOPLE_COLUMNS = ['name', 'role', 'company', 'wilaya', 'email', 'phone', 'address']
EXPORT_COMPANY_COLUMNS = [
    'name',
    'industry',
    'wilaya',
    'size_band',
    'website',
    'people_count',
]

# Header labels per locale per record type: {locale: {record_type: {key: label}}}.
EXPORT_CSV_HEADERS: dict[str, dict[str, dict[str, str]]] = {
    'en': {
        'people': {
            'name': 'Name',
            'role': 'Role',
            'company': 'Company',
            'wilaya': 'Wilaya',
            'email': 'Email',
            'phone': 'Phone',
            'address': 'Address',
        },
        'company': {
            'name': 'Name',
            'industry': 'Industry',
            'wilaya': 'Wilaya',
            'size_band': 'Size',
            'website': 'Website',
            'people_count': 'People count',
        },
    },
    'fr': {
        'people': {
            'name': 'Nom',
            'role': 'Fonction',
            'company': 'Entreprise',
            'wilaya': 'Wilaya',
            'email': 'Email',
            'phone': 'Téléphone',
            'address': 'Adresse',
        },
        'company': {
            'name': 'Nom',
            'industry': 'Secteur',
            'wilaya': 'Wilaya',
            'size_band': 'Taille',
            'website': 'Site web',
            'people_count': 'Effectif',
        },
    },
    'ar': {
        'people': {
            'name': 'الاسم',
            'role': 'الوظيفة',
            'company': 'الشركة',
            'wilaya': 'الولاية',
            'email': 'البريد الإلكتروني',
            'phone': 'الهاتف',
            'address': 'العنوان',
        },
        'company': {
            'name': 'الاسم',
            'industry': 'القطاع',
            'wilaya': 'الولاية',
            'size_band': 'الحجم',
            'website': 'الموقع الإلكتروني',
            'people_count': 'عدد الأشخاص',
        },
    },
}

# FR-20 come-back-tomorrow (EXPERIENCE.md#L98 copy — verbatim, no trailing
# periods).
EXPORT_LIMIT_MESSAGES: dict[str, str] = {
    'ar': 'بلغت حد التصدير (5,000 صف خلال 24 ساعة) — عُد غدًا',
    'fr': (
        'Limite d\'export atteinte (5 000 lignes par 24 h) — '
        'revenez demain'
    ),
    'en': (
        'Export limit reached (5,000 rows per 24 h) — '
        'come back tomorrow'
    ),
}

# Concurrent same-user export (or export racing a reveal) — the loser of the
# serialization race rolls back cleanly; retryable (the 4.2 precedent).
CONCURRENT_EXPORT_MESSAGES: dict[str, str] = {
    'ar': 'تعارض في التصدير المتزامن — حاول مرة أخرى.',
    'fr': 'Conflit d\'export simultané — réessayez.',
    'en': 'Concurrent export conflict — please retry.',
}

# FR-18 tier gate (4.4 ships paid-only; 4.6 relaxes CSV for free).
STARTER_ONLY_MESSAGES: dict[str, str] = {
    'ar': 'التصدير متاح لمشتركي Starter فقط — قم بالترقية للمتابعة. [PENDING REVIEW]',
    'fr': (
        'L\'export est réservé aux abonnés Starter — '
        'passez à Starter pour continuer. [PENDING REVIEW]'
    ),
    'en': 'Export is available to Starter subscribers only — upgrade to continue.',
}

# Download 404 (ownership-filtered — no existence leak).
EXPORT_RECORD_NOT_FOUND_MESSAGES: dict[str, str] = {
    'ar': 'لم يتم العثور على هذا التصدير.',
    'fr': 'Export introuvable.',
    'en': 'Export not found.',
}

# FR-19 watermark copy — the STRINGS ship in 4.4 (approved PRD copy); row
# generation lands in 4.6. [PENDING REVIEW] for fr/ar.
WATERMARK_MESSAGES: dict[str, str] = {
    'ar': 'DZLeads Free — قم بالترقية لإزالة العلامة المائية [PENDING REVIEW]',
    'fr': 'DZLeads Free — passez à Starter pour retirer le filigrane [PENDING REVIEW]',
    'en': 'DZLeads Free — upgrade to remove',
}
