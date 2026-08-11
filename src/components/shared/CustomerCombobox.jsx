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

export default function CustomerCombobox({ customers: initialCustomers = [], value, onValueChange, placeholder = "Mijozni tanlang", t = (k) => k }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSelected, setLastSelected] = useState(null);
  const debounceRef = useRef(null);

  // Same first-page-on-open behaviour as ProductCombobox, for the same
  // reason: a parent that passes no customers produced a dropdown that sat
  // empty until two characters were typed.
  const [initialFetch, setInitialFetch] = useState([]);
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (!open || initialCustomers.length > 0 || fetchedRef.current) return;
    fetchedRef.current = true;
    setIsSearching(true);
    apiClient.get('/contacts', { params: { limit: 50, type: 'customer' } })
      .then((res) => {
        const data = res.data?.data || res.data || [];
        setInitialFetch(Array.isArray(data) ? data : data.items || []);
      })
      .catch(() => {})
      .finally(() => setIsSearching(false));
  }, [open, initialCustomers.length]);

  // Use initial customers when no search, search results when searching
  const displayCustomers = search.length >= 2
    ? searchResults
    : (initialCustomers.length > 0 ? initialCustomers : initialFetch);
  const selectedCustomer = [...initialCustomers, ...initialFetch, ...searchResults, ...(lastSelected ? [lastSelected] : [])].find((c) => c.id === value);

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
        const res = await apiClient.get('/contacts', { params: { search, limit: 50, type: 'customer' } });
        const data = res.data?.data || res.data || [];
        setSearchResults(Array.isArray(data) ? data : data.items || []);
      } catch {
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const getDisplayName = (customer) => {
    return customer?.company_name || customer?.name || '';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9 px-3 text-sm"
        >
          <span className="truncate">
            {selectedCustomer ? getDisplayName(selectedCustomer) : placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
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
            ) : displayCustomers.length === 0 ? (
              <CommandEmpty>{search.length >= 2 ? (t('not_found') || "Topilmadi") : (t('type_to_search') || "Qidirish uchun yozing...")}</CommandEmpty>
            ) : (
              <CommandGroup>
                {displayCustomers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => {
                      setLastSelected(customer);
                      onValueChange(customer.id, customer);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === customer.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{getDisplayName(customer)}</span>
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
