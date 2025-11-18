"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Filter,
  Loader2,
  Key,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WalletButton } from "@/components/wallet-button";
import { useWallet } from "@/lib/wallet-context";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  agent_type: string;
  status: "active" | "inactive" | "blocked";
  public_key: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  credentials_count?: number;
  last_activity?: string;
}

export default function AgentsPage() {
  const { walletAddress, connected } = useWallet();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCredentialDialogOpen, setIsCredentialDialogOpen] = useState(false);
  const [credentialInfo, setCredentialInfo] = useState<any>(null);
  const [newAgent, setNewAgent] = useState({
    name: "",
    description: "",
    agent_type: "autonomous",
    capabilities: [] as string[],
    rate_limit_per_hour: 100,
    credential_expiry_days: 365,
    access_scope: {
      secrets: [] as string[],
      resources: [] as string[],
    },
  });

  useEffect(() => {
    fetchAgents();
  }, [walletAddress]); // Re-fetch when wallet changes

  const fetchAgents = async () => {
    try {
      // Only fetch if wallet is connected
      if (!walletAddress) {
        setAgents([]);
        setLoading(false);
        return;
      }

      // Fetch only agents owned by this wallet
      const response = await fetch(`/api/agents?wallet=${encodeURIComponent(walletAddress)}`);
      if (!response.ok) throw new Error("Failed to fetch agents");
      const data = await response.json();
      setAgents(data);
    } catch (error) {
      console.error("Error fetching agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.agent_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: Agent["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-50 text-green-700 border-green-200";
      case "inactive":
        return "bg-gray-100 text-gray-600 border-gray-300";
      case "blocked":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-600 border-gray-300";
    }
  };

  const handleView = (agent: Agent) => {
    setSelectedAgent(agent);
    setIsDialogOpen(true);
  };

  const handleEdit = (agent: Agent) => {
    console.log("Edit agent:", agent);
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete agent");

      setAgents(agents.filter((a) => a.id !== agentId));
    } catch (error) {
      console.error("Error deleting agent:", error);
      alert("Failed to delete agent");
    }
  };

  const handleAddAgent = async () => {
    if (!newAgent.name) {
      alert("Agent name is required");
      return;
    }

    if (!connected || !walletAddress) {
      alert("Please connect your Lace wallet first");
      return;
    }

    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newAgent,
          owner_wallet_address: walletAddress,
        }),
      });

      if (!response.ok) throw new Error("Failed to create agent");

      const createdAgent = await response.json();

      // Store credential info for display
      setCredentialInfo(createdAgent.midnight_credential);

      // Add agent to list (without credential info)
      const { midnight_credential, ...agentData } = createdAgent;
      setAgents([agentData, ...agents]);

      // Close add dialog and show credential dialog
      setIsAddDialogOpen(false);
      setIsCredentialDialogOpen(true);
      setNewAgent({
        name: "",
        description: "",
        agent_type: "autonomous",
        capabilities: [],
        rate_limit_per_hour: 100,
        credential_expiry_days: 365,
        access_scope: {
          secrets: [],
          resources: [],
        },
      });
    } catch (error) {
      console.error("Error creating agent:", error);
      alert("Failed to create agent");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
      </div>
    );
  }

  // Show connect wallet prompt if not connected
  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-8">
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-gray-600" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Connect Your Wallet
                </h1>
                <p className="text-gray-600">
                  Please connect your Midnight Lace wallet to view and manage your agents
                </p>
              </div>
              <div className="flex justify-center">
                <WalletButton />
              </div>
              <Alert className="border-blue-200 bg-blue-50 text-left">
                <AlertDescription className="text-blue-800">
                  <strong>Note:</strong> You'll need the Midnight Lace wallet extension installed.
                  Your agents are private and only visible to you.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                  ← Back to Dashboard
                </Link>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Agent Management
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage and monitor your integration agents
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-gray-900 text-white hover:bg-gray-800"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Agent
              </Button>
              <WalletButton />
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-100">
                Status: All
              </Button>
              <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-100">
                Type: All
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-gray-200">
                <TableHead className="font-semibold text-gray-700">Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Type</TableHead>
                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                <TableHead className="font-semibold text-gray-700 text-center">
                  Credentials
                </TableHead>
                <TableHead className="font-semibold text-gray-700">Last Activity</TableHead>
                <TableHead className="font-semibold text-gray-700 text-center">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {filteredAgents.map((agent, index) => (
                  <motion.tr
                    key={agent.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <TableCell className="font-medium text-gray-900">{agent.name}</TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {agent.agent_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getStatusColor(agent.status)} capitalize`}
                      >
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono border-gray-300 text-gray-700">
                        {agent.credentials_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {formatDate(agent.updated_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-white border-gray-200">
                          <DropdownMenuItem
                            onClick={() => handleView(agent)}
                            className="cursor-pointer text-gray-700 focus:bg-gray-100 focus:text-gray-900"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEdit(agent)}
                            className="cursor-pointer text-gray-700 focus:bg-gray-100 focus:text-gray-900"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Agent
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(agent.id)}
                            className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Agent
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            Showing {filteredAgents.length} of {agents.length} agents
          </p>
        </div>
      </motion.div>

      {/* Agent Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Agent Details</DialogTitle>
            <DialogDescription className="text-gray-600">
              Detailed information about the selected agent
            </DialogDescription>
          </DialogHeader>
          {selectedAgent && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Name
                </label>
                <p className="text-base font-semibold text-gray-900">{selectedAgent.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Description
                </label>
                <p className="text-base text-gray-700">{selectedAgent.description || "No description"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Type
                </label>
                <p className="text-base text-gray-700">{selectedAgent.agent_type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Status
                </label>
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    className={`${getStatusColor(selectedAgent.status)} capitalize`}
                  >
                    {selectedAgent.status}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Credentials Count
                </label>
                <p className="text-base text-gray-700">{selectedAgent.credentials_count || 0}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Created
                </label>
                <p className="text-base text-gray-700">{new Date(selectedAgent.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Last Updated
                </label>
                <p className="text-base text-gray-700">{formatDate(selectedAgent.updated_at)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Agent Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-white border-gray-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Add New Agent</DialogTitle>
            <DialogDescription className="text-gray-600">
              Create a new verifiable autonomous agent with Midnight ZK credentials
            </DialogDescription>
          </DialogHeader>

          {!connected && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertDescription className="text-yellow-800">
                Please connect your Lace wallet to create an agent
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Basic Information</h3>
              <div>
                <Label className="text-gray-700">Agent Name *</Label>
                <Input
                  type="text"
                  placeholder="e.g., Data Processor Agent"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  className="mt-1 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <div>
                <Label className="text-gray-700">Description</Label>
                <Input
                  type="text"
                  placeholder="Brief description of the agent's purpose"
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  className="mt-1 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <div>
                <Label className="text-gray-700">Agent Type</Label>
                <Input
                  type="text"
                  placeholder="e.g., autonomous, processing, analytics"
                  value={newAgent.agent_type}
                  onChange={(e) => setNewAgent({ ...newAgent, agent_type: e.target.value })}
                  className="mt-1 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Capabilities */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Capabilities</h3>
              <p className="text-xs text-gray-600">Select what this agent is authorized to do</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "read_secrets", label: "Read Secrets" },
                  { value: "write_secrets", label: "Write Secrets" },
                  { value: "execute_operations", label: "Execute Operations" },
                  { value: "manage_credentials", label: "Manage Credentials" },
                  { value: "audit_logs", label: "Access Audit Logs" },
                  { value: "data_processing", label: "Data Processing" },
                ].map((cap) => (
                  <Checkbox
                    key={cap.value}
                    label={cap.label}
                    checked={newAgent.capabilities.includes(cap.value)}
                    onChange={(e) => {
                      if ((e.target as HTMLInputElement).checked) {
                        setNewAgent({ ...newAgent, capabilities: [...newAgent.capabilities, cap.value] });
                      } else {
                        setNewAgent({ ...newAgent, capabilities: newAgent.capabilities.filter(c => c !== cap.value) });
                      }
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Rate Limiting */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Rate Limiting</h3>
              <div>
                <Label className="text-gray-700">Operations per Hour</Label>
                <Input
                  type="number"
                  min="1"
                  max="10000"
                  value={newAgent.rate_limit_per_hour}
                  onChange={(e) => setNewAgent({ ...newAgent, rate_limit_per_hour: parseInt(e.target.value) || 100 })}
                  className="mt-1 bg-white border-gray-300 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum number of operations this agent can perform per hour</p>
              </div>
            </div>

            {/* Credential Expiry */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Credential Validity</h3>
              <div>
                <Label className="text-gray-700">Expiry (Days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="3650"
                  value={newAgent.credential_expiry_days}
                  onChange={(e) => setNewAgent({ ...newAgent, credential_expiry_days: parseInt(e.target.value) || 365 })}
                  className="mt-1 bg-white border-gray-300 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">How many days until the ZK credential expires</p>
              </div>
            </div>

            {/* Access Scope */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Access Scope</h3>
              <div>
                <Label className="text-gray-700">Accessible Secrets (comma-separated)</Label>
                <Input
                  type="text"
                  placeholder="e.g., api_key, database_url, encryption_key"
                  value={newAgent.access_scope.secrets.join(", ")}
                  onChange={(e) => setNewAgent({
                    ...newAgent,
                    access_scope: {
                      ...newAgent.access_scope,
                      secrets: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                    }
                  })}
                  className="mt-1 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <div>
                <Label className="text-gray-700">Accessible Resources (comma-separated)</Label>
                <Input
                  type="text"
                  placeholder="e.g., database, storage, api_endpoints"
                  value={newAgent.access_scope.resources.join(", ")}
                  onChange={(e) => setNewAgent({
                    ...newAgent,
                    access_scope: {
                      ...newAgent.access_scope,
                      resources: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                    }
                  })}
                  className="mt-1 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddAgent}
              disabled={!connected}
              className="bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Midnight Credential Dialog */}
      <Dialog open={isCredentialDialogOpen} onOpenChange={setIsCredentialDialogOpen}>
        <DialogContent className="bg-white border-gray-200 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              Midnight Credential Issued
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Agent successfully created with ZK credential on Midnight blockchain
            </DialogDescription>
          </DialogHeader>
          {credentialInfo && (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Your agent now has a cryptographically verifiable credential that enables secure, privacy-preserving operations.
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Transaction Hash
                  </label>
                  <p className="text-sm font-mono text-gray-900 mt-1 break-all">
                    {credentialInfo.tx_hash}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Credential Hash
                  </label>
                  <p className="text-sm font-mono text-gray-900 mt-1 break-all">
                    {credentialInfo.credential_hash}
                  </p>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <label className="text-xs font-medium text-red-600 uppercase tracking-wide flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    Agent Secret (Save Securely!)
                  </label>
                  <p className="text-sm font-mono text-gray-900 mt-1 break-all bg-white p-2 rounded border border-gray-200">
                    {credentialInfo.agent_secret}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    This secret is required for the agent to prove authorization. Store it securely - it won't be shown again!
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>What's Next?</strong> Your agent can now use this credential to prove authorization without revealing its identity. All operations are logged immutably on the Midnight blockchain.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => setIsCredentialDialogOpen(false)}
              className="bg-gray-900 text-white hover:bg-gray-800"
            >
              Got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
