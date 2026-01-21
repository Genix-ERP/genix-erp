"use client"

import * as React from "react"
import { HelpCircle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * FieldHelp - A small help icon with tooltip for form field guidance
 * @param {string} text - The help text to display in the tooltip
 */
const FieldHelp = ({ text }) => {
  if (!text) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="ml-1 text-slate-400 hover:text-slate-600 focus:outline-none"
            tabIndex={-1}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs bg-slate-800 text-white p-2 rounded-md shadow-lg"
        >
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * LabelWithHelp - A label component with optional help tooltip
 * @param {string} label - The label text
 * @param {string} helpText - Optional help text for tooltip
 * @param {boolean} required - Whether the field is required (shows asterisk)
 * @param {string} htmlFor - The id of the associated form element
 * @param {string} className - Additional CSS classes
 */
const LabelWithHelp = ({
  label,
  helpText,
  required = false,
  htmlFor,
  className = ""
}) => (
  <label
    htmlFor={htmlFor}
    className={`text-sm font-medium text-slate-700 flex items-center ${className}`}
  >
    {label}
    {required && <span className="text-red-500 ml-0.5">*</span>}
    {helpText && <FieldHelp text={helpText} />}
  </label>
);

export { FieldHelp, LabelWithHelp }
