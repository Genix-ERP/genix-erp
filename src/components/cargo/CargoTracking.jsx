import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export default function CargoTracking() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Yuk kuzatish (Tracking)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-slate-500">
          Tracking funksiyasi ishlab chiqilmoqda...
        </div>
      </CardContent>
    </Card>
  );
}
