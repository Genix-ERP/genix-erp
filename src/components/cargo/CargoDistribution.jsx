import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';

export default function CargoDistribution() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Tovar taqsimlash
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-slate-500">
          Taqsimlash funksiyasi ishlab chiqilmoqda...
        </div>
      </CardContent>
    </Card>
  );
}
