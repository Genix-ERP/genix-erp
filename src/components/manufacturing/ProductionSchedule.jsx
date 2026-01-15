import React, { useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, Clock, Factory, AlertTriangle } from 'lucide-react';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';

const STATUS_COLORS = {
  draft: { bg: 'bg-slate-200', text: 'text-slate-700', bar: 'bg-slate-400' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' },
  done: { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-400' }
};

export default function ProductionSchedule() {
  const { productionOrders, loading } = useManufacturing();
  const [viewMode, setViewMode] = useState('week'); // week, month
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === 'week') {
      // Start from Monday of current week
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      end.setDate(start.getDate() + 6);
    } else {
      // Month view
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, [currentDate, viewMode]);

  // Generate array of dates for the header
  const dates = useMemo(() => {
    const result = [];
    const current = new Date(dateRange.start);
    while (current <= dateRange.end) {
      result.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [dateRange]);

  // Filter and map orders to the schedule
  const scheduledOrders = useMemo(() => {
    return productionOrders
      .filter(order => {
        if (!order.scheduled_start_date) return false;
        const orderStart = new Date(order.scheduled_start_date);
        const orderEnd = order.scheduled_end_date ? new Date(order.scheduled_end_date) : orderStart;
        return orderStart <= dateRange.end && orderEnd >= dateRange.start;
      })
      .map(order => {
        const orderStart = new Date(order.scheduled_start_date);
        const orderEnd = order.scheduled_end_date ? new Date(order.scheduled_end_date) : orderStart;

        // Calculate position and width
        const rangeStart = dateRange.start.getTime();
        const rangeEnd = dateRange.end.getTime();
        const totalDays = dates.length;

        const startOffset = Math.max(0, (orderStart.getTime() - rangeStart) / (1000 * 60 * 60 * 24));
        const endOffset = Math.min(totalDays, (orderEnd.getTime() - rangeStart) / (1000 * 60 * 60 * 24) + 1);
        const duration = endOffset - startOffset;

        return {
          ...order,
          startOffset,
          duration,
          isOverdue: orderEnd < new Date() && order.status !== 'done' && order.status !== 'cancelled'
        };
      });
  }, [productionOrders, dateRange, dates]);

  const navigatePeriod = (direction) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDateHeader = (date) => {
    const day = date.toLocaleDateString('en-US', { weekday: 'short' });
    const num = date.getDate();
    return { day, num };
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading production schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[var(--genix-blue)]" />
              <h3 className="text-lg font-semibold text-slate-800">Production Schedule</h3>
            </div>

            <div className="flex items-center gap-3">
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week View</SelectItem>
                  <SelectItem value="month">Month View</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => navigatePeriod(-1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigatePeriod(1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <span className="text-sm font-medium text-slate-600">
                {dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gantt Chart */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Date Headers */}
              <div className="flex border-b border-slate-200 bg-slate-50">
                <div className="w-64 min-w-[256px] p-3 border-r border-slate-200 font-medium text-slate-700">
                  Production Order
                </div>
                <div className="flex-1 flex">
                  {dates.map((date, idx) => {
                    const { day, num } = formatDateHeader(date);
                    return (
                      <div
                        key={idx}
                        className={`flex-1 min-w-[60px] p-2 text-center border-r border-slate-100 last:border-r-0 ${
                          isToday(date) ? 'bg-blue-50' : isWeekend(date) ? 'bg-slate-100' : ''
                        }`}
                      >
                        <div className="text-xs text-slate-500">{day}</div>
                        <div className={`text-sm font-semibold ${isToday(date) ? 'text-blue-600' : 'text-slate-700'}`}>
                          {num}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Rows */}
              {scheduledOrders.length === 0 ? (
                <div className="p-8 text-center">
                  <Factory className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No scheduled production orders for this period</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Create production orders with scheduled dates to see them here
                  </p>
                </div>
              ) : (
                scheduledOrders.map((order, idx) => {
                  const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS.draft;
                  return (
                    <div
                      key={order.id || idx}
                      className="flex border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Order Info */}
                      <div className="w-64 min-w-[256px] p-3 border-r border-slate-200">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800 truncate">
                              {order.product_name || 'Unnamed Product'}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {order.order_number}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`text-xs ${statusColor.bg} ${statusColor.text}`}>
                                {order.status?.replace('_', ' ')}
                              </Badge>
                              {order.isOverdue && (
                                <Badge className="text-xs bg-red-100 text-red-700">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Overdue
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Gantt Bar */}
                      <div className="flex-1 relative py-3 px-1">
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-md ${statusColor.bar} shadow-sm flex items-center px-2 cursor-pointer hover:opacity-90 transition-opacity`}
                          style={{
                            left: `${(order.startOffset / dates.length) * 100}%`,
                            width: `${Math.max((order.duration / dates.length) * 100, 5)}%`,
                            minWidth: '60px'
                          }}
                          title={`${order.product_name}\n${order.scheduled_start_date} - ${order.scheduled_end_date || order.scheduled_start_date}`}
                        >
                          <span className="text-xs text-white font-medium truncate">
                            {order.quantity_to_produce} units
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-slate-600">Status:</span>
            {Object.entries(STATUS_COLORS).map(([status, colors]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${colors.bar}`}></div>
                <span className="text-sm text-slate-600 capitalize">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{scheduledOrders.length}</p>
                <p className="text-sm text-slate-500">Scheduled Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {scheduledOrders.filter(o => o.status === 'in_progress').length}
                </p>
                <p className="text-sm text-slate-500">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Factory className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {scheduledOrders.filter(o => o.status === 'done').length}
                </p>
                <p className="text-sm text-slate-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {scheduledOrders.filter(o => o.isOverdue).length}
                </p>
                <p className="text-sm text-slate-500">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
