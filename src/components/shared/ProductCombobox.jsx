import { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import apiClient from "@/api/client";

export default function ProductCombobox({ products: initialProducts = [], value, onValueChange, placeholder = "Mahsulot tanlang", t = (k) => k }) {
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
          // overflow-hidden + the inner min-w-0 flex-1 + truncate
          // are all required so a long product name like
          // "АНКЕРНЫЕ ДЕТАЛИ ИЗ ПРЯМЫХ ИЛИ ГНУТЫХ КРУГЛ..." gets
          // ellipsis-truncated instead of stretching the button (and
          // the entire line-item row, which then overflows the
          // create-PO modal).
          className="w-full justify-between font-normal h-9 px-3 text-sm overflow-hidden"
        >
          <span className="truncate min-w-0 flex-1 text-left">
            {selectedProduct ? selectedProduct.name : placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('search') || "Qidirish..."}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isSearching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : displayProducts.length === 0 ? (
              <CommandEmpty>{search.length >= 2 ? (t('not_found') || "Topilmadi") : (t('type_to_search') || "Qidirish uchun yozing...")}</CommandEmpty>
            ) : (
              <CommandGroup>
                {displayProducts.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => {
                      setLastSelected(product);
                      onValueChange(product.id, product);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === product.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{product.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
