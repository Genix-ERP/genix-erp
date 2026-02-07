import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
  defaultOpen = true,
  badge = null,
  onReset,
  resetLabel = "Reset",
  className
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={cn("mb-4", className)}>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon && <Icon className="w-5 h-5 text-slate-600" />}
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                {title}
                {badge && (
                  <Badge variant="secondary" className="text-xs">
                    {badge}
                  </Badge>
                )}
              </CardTitle>
              {description && (
                <CardDescription className="text-sm text-slate-500 mt-1">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onReset && isOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onReset();
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                {resetLabel}
              </Button>
            )}
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

export function SettingsField({
  label,
  description,
  children,
  className,
  required = false
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex flex-col min-h-[40px]">
        <label className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {description && (
          <span className="text-xs text-slate-500">{description}</span>
        )}
      </div>
      <div className="mt-2">
        {children}
      </div>
    </div>
  );
}

export function SettingsRow({ children, className, cols = 2 }) {
  const gridCols = cols === 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2";
  return (
    <div className={cn(`grid grid-cols-1 ${gridCols} gap-4 mb-4 items-end`, className)}>
      {children}
    </div>
  );
}

export function SettingsDivider({ label }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-slate-200" />
      {label && (
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </span>
      )}
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

export function SettingsToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className={cn(
          "w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600",
          disabled && "opacity-50 cursor-not-allowed"
        )} />
      </label>
    </div>
  );
}

export default SettingsSection;
