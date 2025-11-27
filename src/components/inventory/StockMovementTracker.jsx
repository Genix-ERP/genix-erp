import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Activity, TrendingUp, TrendingDown, ArrowRightLeft, AlertTriangle, Plus, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function StockMovementTracker({ movements, items }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredMovements, setFilteredMovements] = useState(movements || []);

  React.useEffect(() => {
    if (searchQuery) {
      const filtered = (movements || []).filter(movement => 
        movement.reference_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        movement.supplier_or_customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        items.find(item => item.id === movement.inventory_item_id)?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMovements(filtered);
    } else {
      setFilteredMovements(movements || []);
    }
  }, [searchQuery, movements, items]);

  const getMovementIcon = (type) => {
    const icons = {
      inbound: TrendingUp,
      outbound: TrendingDown,
      adjustment: AlertTriangle,
      transfer: ArrowRightLeft,
      expiry_write_off: AlertTriangle
    };
    return icons[type] || Activity;
  };

  const getMovementColor = (type) => {
    const colors = {
      inbound: "bg-green-100 text-green-800",
      outbound: "bg-red-100 text-red-800",
      adjustment: "bg-yellow-100 text-yellow-800",
      transfer: "bg-blue-100 text-blue-800",
      expiry_write_off: "bg-purple-100 text-purple-800"
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const getItemName = (itemId) => {
    const item = items.find(i => i.id === itemId);
    return item ? item.name : 'Unknown Item';
  };

  const getItemSku = (itemId) => {
    const item = items.find(i => i.id === itemId);
    return item ? item.sku : 'N/A';
  };

  const calculateTotalValue = (movements) => {
    return movements.reduce((sum, movement) => sum + (movement.total_value || 0), 0);
  };

  const movementStats = React.useMemo(() => {
    const inbound = filteredMovements.filter(m => m.movement_type === 'inbound');
    const outbound = filteredMovements.filter(m => m.movement_type === 'outbound');
    const adjustments = filteredMovements.filter(m => m.movement_type === 'adjustment');

    return {
      totalMovements: filteredMovements.length,
      inboundCount: inbound.length,
      outboundCount: outbound.length,
      adjustmentCount: adjustments.length,
      inboundValue: calculateTotalValue(inbound),
      outboundValue: calculateTotalValue(outbound),
      netValue: calculateTotalValue(inbound) - calculateTotalValue(outbound)
    };
  }, [filteredMovements]);

  return (
    <div className="space-y-6">
      {/* Movement Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Movements</p>
                <p className="text-2xl font-bold text-slate-900">{movementStats.totalMovements}</p>
              </div>
              <Activity className="w-6 h-6 text-[var(--genix-blue)]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Inbound Value</p>
                <p className="text-2xl font-bold text-green-600">${movementStats.inboundValue.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Outbound Value</p>
                <p className="text-2xl font-bold text-red-600">${movementStats.outboundValue.toLocaleString()}</p>
              </div>
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Net Movement</p>
                <p className={`text-2xl font-bold ${movementStats.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${movementStats.netValue.toLocaleString()}
                </p>
              </div>
              <ArrowRightLeft className={`w-6 h-6 ${movementStats.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Movements Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[var(--genix-blue)]" />
              <CardTitle>Stock Movement History</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search movements..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                <Plus className="w-4 h-4 mr-2" />
                New Movement
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>COGS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.length > 0 ? (
                  filteredMovements.map((movement, index) => {
                    const MovementIcon = getMovementIcon(movement.movement_type);
                    return (
                      <TableRow key={movement.id || index} className="hover:bg-slate-50/80">
                        <TableCell>
                          <div className="text-sm">
                            <div>{movement.movement_date ? format(new Date(movement.movement_date), 'MMM d, yyyy') : 'N/A'}</div>
                            <div className="text-slate-500">{movement.movement_date ? format(new Date(movement.movement_date), 'HH:mm') : ''}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{getItemName(movement.inventory_item_id)}</p>
                            <p className="text-sm text-slate-500">{getItemSku(movement.inventory_item_id)}</p>
                            {movement.batch_number && (
                              <Badge variant="outline" className="text-xs mt-1">
                                Batch: {movement.batch_number}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MovementIcon className="w-4 h-4" />
                            <Badge className={getMovementColor(movement.movement_type)}>
                              {movement.movement_type?.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${movement.movement_type === 'inbound' ? 'text-green-600' : movement.movement_type === 'outbound' ? 'text-red-600' : 'text-slate-600'}`}>
                            {movement.movement_type === 'inbound' ? '+' : movement.movement_type === 'outbound' ? '-' : ''}
                            {movement.quantity || 0}
                          </span>
                        </TableCell>
                        <TableCell>${(movement.unit_cost || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${movement.movement_type === 'inbound' ? 'text-green-600' : movement.movement_type === 'outbound' ? 'text-red-600' : 'text-slate-600'}`}>
                            ${(movement.total_value || 0).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{movement.reference_number || 'N/A'}</div>
                            {movement.supplier_or_customer && (
                              <div className="text-slate-500">{movement.supplier_or_customer}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {movement.movement_type === 'outbound' && (
                            <div>
                              <div className="font-medium">${(movement.cogs_calculated || 0).toFixed(2)}</div>
                              <Badge className="text-xs bg-slate-100 text-slate-800">
                                {movement.costing_method_used?.toUpperCase() || 'FIFO'}
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>No stock movements found</p>
                      <p className="text-sm">Stock movements will appear here as you manage inventory</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}