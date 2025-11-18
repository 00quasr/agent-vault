"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ContractStats {
  totalCredentials: number;
  successfulAuth: number;
  blockedAttempts: number;
  totalRevocations: number;
  totalReadAuth: number;
  totalWriteAuth: number;
  totalExecuteAuth: number;
}

interface StatsResponse {
  success: boolean;
  stats: ContractStats;
  metrics: {
    totalAuth: number;
    successRate: string;
    capabilityBreakdown: {
      read: number;
      write: number;
      execute: number;
    };
  };
  timestamp: string;
}

export function MidnightStatsWidget() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/midnight/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh every 10 seconds to show live data
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Midnight Blockchain Stats</CardTitle>
          <CardDescription>Loading live contract data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Midnight Blockchain Stats</CardTitle>
          <CardDescription className="text-red-500">
            {error || "Failed to load stats"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Midnight Blockchain Stats
        </CardTitle>
        <CardDescription>
          Live data from ZK-proof contract • Updated{" "}
          {new Date(stats.timestamp).toLocaleTimeString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Credentials Issued"
            value={stats.stats.totalCredentials}
            trend="neutral"
          />
          <StatCard
            label="Successful Auth"
            value={stats.stats.successfulAuth}
            trend="positive"
          />
          <StatCard
            label="Blocked Attempts"
            value={stats.stats.blockedAttempts}
            trend="negative"
          />
          <StatCard
            label="Revocations"
            value={stats.stats.totalRevocations}
            trend="warning"
          />
        </div>

        {/* Success Rate */}
        <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Authorization Success Rate</span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.metrics.successRate}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-600 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${stats.metrics.successRate}%` }}
            />
          </div>
        </div>

        {/* Capability Breakdown */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Selective Disclosure (Capability Usage)
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <CapabilityCard
              label="Read"
              value={stats.metrics.capabilityBreakdown.read}
              color="blue"
            />
            <CapabilityCard
              label="Write"
              value={stats.metrics.capabilityBreakdown.write}
              color="purple"
            />
            <CapabilityCard
              label="Execute"
              value={stats.metrics.capabilityBreakdown.execute}
              color="pink"
            />
          </div>
        </div>

        {/* ZK Proof Indicator */}
        <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">
            Zero-Knowledge Proofs Active
          </span>
          <div className="ml-auto">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: number;
  trend: "positive" | "negative" | "neutral" | "warning";
}) {
  const trendColors = {
    positive: "border-gray-200 bg-gray-50/50 dark:bg-gray-950/20",
    negative: "border-gray-200 bg-gray-50/50 dark:bg-gray-950/20",
    neutral: "border-gray-200 bg-gray-50/50 dark:bg-gray-950/20",
    warning: "border-gray-200 bg-gray-50/50 dark:bg-gray-950/20",
  };

  return (
    <div className={`p-3 rounded-lg border ${trendColors[trend]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
    </div>
  );
}

function CapabilityCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "purple" | "pink";
}) {
  const colorClasses = {
    blue: "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300",
    purple: "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300",
    pink: "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300",
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}
