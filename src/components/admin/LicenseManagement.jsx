import React, { useState, useEffect } from "react";
import { License } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Key, Plus, Search, Copy, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function LicenseManagement({ onUpdate }) {
  const [licenses, setLicenses] = useState([]);
  const [filteredLicenses, setFilteredLicenses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadLicenses();
  }, []);

  useEffect(() => {
    filterLicenses();
  }, [licenses, searchQuery]);

  const loadLicenses = async () => {
    try {
      const data = await License.list('-created_date');
      setLicenses(data);
    } catch (error) {
      console.error("Error loading licenses:", error);
    }
  };

  const filterLicenses = () => {
    if (searchQuery) {
      setFilteredLicenses(licenses.filter(license =>
        license.license_key?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        license.company_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        license.assigned_user_email?.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    } else {
      setFilteredLicenses(licenses);
    }
  };

  const generateLicense = async () => {
    try {
      const licenseKey = `GENIX-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      await License.create({
        company_id: "default",
        license_key: licenseKey,
        license_type: "user",
        status: "active",
        issued_date: new Date().toISOString().split('T')[0],
        max_activations: 1
      });
      loadLicenses();
      if (onUpdate) onUpdate();
      toast.success('License generated successfully!');
    } catch (error) {
      console.error("Error generating license:", error);
      toast.error('Failed to generate license');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('License key copied to clipboard!');
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Active" },
      inactive: { icon: XCircle, color: "bg-gray-100 text-gray-800", label: "Inactive" },
      suspended: { icon: AlertTriangle, color: "bg-yellow-100 text-yellow-800", label: "Suspended" },
      expired: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Expired" },
      revoked: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Revoked" }
    };
    const badge = badges[status] || badges.active;
    const Icon = badge.icon;
    return (
      <Badge className={badge.color}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Licenses Management
          </CardTitle>
          <Button
            onClick={generateLicense}
            className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate License
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search licenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>License Key</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Activations</TableHead>
                <TableHead>Issued Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLicenses.map((license) => (
                <TableRow key={license.id}>
                  <TableCell className="font-mono text-sm">
                    <div className="flex items-center gap-2">
                      {license.license_key}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(license.license_key)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{license.company_id}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{license.license_type}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(license.status)}</TableCell>
                  <TableCell>{license.assigned_user_email || '-'}</TableCell>
                  <TableCell>
                    {license.current_activations || 0} / {license.max_activations || 'unlimited'}
                  </TableCell>
                  <TableCell>
                    {license.issued_date ? format(new Date(license.issued_date), 'MMM dd, yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    {license.expiry_date ? format(new Date(license.expiry_date), 'MMM dd, yyyy') : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline">
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}