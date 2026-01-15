import React, { useState, useEffect } from 'react';
import { InvokeLLM } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Factory,
  CheckCircle,
  TrendingUp,
  Cog,
  Brain
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function ManufacturingDashboard() {
  const {
    productionOrders,
    workCenters,
    loading,
    activeProductionOrders,
    completedToday,
    averageOEE,
    qualityRate
  } = useManufacturing();

  const [productionData, setProductionData] = useState([]);
  const [workCenterUtilization, setWorkCenterUtilization] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);

  useEffect(() => {
    generateAIInsights();
  }, []);

  useEffect(() => {
    if (!loading) {
      // Production trend data
      const productionByDay = {};
      productionOrders.forEach(order => {
        if (order.actual_end_date) {
          const day = new Date(order.actual_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          productionByDay[day] = (productionByDay[day] || 0) + (order.quantity_produced || 0);
        }
      });
      setProductionData(Object.entries(productionByDay).map(([day, quantity]) => ({ day, quantity })).slice(-7));

      // Work center utilization
      const utilization = workCenters.map(wc => ({
        name: wc.name,
        utilization: wc.utilization_rate || 0,
        oee: wc.oee_score || 0
      }));
      setWorkCenterUtilization(utilization);
    }
  }, [productionOrders, workCenters, loading]);

  const generateAIInsights = async () => {
    try {
      const insights = await InvokeLLM({
        prompt: `As a manufacturing AI analyst, provide 3 actionable insights for production optimization:
        1. Equipment efficiency and maintenance recommendations
        2. Production scheduling optimization opportunities
        3. Quality improvement suggestions

        Each insight should include confidence level, impact assessment, and specific action.`,
        response_json_schema: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  confidence: { type: "number" },
                  impact: { type: "string" },
                  action: { type: "string" }
                }
              }
            }
          }
        }
      });
      setAiInsights(insights.insights || []);
    } catch (error) {
      console.error('Error generating AI insights:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading manufacturing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Factory className="w-6 h-6 text-blue-600" />
              </div>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200">Active</Badge>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{activeProductionOrders}</p>
            <p className="text-sm text-slate-600">Production Orders</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <Badge className="bg-green-50 text-green-700 border-green-200">Today</Badge>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{completedToday}</p>
            <p className="text-sm text-slate-600">Orders Completed</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Cog className="w-6 h-6 text-purple-600" />
              </div>
              <Badge className="bg-purple-50 text-purple-700 border-purple-200">OEE</Badge>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{averageOEE}%</p>
            <p className="text-sm text-slate-600">Avg Equipment Efficiency</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-orange-600" />
              </div>
              <Badge className="bg-orange-50 text-orange-700 border-orange-200">Quality</Badge>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{qualityRate}%</p>
            <p className="text-sm text-slate-600">Quality Pass Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Production Trend */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Production Trend (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={productionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="quantity" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-slate-500">
                No production data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Center Utilization */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cog className="w-5 h-5 text-purple-600" />
              Work Center Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workCenterUtilization.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={workCenterUtilization}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="utilization" fill="#8b5cf6" name="Utilization %" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="oee" fill="#0ea5e9" name="OEE %" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-slate-500">
                No work center data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      {aiInsights.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-6 h-6 text-purple-600" />
            <h3 className="text-xl font-bold text-slate-900">AI Manufacturing Insights</h3>
            <Badge className="bg-purple-50 text-purple-700 border-purple-200">Live Analysis</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {aiInsights.map((insight, index) => (
              <Card key={index} className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-base font-bold text-slate-900">{insight.title}</CardTitle>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {Math.round(insight.confidence * 100)}% confident
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-600 leading-relaxed">{insight.description}</p>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Impact</p>
                    <p className="text-sm text-blue-700">{insight.impact}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="text-xs font-semibold text-purple-900 mb-1">Recommended Action</p>
                    <p className="text-sm text-purple-700">{insight.action}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}