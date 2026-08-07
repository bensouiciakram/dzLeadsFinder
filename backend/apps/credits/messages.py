"""Localized API messages for the credits surface (the quota.py pattern).

The server `detail` is the ops/debug surface; the frontend toasts its own
static localized strings, never these values.
"""

INSUFFICIENT_CREDITS_MESSAGES: dict[str, str] = {
    'ar': 'لا يوجد رصيد كافٍ — اشحن رصيدك أو قم بالترقية.',
    'fr': 'Crédits insuffisants — rechargez votre solde ou passez à Starter.',
    'en': 'Insufficient credits — top up or upgrade to continue.',
}

RECORD_NOT_FOUND_MESSAGES: dict[str, str] = {
    'ar': 'لم يتم العثور على هذا السجل.',
    'fr': 'Enregistrement introuvable.',
    'en': 'Record not found.',
}

CONCURRENT_REVEAL_MESSAGES: dict[str, str] = {
    'ar': 'تعارض في الطلب المتزامن — حاول مرة أخرى.',
    'fr': 'Conflit de requête simultanée — réessayez.',
    'en': 'Concurrent reveal conflict — please retry.',
}
