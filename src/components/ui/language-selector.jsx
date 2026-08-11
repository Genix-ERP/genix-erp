import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe, Check } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'uz', name: "O'zbekcha" },
  { code: 'ru', name: 'Русский' }
];

// compact: slim icon + language-code trigger for the app header.
// Default: full-width select used on the auth pages.
export default function LanguageSelector({ compact = false }) {
  const { language, setLanguage } = useLanguage();

  const currentLanguage = LANGUAGES.find(lang => lang.code === language) || LANGUAGES[0];

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 gap-1.5 px-2.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title={currentLanguage.name}
          >
            <Globe className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              {currentLanguage.code}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {LANGUAGES.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className="cursor-pointer justify-between"
            >
              <span>{lang.name}</span>
              {lang.code === language && <Check className="w-4 h-4 text-[var(--genix-blue,#0EA5E9)]" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Select value={language} onValueChange={setLanguage}>
      <SelectTrigger className="w-36">
        <Globe className="w-4 h-4 mr-2" />
        <SelectValue>{currentLanguage.name}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
