import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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

export default function AccountCombobox({ accounts = [], value, onValueChange, placeholder = "Hisobni tanlang", allowNone = false, noneLabel = "Yo'q", disabled = false }) {
  const [open, setOpen] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal h-9 px-3 text-sm"
        >
          <span className="truncate">
            {selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : (value && value !== 'none' ? value : placeholder)}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Qidirish..." />
          <CommandList>
            <CommandEmpty>Topilmadi</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value={noneLabel}
                  onSelect={() => {
                    onValueChange('');
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value || value === 'none' ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {noneLabel}
                </CommandItem>
              )}
              {accounts.map((account) => (
                <CommandItem
                  key={account.id}
                  value={`${account.code} - ${account.name}`}
                  onSelect={() => {
                    onValueChange(account.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === account.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {account.code} - {account.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
