import apiClient from '@/api/client';

// Zaxiralarni baholash — reja §5 ekranlari uchun API qatlami.
//
// Backend allaqachon tayyor edi (484/485-migratsiyalar, FIFO/AVCO/Standard
// dvigateli, qulflar, hisobotlar), lekin frontendda birorta ekran uni
// chaqirmasdi. Bu fayl — o'sha yetishmayotgan bo'g'in.
//
// Barcha summalar so'mda qaytadi (backend tiyinda hisoblab, chegarada
// bo'ladi), miqdorlar — 4 xonagacha.

const unwrap = (res) => res.data?.data ?? res.data;

export const stockValuationService = {
  // §1.3 — "Ombor ↔ buxgalteriya solishtiruvi". Qatlamlar yig'indisi 2910
  // qoldig'i bilan tiyinigacha teng bo'lishi kerak; farq bo'lsa, qaysi
  // schyotda ekanini ko'rsatadi.
  async getReconciliation(params = {}) {
    return unwrap(await apiClient.get('/inventory/valuation/reconciliation', { params }));
  },

  // §3.4 — "Zaxiralar bahosi": sanaga tovar kesimida qoldiq va qiymat.
  async getValuationReport(params = {}) {
    return unwrap(await apiClient.get('/inventory/valuation/report', { params }));
  },

  // §5 — "Sotuv tannarxi / marja"ning tannarx tomoni.
  async getMarginReport(params = {}) {
    return unwrap(await apiClient.get('/inventory/valuation/margin', { params }));
  },

  // §6 — "Qoldiqlarni kiritish". GET faqat ko'rsatadi, POST esa yozadi VA
  // tegilgan kategoriyalarning usulini qulflaydi.
  async getOpeningPreview(params = {}) {
    return unwrap(await apiClient.get('/inventory/valuation/opening-balance', { params }));
  },

  async postOpeningBalance(payload) {
    return unwrap(await apiClient.post('/inventory/valuation/opening-balance', payload));
  },

  // §2.1 — usulni hali o'zgartirsa bo'ladimi va bo'lmasa nega.
  async getCategoryMethodLock(categoryId) {
    return unwrap(await apiClient.get(`/product-categories/${categoryId}/method-lock`));
  },

  // §3.3 — standart narx va uning tarixi.
  async getStandardCost(productId) {
    return unwrap(await apiClient.get(`/products/${productId}/standard-cost`));
  },

  // DIQQAT: bu maydonni tahrirlash emas, QAYTA BAHOLASH hujjati — qoldiq
  // nol bo'lmasa provodka yaratadi (§3.3).
  async updateStandardCost(productId, payload) {
    return unwrap(await apiClient.put(`/products/${productId}/standard-cost`, payload));
  },
};

export default stockValuationService;
