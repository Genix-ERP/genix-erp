import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

export default function CargoCashRegister() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Cargo kassa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-slate-500">
          Kassa funksiyasi ishlab chiqilmoqda...
        </div>
      </CardContent>
    </Card>
  );
}
