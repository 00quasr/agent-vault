"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Key, ShieldX, Activity, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";
import { useWallet } from "@/lib/wallet-context";
import { MidnightStatsWidget } from "@/components/midnight-stats-widget";
import { LandingPage } from "@/components/landing-page";

interface Stats {
  contractAddress: string;
  totalCredentials: number;
  successfulAuth: number;
  blockedAttempts: number;
  activeAgents: number;
  network: string;
  deployedAt: string;
}

interface ActivityItem {
  id: string;
  type: string;
  agentName: string;
  action: string;
  result: string;
  timestamp: string;
}

export default function Dashboard() {
  const { walletAddress, connected } = useWallet();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contractMode, setContractMode] = useState<'real' | 'simulated' | null>(null);

  useEffect(() => {
    // Check contract status once
    fetch('/api/contract-status')
      .then(res => res.json())
      .then(data => setContractMode(data.mode))
      .catch(() => setContractMode('simulated'));

    if (connected && walletAddress) {
      fetchData();
      // Refresh every 10 seconds
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [connected, walletAddress]);

  async function fetchData() {
    try {
      if (!walletAddress) return;

      const [statsRes, activityRes] = await Promise.all([
        fetch(`/api/stats/wallet?address=${encodeURIComponent(walletAddress)}`),
        fetch(`/api/activity/wallet?address=${encodeURIComponent(walletAddress)}&limit=5`),
      ]);

      if (!statsRes.ok) throw new Error("Failed to fetch stats");

      const statsData = await statsRes.json();
      setStats(statsData);

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivity(activityData);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
      </div>
    );
  }

  // Show landing page if not connected
  if (!connected) {
    return <LandingPage />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
        <Alert className="border-red-200 bg-red-50 max-w-md">
          <ShieldX className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-900">Agent Vault</h1>
            <p className="text-gray-600">
              Verifiable Credentials & Reputation Management
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/agents">
              <Button className="bg-gray-900 text-white hover:bg-gray-800">
                <Users className="w-4 h-4 mr-2" />
                Manage Agents
              </Button>
            </Link>
            <WalletButton />
          </div>
        </div>

        {/* Contract Status */}
        <Alert className="border-green-200 bg-green-50">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Connected to Midnight {stats.network.charAt(0).toUpperCase() + stats.network.slice(1)} •{" "}
            <code className="text-xs font-mono">
              {stats.contractAddress.slice(0, 16)}...{stats.contractAddress.slice(-16)}
            </code>
            {contractMode && (
              <>
                {" • "}
                <span className={contractMode === 'real' ? 'text-green-700 font-semibold' : 'text-yellow-700'}>
                  {contractMode === 'real' ? 'Real Contract Mode' : 'Simulated Mode'}
                </span>
              </>
            )}
          </AlertDescription>
        </Alert>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Credentials */}
          <Card className="border-gray-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Credentials
              </CardTitle>
              <Key className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {stats.totalCredentials}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Issued via ZK proofs
              </p>
            </CardContent>
          </Card>

          {/* Successful Auth */}
          <Card className="border-gray-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Successful Auth
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stats.successfulAuth}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Agents authorized
              </p>
            </CardContent>
          </Card>

          {/* Blocked Attempts */}
          <Card className="border-gray-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Blocked Attempts
              </CardTitle>
              <ShieldX className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {stats.blockedAttempts}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Attacks prevented
              </p>
            </CardContent>
          </Card>

          {/* Active Agents */}
          <Card className="border-gray-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active Agents
              </CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {stats.activeAgents}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Currently authorized
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Midnight Blockchain Stats Widget */}
        <MidnightStatsWidget />

        {/* Recent Activity */}
        <Card className="border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900">Recent Activity</CardTitle>
            <CardDescription className="text-gray-600">
              Latest agent operations and verifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity.length > 0 ? (
                activity.map((item, index) => {
                  const isLast = index === activity.length - 1;
                  const icon = item.result === "success" || item.type.includes("success")
                    ? <ShieldCheck className="h-4 w-4 text-green-600" />
                    : item.result === "blocked" || item.type.includes("failed")
                    ? <ShieldX className="h-4 w-4 text-red-600" />
                    : <Key className="h-4 w-4 text-blue-600" />;

                  const bgColor = item.result === "success" || item.type.includes("success")
                    ? "bg-green-50"
                    : item.result === "blocked" || item.type.includes("failed")
                    ? "bg-red-50"
                    : "bg-blue-50";

                  const badgeClass = item.result === "success" || item.type.includes("success")
                    ? "border-green-200 text-green-700"
                    : item.result === "blocked" || item.type.includes("failed")
                    ? "border-red-200 text-red-700"
                    : "border-blue-200 text-blue-700";

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between ${!isLast ? "border-b border-gray-200 pb-4" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`rounded-full ${bgColor} p-2`}>
                          {icon}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {item.agentName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.action} • {new Date(item.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={badgeClass}>
                        {item.result}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  No recent activity. Create an agent to get started!
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contract Info */}
        <Card className="border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900">Contract Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Address:</span>
              <span className="text-gray-900">{stats.contractAddress}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Network:</span>
              <span className="text-gray-900">{stats.network}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Deployed:</span>
              <span className="text-gray-900">
                {new Date(stats.deployedAt).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          <p>
            Powered by{" "}
            <a
              href="https://midnight.network"
              className="text-gray-700 hover:text-gray-900"
              target="_blank"
              rel="noopener noreferrer"
            >
              Midnight Network
            </a>{" "}
            • Built for Midnight Summit Hackathon 2025
          </p>
        </div>
      </div>
    </div>
  );
}
