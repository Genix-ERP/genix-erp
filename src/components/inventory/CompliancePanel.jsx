import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, AlertTriangle, XCircle, FileText, Globe } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CompliancePanel({ compliance }) {
  if (!compliance) return null;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'partially_compliant':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'non_compliant':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Shield className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      compliant: "bg-green-100 text-green-800",
      partially_compliant: "bg-yellow-100 text-yellow-800",
      non_compliant: "bg-red-100 text-red-800"
    };
    return colors[status] || "bg-slate-100 text-slate-800";
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: "bg-red-100 text-red-800 border-red-200",
      warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
      info: "bg-blue-100 text-blue-800 border-blue-200"
    };
    return colors[severity] || "bg-slate-100 text-slate-800";
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--genix-blue)]" />
            <CardTitle>Compliance Status</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={getStatusColor(compliance.compliance_status)}>
              {getStatusIcon(compliance.compliance_status)}
              <span className="ml-1">{compliance.compliance_status.replace('_', ' ')}</span>
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {compliance.standard_detected}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Compliance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <h4 className="font-semibold">Detected Standard</h4>
            </div>
            <p className="text-sm text-slate-600">
              {compliance.standard_detected === 'IFRS' && 
                "International Financial Reporting Standards detected. FIFO and WAC methods are compliant. LIFO is not permitted."
              }
              {compliance.standard_detected === 'US_GAAP' && 
                "US Generally Accepted Accounting Principles detected. All costing methods (FIFO, LIFO, WAC) are permitted."
              }
              {compliance.standard_detected === 'MIXED' && 
                "Mixed standards detected. Please review and ensure consistent application of accounting policies."
              }
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <h4 className="font-semibold">Best Practices</h4>
            </div>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• FIFO provides better matching in inflationary periods</li>
              <li>• Maintains clear audit trail for all movements</li>
              <li>• Supports real-time COGS calculation</li>
              <li>• Enables accurate inventory valuation</li>
            </ul>
          </div>
        </div>

        {/* Issues & Recommendations */}
        {compliance.issues && compliance.issues.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Compliance Issues</h4>
            <div className="space-y-3">
              {compliance.issues.map((issue, index) => (
                <Alert key={index} className={getSeverityColor(issue.severity)}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">{issue.issue}</div>
                    <div className="text-sm opacity-90">Solution: {issue.solution}</div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {compliance.recommendations && compliance.recommendations.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Recommendations</h4>
            <div className="bg-blue-50 rounded-lg p-4">
              <ul className="space-y-2">
                {compliance.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" className="flex-1">
            <FileText className="w-4 h-4 mr-2" />
            Generate Compliance Report
          </Button>
          <Button className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
            <Shield className="w-4 h-4 mr-2" />
            Review Settings
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}