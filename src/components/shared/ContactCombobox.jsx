import { useState, useEffect, useRef, useMemo } from "react";
import { Check, ChevronDown, Loader2, User } from "lucide-react";
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

// The searchable customer/supplier picker used by every Sales and Purchase
// document form.
//
// Two shapes of contact reach this component and it has to render both:
//
//   - the raw /contacts payload   → { name, contact_person, legal_name,
//                                     contact_persons: [...] }
//   - the app's pre-mapped lists  → customers carry { company_name,
//                                     contact_name }, suppliers { name,
//                                     contact_person, status }
//
// so every accessor below checks the aliases rather than assuming one shape.

const displayName = (contact) =>
  contact?.company_name || contact?.name || "";

// Every field that can hold the name of a person who works at this company.
// The person lives in a different column depending on which form created the
// contact — see migration 506 for why.
const personNames = (contact) => {
  if (!contact) return [];
  const names = [
    contact.contact_person,
    contact.contact_name,
    contact.legal_name,
    ...(Array.isArray(contact.contact_persons)
      ? contact.contact_persons.map((p) =>
          [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim()
        )
      : []),
  ];
  // A contact whose "person" field just repeats the company name (the customer
  // form defaults legal_name that way) would render a pointless second line.
  const company = displayName(contact).trim().toLowerCase();
  return names
    .map((n) => (typeof n === "string" ? n.trim() : ""))
    .filter((n) => n && n.toLowerCase() !== company);
};

// The person line to show under the company name: whoever the typed term
// actually matched, so a hit on a name the company row does not contain still
// explains itself. Falls back to the first known person.
const personLine = (contact, term) => {
  const names = personNames(contact);
  if (names.length === 0) return "";
  const needle = term.trim().toLowerCase();
  if (needle) {
    const hit = names.find((n) => n.toLowerCase().includes(needle));
    if (hit) return hit;
  }
  return names[0];
};

// Client-side equivalent of the server's search, used for instant feedback on
// the already-loaded page before the debounced request lands.
const matchesLocally = (contact, term) => {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    displayName(contact),
    contact?.code,
    contact?.email,
    contact?.phone,
    contact?.tax_id,
    ...personNames(contact),
  ];
  return haystack.some(
    (v) => typeof v === "string" && v.toLowerCase().includes(needle)
  );
};

export default function ContactCombobox({
  type = "customer",
  contacts: initialContacts = [],
  value,
  onValueChange,
  placeholder,
  disabled = false,
  activeOnly = false,
  className,
  t = (k) => k,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSelected, setLastSelected] = useState(null);
  const [initialFetch, setInitialFetch] = useState([]);
  const debounceRef = useRef(null);
  const fetchedRef = useRef(false);

  // A parent that passes no list of its own would otherwise show an empty
  // dropdown until something is typed. Fetch the first page on first open.
  useEffect(() => {
    if (!open || initialContacts.length > 0 || fetchedRef.current) return;
    fetchedRef.current = true;
    setIsSearching(true);
    apiClient
      .get("/contacts", { params: { limit: 50, type } })
      .then((res) => {
        const data = res.data?.data || res.data || [];
        setInitialFetch(Array.isArray(data) ? data : data.items || []);
      })
      .catch(() => {})
      .finally(() => setIsSearching(false));
  }, [open, initialContacts.length, type]);

  // Server-side search, debounced. Below two characters the local list is
  // filtered instead, so the first keystroke still narrows something.
  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiClient.get("/contacts", {
          params: { search: search.trim(), limit: 50, type },
        });
        const data = res.data?.data || res.data || [];
        setSearchResults(Array.isArray(data) ? data : data.items || []);
      } catch {
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, type]);

  const baseList = initialContacts.length > 0 ? initialContacts : initialFetch;

  const visible = useMemo(() => {
    const term = search.trim();
    let list;
    if (term.length >= 2) {
      list = searchResults;
    } else if (term.length === 1) {
      list = baseList.filter((ct) => matchesLocally(ct, term));
    } else {
      list = baseList;
    }
    if (activeOnly) {
      list = list.filter(
        (ct) => ct?.is_active !== false && ct?.status !== "inactive"
      );
    }
    return list;
  }, [search, searchResults, baseList, activeOnly]);

  // The selected contact may have come from a search page that is no longer
  // loaded, so remember it explicitly or the trigger falls back to the
  // placeholder after the dropdown closes.
  const selected = useMemo(
    () =>
      [...initialContacts, ...initialFetch, ...searchResults, ...(lastSelected ? [lastSelected] : [])]
        .find((ct) => ct.id === value),
    [initialContacts, initialFetch, searchResults, lastSelected, value]
  );

  useEffect(() => {
    if (!value) setLastSelected(null);
  }, [value]);

  const fallbackPlaceholder =
    type === "vendor"
      ? t("select_supplier") || "Yetkazib beruvchini tanlang"
      : t("select_customer") || "Mijozni tanlang";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-9 px-3 text-sm",
            !selected && "text-slate-500",
            className
          )}
        >
          <span className="truncate">
            {selected ? displayName(selected) : placeholder || fallbackPlaceholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        {/* shouldFilter={false}: the server already decided what matches, and
            cmdk's own fuzzy filter would drop rows matched by contact person. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("contact_search_placeholder") || "Nomi yoki xodim ismi..."}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isSearching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : visible.length === 0 ? (
              <CommandEmpty>{t("not_found") || "Topilmadi"}</CommandEmpty>
            ) : (
              <CommandGroup>
                {visible.map((contact) => {
                  const person = personLine(contact, search);
                  return (
                    <CommandItem
                      key={contact.id}
                      value={contact.id}
                      onSelect={() => {
                        setLastSelected(contact);
                        onValueChange(contact.id, contact);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          value === contact.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{displayName(contact)}</div>
                        {person && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
                            <User className="w-3 h-3 shrink-0" />
                            <span className="truncate">{person}</span>
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
