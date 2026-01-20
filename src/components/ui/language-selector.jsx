import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'uz', name: "O'zbekcha" },
    { code: 'ru', name: 'Русский' }
  ];

  const currentLanguage = languages.find(lang => lang.code === language) || languages[0];

  return (
    <Select value={language} onValueChange={setLanguage}>
      <SelectTrigger className="w-36">
        <Globe className="w-4 h-4 mr-2" />
        <SelectValue>{currentLanguage.name}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}