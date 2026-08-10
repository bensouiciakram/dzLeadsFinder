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
  // Plan Card states (AC verbatim + John's added states)
  'billing.plan.free_tier': ['Free tier', 'Forfait gratuit', 'الباقة المجانية'],
  'billing.plan.starter_title': [
    'Starter — 1,500 DZD/mo — renews on {date}',
    'Starter — 1,500 DZD/mois — renouvellement le {date}',
    'Starter — 1,500 د.ج/شهريًا — التجديد في {date}',
  ],
  'billing.plan.cancelled_title': [
    'Cancelled — access until {date}',
    "Annulé — accès jusqu'au {date}",
    'ملغاة — الوصول حتى {date}',
  ],
  'billing.plan.failed_title': [
    'Payment failed — access until {date}',
    "Paiement échoué — accès jusqu'au {date}",
    'فشل الدفع — الوصول حتى {date}',
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
  // Danger Zone (AC verbatim)
  'billing.dzone.dialog_body': [
    'You will keep access until {date}. No refund for the current cycle.',
    "Vous garderez l'accès jusqu'au {date}. Aucun remboursement pour le cycle en cours.",
    'ستحتفظ بالوصول حتى {date}. لا يوجد استرداد للدورة الحالية.',
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
