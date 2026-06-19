import { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import apiClient from "@/api/client";

// `valueLabel` (optional): pre-known display name for the current `value`.
// Use this when the parent has the product's name in hand (e.g. fetched
// alongside an order line) but the product itself isn't in `products` —
// happens on edit screens where `products` is paginated or filtered by
// org and may not include the line's product. Without this fallback
// the combobox renders the placeholder even when a real id is selected.
// `onCreateNew` (optional): when provided, a "+ create product" action is shown
// at the bottom of the list. It receives the current search text so the parent
// can prefill the new product's name. The parent owns the create modal and is
// responsible for adding the new product to `products` and selecting it.
export default function ProductCombobox({ products: initialProducts = [], value, valueLabel, onValueChange, onCreateNew, placeholder = "Mahsulot tanlang", t = (k) => k }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  // Remember the last selected product so the label stays after search clears
  const [lastSelected, setLastSelected] = useState(null);
  const debounceRef = useRef(null);

  // Use initial products when no search, search results when searching
  const displayProducts = search.length >= 2 ? searchResults : initialProducts;
  const selectedProduct = [...initialProducts, ...searchResults, ...(lastSelected ? [lastSelected] : [])].find((p) => p.id === value);

  // Clear lastSelected when value is externally cleared
  useEffect(() => {
    if (!value) setLastSelected(null);
  }, [value]);

  // Server-side search with debounce
  useEffect(() => {
    if (search.length < 2) {
      setSearchResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiClient.get('/products', { params: { search, limit: 50 } });
        setSearchResults(res.data?.data || []);
      } catch {
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          // Truncation chain that actually works inside a flex row
          // with an unconstrained Tailwind Button:
          //  - max-w-full + overflow-hidden on the Button itself
          //    (so it can never exceed its column even if a child
          //    insists on its intrinsic width)
          //  - inline style on the span: min-width:0, flex:1,
          //    overflow:hidden, text-overflow:ellipsis, white-space:nowrap
          //    (Tailwind's `truncate` sometimes loses to shadcn
          //    Button's intrinsic flex-children sizing — explicit
          //    inline styles win every cascade fight)
          className="w-full max-w-full overflow-hidden justify-between font-normal h-9 px-3 text-sm"
        >
          <span
            className="text-left"
            style={{
              minWidth: 0,
              flex: '1 1 0%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
            }}
          >
            {selectedProduct ? selectedProduct.name : (value && valueLabel ? valueLabel : placeholder)}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      {/* noPortal=true: ProductCombobox is almost always used inside a
          Radix Dialog (sales order modal, purchase order modal, stock
          transfer modal, ...). When the popover renders through the
          default Portal, it lands outside the Dialog tree where
          react-remove-scroll (used by Radix Dialog) blocks wheel
          events — the list looks scrollable but mouse wheel does
          nothing. Rendering inline keeps it as a descendant of the
          Dialog so wheel events flow through.
          See popover.jsx for the noPortal escape hatch. */}
      <PopoverContent noPortal className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('search') || "Qidirish..."}
            value={search}
            onValueChange={setSearch}
          />
          {/* Inline style (rather than className) so we beat cmdk's
              default `max-h-[300px]` regardless of Tailwind class ordering.
              className was getting silently overridden inside the dialog
              and the list stayed un-scrollable past the first ~9 items. */}
          <CommandList style={{ maxHeight: 240, overflowY: 'auto' }}>
            {isSearching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="px-2 py-4 text-center">
                <p className="text-sm text-slate-500">
                  {search.length >= 2 ? (t('not_found') || "Topilmadi") : (t('type_to_search') || "Qidirish uchun yozing...")}
                </p>
                {onCreateNew && (
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
                    onClick={() => { const q = search; setOpen(false); setSearch(""); onCreateNew(q); }}
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="truncate max-w-[240px]">
                      {(t('add_new_product') || "Yangi mahsulot qo'shish")}{search.trim() ? `: "${search.trim()}"` : ''}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <CommandGroup>
                {displayProducts.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    // Native HTML tooltip — reveals the full product name on
                    // hover when the truncated label hides part of it.
                    title={product.name}
                    // Inline styles so the row clips inside the popover
                    // width and the child span actually truncates. Without
                    // overflow:hidden + min-width:0 on a flex child, the
                    // text just extends past the container and Tailwind's
                    // `truncate` becomes a no-op.
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      overflow: 'hidden',
                      minWidth: 0,
                    }}
                    onSelect={() => {
                      setLastSelected(product);
                      onValueChange(product.id, product);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === product.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span
                      style={{
                        minWidth: 0,
                        flex: '1 1 0%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {product.name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          {onCreateNew && displayProducts.length > 0 && (
            <div className="border-t p-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm text-teal-700 hover:bg-teal-50"
                onClick={() => {
                  const q = search;
                  setOpen(false);
                  setSearch("");
                  onCreateNew(q);
                }}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {(t('add_new_product') || "Yangi mahsulot qo'shish")}
                  {search.trim() ? `: "${search.trim()}"` : ''}
                </span>
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
