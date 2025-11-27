import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, DollarSign } from "lucide-react";

export default function AdminAnalytics({ stats }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Revenue Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Monthly Recurring Revenue:</span>
                <span className="text-2xl font-bold text-green-600">${stats.monthlyRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Annual Run Rate:</span>
                <span className="text-xl font-semibold">${(stats.monthlyRevenue * 12).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Average Revenue Per User:</span>
                <span className="text-xl font-semibold">
                  ${stats.totalUsers > 0 ? (stats.monthlyRevenue / stats.totalUsers).toFixed(2) : 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total Users:</span>
                <span className="text-2xl font-bold">{stats.totalUsers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Active Companies:</span>
                <span className="text-xl font-semibold">{stats.totalCompanies}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Avg. Users Per Company:</span>
                <span className="text-xl font-semibold">
                  {stats.totalCompanies > 0 ? (stats.totalUsers / stats.totalCompanies).toFixed(1) : 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Subscription Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600">{stats.activeSubscriptions}</div>
                <div className="text-sm text-slate-600 mt-2">Active Subscriptions</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600">{stats.trialAccounts}</div>
                <div className="text-sm text-slate-600 mt-2">Trial Accounts</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-red-600">{stats.expiringSoon}</div>
                <div className="text-sm text-slate-600 mt-2">Expiring Soon</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}