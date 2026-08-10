import logging
from typing import Any, Dict, Tuple

import requests
from celery import shared_task

logger = logging.getLogger(__name__)

NEXTJS_INTERNAL_URL = 'http://nextjs:3000'


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

    from apps.accounts.models import SingleUseToken

    user_model = get_user_model()
    try:
        user = user_model.objects.get(pk=user_id)
    except user_model.DoesNotExist:
        logger.warning('send_verification_email: user %s not found', user_id)
        return
    token = (
        SingleUseToken.objects.filter(
            user=user,
            purpose='verify',
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
        user.locale,
        {'verificationLink': verification_link},
    )
    message = EmailMultiAlternatives(
        subject='Verify your email — dzLeadsFinder',
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
    'ar': 'إعادة تعيين كلمة المرور — dzLeadsFinder',
    'fr': 'Réinitialisation de votre mot de passe — dzLeadsFinder',
    'en': 'Reset your password — dzLeadsFinder',
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

    from apps.accounts.models import SingleUseToken

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
        or token.purpose != 'reset'
        or token.consumed_at is not None
        or token.expires_at <= timezone.now()
    ):
        logger.warning('send_password_reset_email: token %s not usable', token_id)
        return
    reset_link = f'{settings.FRONTEND_PUBLIC_URL.rstrip("/")}/password-reset/{token.token}'
    html, plain_text = render_email(
        'password_reset',
        user.locale,
        {'resetLink': reset_link},
    )
    message = EmailMultiAlternatives(
        subject=RESET_SUBJECTS.get(user.locale, RESET_SUBJECTS['en']),
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

    Django imports are deferred to runtime: config/celery.py imports this
    module before the app registry is ready. The subject is localized per
    ``user.effective_locale`` and differentiated creation vs renewal; the
    body renders via the Next.js render route (PaymentReceipt component —
    locale + isRenewal props). ``date`` is the raw ISO local date of the
    transaction; the template owns localized formatting (AD-8).
    """
    from django.conf import settings
    from django.contrib.auth import get_user_model
    from django.core.exceptions import ValidationError
    from django.core.mail import EmailMultiAlternatives
    from django.utils import timezone

    from apps.billing.models import PaymentTransaction

    try:
        row = PaymentTransaction.objects.get(pk=txn_id)
    except (PaymentTransaction.DoesNotExist, ValueError, TypeError, ValidationError):
        logger.warning('send_payment_receipt: transaction %s not found', txn_id)
        return
    if row.user_id is None:
        logger.warning(
            'send_payment_receipt: transaction %s has no user (anonymised) — skip',
            txn_id,
        )
        return
    user = get_user_model().objects.filter(pk=row.user_id).first()
    if user is None:
        logger.warning(
            'send_payment_receipt: user %s for transaction %s not found — skip',
            row.user_id,
            txn_id,
        )
        return
    is_renewal = row.type == 'subscription_renewal'
    locale = user.effective_locale
    variant = 'renewal' if is_renewal else 'creation'
    subject = PAYMENT_RECEIPT_SUBJECTS[locale][variant]
    html, plain_text = render_email(
        'payment_receipt',
        locale,
        {
            'amount': row.amount_dzd,
            'currency': 'DZD',
            'creditsGranted': row.credits_granted or 0,
            'date': timezone.localdate(row.created_at).isoformat(),
            'isRenewal': is_renewal,
        },
    )
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


@shared_task  # type: ignore[misc]
def send_pack_receipt(txn_id: str) -> None:
    """Send pack receipt after credit pack purchase.

    TODO: Story 5.x — fetch transaction + user, build context, render, send.
    """
    logger.info('send_pack_receipt called for txn_id=%s (not yet implemented)', txn_id)


@shared_task  # type: ignore[misc]
def check_low_credits() -> None:
    """Daily check — warn users with low credit balance.

    TODO: Story 4.x — query users with low balance, send warning email.
    """
    logger.info('check_low_credits called (not yet implemented)')
