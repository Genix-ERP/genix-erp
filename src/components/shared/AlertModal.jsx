import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

const variantConfig = {
  error: {
    icon: AlertCircle,
    iconColor: 'text-red-500',
    defaultTitle: 'Xatolik',
  },
  success: {
    icon: CheckCircle2,
    iconColor: 'text-green-500',
    defaultTitle: 'Muvaffaqiyatli',
  },
  default: {
    icon: Info,
    iconColor: 'text-blue-500',
    defaultTitle: 'Xabar',
  },
};

export default function AlertModal({ modal, close }) {
  if (!modal) return null;

  const config = variantConfig[modal.variant] || variantConfig.default;
  const Icon = config.icon;
  const title = modal.title || config.defaultTitle;

  return (
    <AlertDialog open={modal.open} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-gray-600 whitespace-pre-wrap">
            {modal.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={close}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
