import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function CompanyManagement() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the dedicated Companies page
    navigate('/Companies', { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="max-w-md">
        <CardContent className="py-8 text-center">
          <Building2 className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-600">Kompaniyalar sahifasiga yo'naltirilmoqda...</p>
        </CardContent>
      </Card>
    </div>
  );
}
