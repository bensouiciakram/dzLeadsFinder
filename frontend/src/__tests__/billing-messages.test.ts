import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import fr from '../../messages/fr.json'
import ar from '../../messages/ar.json'

type Messages = typeof en
type LocaleMessages = Record<string, unknown>

function get(messages: LocaleMessages, key: string): string {
  let node: unknown = messages
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) throw new Error(`missing ${key}`)
    node = (node as Record<string, unknown>)[part]
    if (node === undefined) throw new Error(`missing ${key}`)
  }
  if (typeof node !== 'string') throw new Error(`not a string: ${key}`)
  return node
}

// Sally's 5.5 copy contracts — every ▲ string pinned verbatim in all three
// locales (the D15/D24 mandate). A copy edit here without a test edit
// fails the suite.
const LOCALES: Array<[string, LocaleMessages]> = [
  ['en', en as unknown as LocaleMessages],
  ['fr', fr as unknown as LocaleMessages],
  ['ar', ar as unknown as LocaleMessages],
]

const PINNED: Record<string, [string, string, string]> = {
  // Plan Card states (AC verbatim + John's added states; review P1 — the
  // v4 tag syntax: <date>{d}</date> wraps the interpolated date value)
  'billing.plan.free_tier': ['Free tier', 'Forfait gratuit', 'الباقة المجانية'],
  'billing.plan.starter_title': [
    'Starter — 1,500 DZD/mo — renews on <date>{d}</date>',
    'Starter — 1,500 DZD/mois — renouvellement le <date>{d}</date>',
    'Starter — 1,500 د.ج/شهريًا — التجديد في <date>{d}</date>',
  ],
  'billing.plan.cancelled_title': [
    'Cancelled — access until <date>{d}</date>',
    "Annulé — accès jusqu'au <date>{d}</date>",
    'ملغاة — الوصول حتى <date>{d}</date>',
  ],
  'billing.plan.failed_title': [
    'Payment failed — access until <date>{d}</date>',
    "Paiement échoué — accès jusqu'au <date>{d}</date>",
    'فشل الدفع — الوصول حتى <date>{d}</date>',
  ],
  'billing.plan.expired_title': [
    'Subscription ended',
    'Abonnement terminé',
    'انتهى الاشتراك',
  ],
  'billing.plan.upgrade': ['Upgrade', 'Passer à Starter', 'الترقية إلى Starter'],
  'billing.plan.reactivate': ['Reactivate', 'Réactiver', 'إعادة التفعيل'],
  'billing.plan.retry_payment': ['Retry payment', 'Réessayer le paiement', 'إعادة محاولة الدفع'],
  'billing.plan.resubscribe': ['Resubscribe', 'Se réabonner', 'إعادة الاشتراك'],
  // Pack Cards (D15 verbatim)
  'billing.packs.never_expires': [
    'Never expires',
    "N'expire jamais",
    'لا تنتهي صلاحيتها أبدًا',
  ],
  'billing.packs.best_value': ['Best value', 'Meilleur rapport qualité/prix', 'أفضل قيمة'],
  'billing.packs.unit_price': ['{price} DZD/credit', '{price} DZD/crédit', '{price} د.ج/ائتمان'],
  // Danger Zone (AC verbatim; review P1 tag syntax)
  'billing.dzone.dialog_body': [
    'You will keep access until <date>{d}</date>. No refund for the current cycle.',
    "Vous garderez l'accès jusqu'au <date>{d}</date>. Aucun remboursement pour le cycle en cours.",
    'ستحتفظ بالوصول حتى <date>{d}</date>. لا يوجد استرداد للدورة الحالية.',
  ],
  'billing.dzone.cancel_button': [
    'Cancel subscription',
    "Annuler l'abonnement",
    'إلغاء الاشتراك',
  ],
  // History (type/status labels + failed-row surface)
  'billing.history.type_subscription_creation': ['Subscription', 'Abonnement', 'اشتراك'],
  'billing.history.type_subscription_renewal': [
    'Monthly renewal',
    'Renouvellement mensuel',
    'تجديد شهري',
  ],
  'billing.history.type_pack_purchase': [
    'Credit pack purchase',
    'Achat de pack de crédits',
    'شراء حزمة رصيد',
  ],
  'billing.history.status_pending': ['Pending', 'En attente', 'قيد الانتظار'],
  'billing.history.status_paid': ['Paid', 'Payé', 'مدفوع'],
  'billing.history.status_failed': ['Failed', 'Échoué', 'فشل'],
  'billing.history.status_refunded': ['Refunded', 'Remboursé', 'مسترد'],
  'billing.history.failed_note': [
    'Payment failed. Contact <support>support</support> if you were charged.',
    'Paiement échoué. Contactez <support>le support</support> si vous avez été débité.',
    'فشل الدفع. تواصل مع <support>الدعم</support> إذا تم خصم المبلغ.',
  ],
  // Status Card (Sally's 5.6 verbatim map; AC + EXPERIENCE.md:101-102 + D15)
  'billing.status.polling': [
    'Confirming payment…',
    'Confirmation du paiement…',
    'جارٍ تأكيد الدفع…',
  ],
  'billing.status.success_pack': [
    '{n} credits added — pack credits never expire',
    "{n} crédits ajoutés — les crédits de pack n'expirent jamais",
    'أُضيف {n} رصيدًا — أرصدة الحزم لا تنتهي صلاحيتها أبدًا',
  ],
  'billing.status.success_subscription': [
    '{n} credits added',
    '{n} crédits ajoutés',
    'أُضيف {n} رصيدًا',
  ],
  'billing.status.timeout': [
    'Payment received — credits will post shortly',
    'Paiement reçu — les crédits seront crédités sous peu',
    'تم استلام الدفع — سيتم إضافة الرصيد قريبًا',
  ],
  // 5.7 (Sally's verbatim map — the SubscriptionChip ×3, the persistent
  // failed-renewal banner, the single Upgrade Dialog; AC + EXPERIENCE.md
  // L95/L100/L120; the AR noun = نقطة for the plan family — M1 ruling;
  // review P1 tag syntax + P11 amendment copy)
  'billing.chip.free': [
    'Free — Upgrade',
    'Gratuit — Passer à Starter',
    'مجاني — الترقية إلى Starter',
  ],
  'billing.chip.starter': [
    'Starter — renews on <date>{d}</date>',
    'Starter — renouvellement le <date>{d}</date>',
    'Starter — التجديد في <date>{d}</date>',
  ],
  'billing.chip.failed': [
    'Starter — payment failed',
    'Starter — paiement échoué',
    'Starter — فشل الدفع',
  ],
  'billing.failed_renewal': [
    'Payment failed — <update>update your payment method to keep Starter</update>',
    'Paiement échoué — <update>mettez à jour votre moyen de paiement pour garder Starter</update>',
    'فشل الدفع — <update>حدِّث وسيلة الدفع للاحتفاظ بـ Starter</update>',
  ],
  'billing.upgrade_dialog.title': [
    'Upgrade to Starter',
    'Passer à Starter',
    'الترقية إلى Starter',
  ],
  'billing.upgrade_dialog.price': [
    '1,500 DZD/mo',
    '1,500 DZD/mois',
    '1,500 د.ج/شهريًا',
  ],
  'billing.upgrade_dialog.credits': [
    '200 credits/mo',
    '200 crédits/mois',
    '200 نقطة شهريًا',
  ],
  'billing.upgrade_dialog.cta': [
    'Subscribe via Chargily',
    "S'abonner via Chargily",
    'الاشتراك عبر Chargily',
  ],
}

describe('billing i18n copy contracts (×3 locales)', () => {
  for (const [localeName, messages] of LOCALES) {
    describe(localeName, () => {
      for (const [key, [expectedEn, expectedFr, expectedAr]] of Object.entries(PINNED)) {
        it(`pins ${key} verbatim`, () => {
          const expected = { en: expectedEn, fr: expectedFr, ar: expectedAr }[
            localeName as 'en' | 'fr' | 'ar'
          ]
          expect(get(messages, key)).toBe(expected)
        })
      }
    })
  }
})
