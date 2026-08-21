import logging
import os
from typing import Any, Dict, Tuple

import requests
from celery import shared_task

from apps.billing.pricing import PACK_PRICES

logger = logging.getLogger(__name__)

NEXTJS_INTERNAL_URL = os.environ.get('NEXTJS_INTERNAL_URL', 'http://nextjs:3004')


def render_email(template: str, locale: str, context: Dict[str, Any]) -> Tuple[str, str]:
    response = requests.post(
        f'{NEXTJS_INTERNAL_URL}/api/emails/render',
        json={'template': template, 'locale': locale, 'context': context},
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    return data['html'], data.get('plainText', '')


@shared_task(  # type: ignore[misc]
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 1},
    retry_backoff=True,
)
def send_verification_email(user_id: int) -> None:
    """Send verification email after signup with a fresh single-use link.

    Django imports are deferred to runtime: config/celery.py imports this
    module before the app registry is ready.
    """
    from django.conf import settings
    from django.contrib.auth import get_user_model
    from django.core.mail import EmailMultiAlternatives
    from django.utils import timezone

    from apps.accounts.models import TOKEN_PURPOSE_VERIFY, SingleUseToken

    user_model = get_user_model()
    try:
        user = user_model.objects.get(pk=user_id)
    except user_model.DoesNotExist:
        logger.warning('send_verification_email: user %s not found', user_id)
        return
    token = (
        SingleUseToken.objects.filter(
            user=user,
            purpose=TOKEN_PURPOSE_VERIFY,
            consumed_at__isnull=True,
            expires_at__gt=timezone.now(),
        )
        .order_by('-created_at')
        .first()
    )
    if token is None:
        logger.warning('send_verification_email: no pending token for user %s', user_id)
        return
    verification_link = (
        f'{settings.FRONTEND_PUBLIC_URL.rstrip("/")}/verify-email/{token.token}'
    )
    html, plain_text = render_email(
        'signup_confirm',
        user.effective_locale,
        {'verificationLink': verification_link},
    )
    message = EmailMultiAlternatives(
        subject='Verify your email — DzLeadsFinder',
        body=plain_text or html,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    if plain_text:
        message.attach_alternative(html, 'text/html')
    else:
        message.content_subtype = 'html'
    message.send()


RESET_SUBJECTS = {
    'ar': 'إعادة تعيين كلمة المرور — DzLeadsFinder',
    'fr': 'Réinitialisation de votre mot de passe — DzLeadsFinder',
    'en': 'Reset your password — DzLeadsFinder',
}


@shared_task(  # type: ignore[misc]
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 1},
    retry_backoff=True,
)
def send_password_reset_email(user_id: int, token_id: int) -> None:
    """Send password reset email for the exact token issued by the request.

    Django imports are deferred to runtime: config/celery.py imports this
    module before the app registry is ready.
    """
    from django.conf import settings
    from django.contrib.auth import get_user_model
    from django.core.mail import EmailMultiAlternatives
    from django.utils import timezone

    from apps.accounts.models import (
        TOKEN_PURPOSE_RESET,
        SingleUseToken,
    )

    user_model = get_user_model()
    try:
        user = user_model.objects.get(pk=user_id)
    except user_model.DoesNotExist:
        logger.warning('send_password_reset_email: user %s not found', user_id)
        return
    try:
        token = SingleUseToken.objects.get(pk=token_id)
    except SingleUseToken.DoesNotExist:
        logger.warning('send_password_reset_email: token %s not found', token_id)
        return
    if (
        token.user_id != user_id
        or token.purpose != TOKEN_PURPOSE_RESET
        or token.consumed_at is not None
        or token.expires_at <= timezone.now()
    ):
        logger.warning('send_password_reset_email: token %s not usable', token_id)
        return
    reset_link = f'{settings.FRONTEND_PUBLIC_URL.rstrip("/")}/password-reset/{token.token}'
    locale = user.effective_locale
    html, plain_text = render_email(
        'password_reset',
        locale,
        {'resetLink': reset_link},
    )
    message = EmailMultiAlternatives(
        subject=RESET_SUBJECTS.get(locale, RESET_SUBJECTS['en']),
        body=plain_text or html,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    if plain_text:
        message.attach_alternative(html, 'text/html')
    else:
        message.content_subtype = 'html'
    message.send()


PAYMENT_RECEIPT_SUBJECTS = {
    'ar': {
        'creation': 'اشتراكك في DZLeads Starter نشط الآن',
        'renewal': 'تم تجديد اشتراكك في DZLeads Starter',
    },
    'fr': {
        'creation': 'Votre abonnement DZLeads Starter est actif',
        'renewal': 'Votre abonnement DZLeads Starter a été renouvelé',
    },
    'en': {
        'creation': 'Your DZLeads Starter subscription is active',
        'renewal': 'Your DZLeads Starter subscription has been renewed',
    },
}


@shared_task(  # type: ignore[misc]
    autoretry_for=(Exception,),
    max_retries=1,
    retry_backoff=True,
)
def send_payment_receipt(txn_id: str) -> None:
    """Send the localized payment receipt after a successful subscription
    payment (5.3 — replaces the 1.8 stub).

    Subject is localized per ``user.effective_locale`` and differentiated
    creation vs renewal; the body renders via the Next.js render route
    (PaymentReceipt component — locale + isRenewal props). Delegates to the
    shared ``_send_receipt`` pipeline (marker semantics, terminal settles).
    """
    _send_receipt(txn_id, pack=False, task='send_payment_receipt')


# The credit count in the subject is DERIVED from PACK_PRICES (the single
# price->credits table) — hand-typed prose drifted silently the moment the
# table changed. pricing.py is stdlib-only, so this module-level import is
# worker-safe (the celery pre-registry constraint).
_PACK_SUBJECT_TEMPLATES: Dict[str, str] = {
    'ar': 'تمت إضافة ائتمانات الحزمة — {credits} ائتمانًا، لا تنتهي صلاحيتها أبدًا',
    'fr': "Crédits de pack ajoutés — {credits} crédits, n'expirent jamais",
    'en': 'Pack credits added — {credits} credits, never expires',
}

PACK_RECEIPT_SUBJECTS: Dict[str, Dict[int, str]] = {
    locale: {
        price: template.format(credits=credits)
        for price, credits in PACK_PRICES.items()
    }
    for locale, template in _PACK_SUBJECT_TEMPLATES.items()
}

# Amount-free subjects for a row whose amount is not in PACK_PRICES (table
# drift): the email must stay truthful — the body carries the real
# creditsGranted — and ops gets a loud error instead of a borrowed subject.
GENERIC_PACK_RECEIPT_SUBJECTS: Dict[str, str] = {
    'ar': 'تمت إضافة ائتمانات الحزمة',
    'fr': 'Crédits de pack ajoutés',
    'en': 'Pack credits added',
}


@shared_task(  # type: ignore[misc]
    autoretry_for=(Exception,),
    max_retries=1,
    retry_backoff=True,
)
def send_pack_receipt(txn_id: str) -> None:
    """Send the localized pack receipt after a successful pack purchase (5.4).

    The 1.8-era stub becomes the real implementation. Subject per locale and
    per pack amount (latn numerals — the 5.3 subject precedent); the body
    renders via the Next.js render route (PaymentReceipt — isPack prop,
    packNote copy, Western numerals per AD-8). Delegates to the shared
    ``_send_receipt`` pipeline with the pack type gate.
    """
    _send_receipt(txn_id, pack=True, task='send_pack_receipt')


def _pack_subject(row: Any, locale: str) -> str:
    subject = PACK_RECEIPT_SUBJECTS.get(locale, PACK_RECEIPT_SUBJECTS['en']).get(
        row.amount_dzd
    )
    if subject is None:
        # The old fallback borrowed the 500-pack subject — a lying subject on
        # a payment email. An off-table amount now gets an amount-free
        # subject and a loud error; the body still shows the true credits.
        logger.error(
            'send_pack_receipt: amount %s not in PACK_PRICES — using generic '
            'subject (pricing table drift?)',
            row.amount_dzd,
        )
        subject = GENERIC_PACK_RECEIPT_SUBJECTS.get(
            locale, GENERIC_PACK_RECEIPT_SUBJECTS['en']
        )
    return subject


def _send_receipt(txn_id: str, *, pack: bool, task: str) -> None:
    """The shared receipt pipeline behind both Celery tasks.

    Django imports are deferred to runtime: config/celery.py imports this
    module before the app registry is ready.

    Marker semantics (5.4 review RP2/RP4): the ``receipt_sent_at`` marker is
    the dedupe key and is set BEFORE the send under the row lock (a
    concurrent sweep run sees the marker and skips — no double-send under
    queue backlog); a failing send CLEARS the marker before re-raising so
    the autoretry (and the resend sweep) can rescue the row. Terminal skips
    (wrong type for the variant, anonymised/deleted user) SET the marker —
    the sweep stops re-enqueueing rows that can never receive a receipt
    (the 5.3 P5 lesson, extended to receipts).

    Review RP7: a refunded/failed row must never get a receipt — the status
    guard is the contract. ``date`` is the raw ISO local date of the
    transaction; the template owns localized formatting (AD-8).
    """
    from django.conf import settings
    from django.contrib.auth import get_user_model
    from django.core.exceptions import ValidationError
    from django.core.mail import EmailMultiAlternatives
    from django.db import transaction
    from django.utils import timezone

    from apps.billing.models import PaymentStatus, PaymentTransaction, PaymentType

    with transaction.atomic():
        try:
            row = PaymentTransaction.objects.select_for_update().get(pk=txn_id)
        except (PaymentTransaction.DoesNotExist, ValueError, TypeError, ValidationError):
            logger.warning('%s: transaction %s not found', task, txn_id)
            return
        if row.status != PaymentStatus.SUCCEEDED:
            logger.warning(
                '%s: transaction %s status=%s — no receipt', task, txn_id, row.status
            )
            return
        if row.receipt_sent_at is not None:
            logger.info('%s: transaction %s already receipted — skip', task, txn_id)
            return
        if pack and row.type != PaymentType.PACK_PURCHASE:
            _settle_receipt(row, f'type {row.type} is not a pack purchase')
            return
        if row.user_id is None:
            _settle_receipt(row, 'anonymised user — receipt terminal')
            return
        user = get_user_model().objects.filter(pk=row.user_id).first()
        if user is None:
            _settle_receipt(row, 'user deleted — receipt terminal')
            return
        # Marker BEFORE send (5.4 review RP2 — reverses the D20 after-send
        # deviation; Winston's original ruling): a concurrent sweep run
        # serializes on the row lock and skips on the marker — no duplicates
        # under queue backlog. Cleared on failure below.
        _set_receipt_marker(row)

    locale = user.effective_locale
    context: Dict[str, Any] = {
        'amount': row.amount_dzd,
        'currency': 'DZD',
        'creditsGranted': row.credits_granted or 0,
        'date': timezone.localdate(row.created_at).isoformat(),
    }
    if pack:
        context['isPack'] = True
        subject = _pack_subject(row, locale)
    else:
        is_renewal = row.type == PaymentType.SUBSCRIPTION_RENEWAL
        context['isRenewal'] = is_renewal
        subject = PAYMENT_RECEIPT_SUBJECTS[locale]['renewal' if is_renewal else 'creation']
    try:
        html, plain_text = render_email('payment_receipt', locale, context)
        message = EmailMultiAlternatives(
            subject=subject,
            body=plain_text or html,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        if plain_text:
            message.attach_alternative(html, 'text/html')
        else:
            message.content_subtype = 'html'
        message.send()
    except Exception:
        _clear_receipt_marker(row)
        raise


def _set_receipt_marker(row: Any) -> None:
    """Marker BEFORE send (5.4 review RP2 — the dedupe key). The write is
    isolated: a marker-write failure must not crash the receipt task before
    the send (the sweep would then double-send — bounded by the documented
    AD-14 duplicate acceptance)."""
    from django.utils import timezone

    from apps.billing.models import PaymentTransaction

    try:
        PaymentTransaction.objects.filter(pk=row.pk).update(
            receipt_sent_at=timezone.now()
        )
    except Exception as exc:
        logger.error(
            'receipt marker SET failed for txn %s (%s: %s) — a sweep re-send '
            'may produce a duplicate (bounded, AD-14)',
            row.pk,
            type(exc).__name__,
            exc,
        )


def _clear_receipt_marker(row: Any) -> None:
    """A failing send clears the marker so the autoretry (and the resend
    sweep) re-run the send instead of skipping it."""
    from apps.billing.models import PaymentTransaction

    try:
        PaymentTransaction.objects.filter(pk=row.pk).update(receipt_sent_at=None)
    except Exception:
        logger.error(
            'receipt marker CLEAR failed for txn %s — the receipt cannot be '
            'retried automatically (ops must re-send)',
            row.pk,
        )


def _settle_receipt(row: Any, reason: str) -> None:
    """Terminal receipt state (5.4 review RP4): a row that can NEVER receive
    a receipt (anonymised/deleted user, wrong type) is marked receipted so
    the resend sweep stops re-enqueueing it hourly (the 5.3 P5 lesson)."""
    from django.utils import timezone

    from apps.billing.models import PaymentTransaction

    PaymentTransaction.objects.filter(pk=row.pk).update(
        receipt_sent_at=timezone.now()
    )
    logger.warning(
        'receipt for txn %s TERMINAL (%s) — marked receipted, sweep will skip',
        row.pk,
        reason,
    )


@shared_task  # type: ignore[misc]
def check_low_credits() -> None:
    """Daily check — warn users with low credit balance.

    TODO: Story 4.x — query users with low balance, send warning email.
    """
    logger.info('check_low_credits called (not yet implemented)')
