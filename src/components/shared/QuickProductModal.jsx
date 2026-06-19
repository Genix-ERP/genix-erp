import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Loader2, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { inventoryService } from "@/api/services/inventory";
import { formatPriceInput, parsePriceInput } from "@/utils/formatCurrency";
import apiClient from "@/api/client";

// QuickProductModal — "create a product without leaving the flow" dialog.
// Captures the fields that matter for a usable product: name, type, the finance
// accounting type (inventory_type), category, unit of measure, plus a couple of
// common optionals (SKU, purchase price). `code` is auto-generated. The created
// product is returned via onCreated so it can be selected straight away. For
// full setup (barcode, variants, dimensions, multiple companies) users still
// use the Products page.
//
// Props:
//   open, onClose
//   initialName  — prefill (e.g. the text the user typed in the search)
//   organizationIds — companies to link the product to (REQUIRED for it to show
//     in that company's product list). Pass the active company's id.
//   onCreated(product) — called with the newly created product
//   t — translator
export default function QuickProductModal({ open, onClose, initialName = "", organizationIds = [], onCreated, t = (k) => k }) {
  const [name, setName] = useState(initialName);
  const [costPrice, setCostPrice] = useState("");
  const [type, setType] = useState("product");
  // Finance accounting type (matches the full form's "Tovar turi (buxgalteriya)").
  const [inventoryType, setInventoryType] = useState("trade");
  const [categoryId, setCategoryId] = useState("none");
  const [catOpen, setCatOpen] = useState(false);
  const [uom, setUom] = useState("unit");
  const [categories, setCategories] = useState([]);
  const [uomList, setUomList] = useState([]);
  const [saving, setSaving] = useState(false);

  // Reseed on open + load categories / units of measure.
  useEffect(() => {
    if (!open) return;
    setName(initialName || "");
    setCostPrice("");
    setType("product");
    setInventoryType("trade");
    setCategoryId("none");
    setUom("unit");

    let cancelled = false;
    (async () => {
      try {
        const cats = await inventoryService.listCategories({ limit: 500 });
        if (!cancelled) setCategories(Array.isArray(cats) ? cats : (cats?.data || cats?.items || []));
      } catch { /* non-fatal — category stays optional */ }
      try {
        const res = await apiClient.get('/units-of-measure', { params: { limit: 200 } });
        if (!cancelled) setUomList(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch { /* non-fatal — falls back to 'unit' */ }
    })();
    return () => { cancelled = true; };
  }, [open, initialName]);

  // Keep the accounting type sensible when the product/service type changes:
  // a service is always inventory_type 'service'; a product defaults to 'trade'.
  const onTypeChange = (value) => {
    setType(value);
    if (value === 'service') setInventoryType('service');
    else setInventoryType('trade');
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t('name_required') || "Nom kerak");
      return;
    }
    setSaving(true);
    try {
      // Backend requires a unique `code`; build one from the name slug + a short
      // timestamp suffix so quick-created products don't collide.
      const slug = trimmed.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'PROD';
      const code = `${slug}-${Date.now().toString().slice(-5)}`;
      const cost = parseFloat(parsePriceInput(String(costPrice))) || 0;
      const payload = {
        name: trimmed,
        code,
        type,
        inventory_type: type === 'service' ? 'service' : inventoryType,
        cost_price: cost,
        list_price: cost,
        inventory_uom: uom,
        sales_uom: uom,
        purchase_uom: uom,
        organization_ids: Array.isArray(organizationIds) ? organizationIds.filter(Boolean) : [],
      };
      if (categoryId && categoryId !== 'none') payload.category_id = categoryId;
      const newProduct = await inventoryService.createProduct(payload);
      toast.success(t('product_created') || "Mahsulot yaratildi");
      onCreated?.(newProduct);
      onClose?.();
    } catch (e) {
      // The backend uses several error envelope shapes:
      //   { error: "string" } | { error: { code, message } } | { message }
      // toast.error must receive a STRING — passing the {code,message} object
      // straight through crashes React ("Objects are not valid as a React child").
      const data = e?.response?.data || {};
      let msg = (typeof data.error === 'string' ? data.error : data.error?.message)
        || data.message
        || e?.message
        || (t('error_occurred') || "Xatolik");
      // Translate the common backend conflict messages (they come back in English).
      if (/SKU already exists/i.test(msg)) msg = t('sku_exists') || "Bu SKU allaqachon mavjud";
      else if (/barcode already exists/i.test(msg)) msg = t('barcode_exists') || "Bu shtrix-kod allaqachon mavjud";
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose?.()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('add_new_product') || "Yangi mahsulot qo'shish"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label htmlFor="qp-name">{t('product_name') || t('name') || "Nomi"} *</Label>
            <Input
              id="qp-name"
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('type') || "Turi"}</Label>
              <Select value={type} onValueChange={onTypeChange}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">{t('product') || "Mahsulot"}</SelectItem>
                  <SelectItem value="service">{t('service') || "Xizmat"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('unit_of_measure') || "O'lchov birligi"}</Label>
              <Select value={uom} onValueChange={setUom}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {uomList.length === 0 && <SelectItem value="unit">Unit</SelectItem>}
                  {uomList.map((u) => (
                    <SelectItem key={u.code} value={u.code}>{u.name} ({u.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Finance accounting type — only meaningful for stockable products. */}
          {type === 'product' && (
            <div>
              <Label>Tovar turi (buxgalteriya)</Label>
              <Select value={inventoryType} onValueChange={setInventoryType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trade">Sotish uchun tovar (1340)</SelectItem>
                  <SelectItem value="raw">Xom ashyo (1310)</SelectItem>
                  <SelectItem value="finished">Tayyor mahsulot (1330)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>{t('category') || "Kategoriya"}</Label>
            <Popover open={catOpen} onOpenChange={setCatOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={catOpen}
                  className="mt-1 w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {categoryId !== 'none'
                      ? (categories.find((c) => c.id === categoryId)?.name || (t('none') || "Yo'q"))
                      : (t('none') || "Yo'q")}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              {/* noPortal: rendered inside a Radix Dialog, so keep the popover
                  in-tree or its wheel/scroll events get blocked by the dialog. */}
              <PopoverContent noPortal className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('search') || "Qidirish..."} />
                  <CommandList style={{ maxHeight: 240, overflowY: 'auto' }}>
                    <CommandEmpty>{t('not_found') || "Topilmadi"}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value={t('none') || "Yo'q"}
                        onSelect={() => { setCategoryId('none'); setCatOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", categoryId === 'none' ? "opacity-100" : "opacity-0")} />
                        {t('none') || "Yo'q"}
                      </CommandItem>
                      {categories.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => { setCategoryId(c.id); setCatOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", categoryId === c.id ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{c.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="qp-cost">{t('cost_price') || "Narx"}</Label>
            <Input id="qp-cost" className="mt-1" inputMode="decimal" value={costPrice} onChange={(e) => setCostPrice(formatPriceInput(e.target.value))} />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onClose?.()} disabled={saving}>
            {t('cancel') || "Bekor qilish"}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('create') || "Yaratish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
