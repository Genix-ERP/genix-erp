import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Award, Building2, ShoppingCart, PackageSearch } from 'lucide-react';
import ProductCombobox from '@/components/shared/ProductCombobox';
import { procurementService } from '@/api/services/procurement';
import { inventoryService } from '@/api/services/inventory';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { ChartCard, EmptyNote } from '@/components/shared/DashboardKit';

// Narxlarni solishtirish — pick a product, see every supplier's price side
// by side. Rows merge two REAL sources per supplier (the old version of
// this tab was a client-side scratchpad with no API calls at all):
//   1. /vendor-prices         — negotiated price-list entries (min qty, lead time)
//   2. /price-history?grouped — actual purchase-history prices (latest + date)
export default function PriceComparison() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const [, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [vendorPrices, setVendorPrices] = useState([]);
  const [historyGroups, setHistoryGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    inventoryService
      .listProducts({ limit: 200 })
      .then((data) => setProducts(Array.isArray(data) ? data : data?.items || []))
      .catch((e) => console.error('Failed to fetch products:', e));
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);

  useEffect(() => {
    if (!productId) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      procurementService.listVendorPrices({ product_id: productId }).catch(() => []),
      procurementService.listPriceHistoryGrouped().catch(() => []),
    ])
      .then(([vp, hist]) => {
        if (!alive) return;
        setVendorPrices(Array.isArray(vp) ? vp : []);
        setHistoryGroups(Array.isArray(hist) ? hist : []);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [productId]);

  // One row per supplier: pricelist entry and/or latest history price.
  const rows = useMemo(() => {
    if (!productId) return [];
    const bySupplier = new Map();

    vendorPrices.forEach((vp) => {
      const key = vp.vendor_id || vp.vendor_name;
      if (!key) return;
      bySupplier.set(key, {
        supplierName: vp.vendor_name || '—',
        listPrice: parseFloat(vp.price) || 0,
        currency: vp.currency,
        minQty: vp.min_quantity,
        leadTimeDays: vp.lead_time_days,
        historyPrice: null,
        historyDate: null,
      });
    });

    const productName = selectedProduct?.name;
    historyGroups
      .filter((g) => productName && g.product_name === productName)
      .forEach((g) => {
        const sorted = [...(g.prices || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latest = sorted[0];
        if (!latest) return;
        const key = g.supplier_id || g.supplier_name;
        const row = bySupplier.get(key) || {
          supplierName: g.supplier_name || '—',
          listPrice: null,
          currency: latest.currency,
          minQty: null,
          leadTimeDays: null,
          historyPrice: null,
          historyDate: null,
        };
        row.historyPrice = parseFloat(latest.price) || 0;
        row.historyDate = latest.date;
        bySupplier.set(key, row);
      });

    const list = [...bySupplier.values()]
      .map((r) => ({
        ...r,
        // effective price for ranking: pricelist first, else last purchase
        effective: r.listPrice != null && r.listPrice > 0 ? r.listPrice : r.historyPrice,
      }))
      .filter((r) => r.effective != null && r.effective > 0);

    list.sort((a, b) => a.effective - b.effective);
    return list;
  }, [productId, vendorPrices, historyGroups, selectedProduct]);

  const bestPrice = rows[0]?.effective;
  const fmtDate = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  };

  return (
    <ChartCard title={t('price_comparison') || 'Narxlarni solishtirish'} icon={Award}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-80">
            <ProductCombobox
              products={products}
              value={productId}
              onValueChange={setProductId}
              placeholder={t('select_product') || 'Mahsulot tanlang'}
              t={t}
            />
          </div>
          {productId && rows.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setSearchParams({ tab: 'orders' }, { replace: true })}
            >
              <ShoppingCart className="w-4 h-4" />
              {t('create_po_at_price') || 'Buyurtma yaratish'}
            </Button>
          )}
        </div>

        {!productId ? (
          <EmptyNote
            icon={PackageSearch}
            text={t('price_comparison_pick_product') || "Mahsulot tanlang — yetkazib beruvchilar narxlari yonma-yon ko'rinadi"}
          />
        ) : loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyNote
            icon={Building2}
            text={t('price_comparison_empty') || "Bu mahsulot uchun narx ma'lumotlari topilmadi — narx ro'yxati yoki xarid tarixi kerak"}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('supplier') || 'Yetkazib beruvchi'}</TableHead>
                  <TableHead className="text-right">{t('pricelist_price') || "Ro'yxat narxi"}</TableHead>
                  <TableHead className="text-right">{t('last_purchase_price') || 'Oxirgi xarid narxi'}</TableHead>
                  <TableHead>{t('last_purchase_date') || 'Oxirgi xarid sanasi'}</TableHead>
                  <TableHead className="text-right">{t('min_quantity') || 'Min. miqdor'}</TableHead>
                  <TableHead className="text-right">{t('lead_time_days') || 'Yetkazish (kun)'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={r.effective === bestPrice ? 'bg-emerald-50/60' : ''}>
                    <TableCell className="font-medium text-slate-800">
                      <span className="inline-flex items-center gap-1.5">
                        {r.supplierName}
                        {r.effective === bestPrice && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold uppercase">
                            {t('best_price') || 'Eng arzon'}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.listPrice != null && r.listPrice > 0 ? formatCurrency(r.listPrice, r.currency) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.historyPrice != null ? formatCurrency(r.historyPrice, r.currency) : '—'}
                    </TableCell>
                    <TableCell className="text-slate-500">{fmtDate(r.historyDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.minQty ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.leadTimeDays ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </ChartCard>
  );
}
