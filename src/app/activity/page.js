"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Hourglass,
  Play,
} from "lucide-react";
import { SkeletonTable } from "@/components/ui/skeleton";
import { toast } from "sonner";

const STATUS_CONFIG = {
  pending_confirmation: { label: "Pending", icon: Hourglass, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
  executing: { label: "Executing", icon: Play, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/30" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
  failed: { label: "Failed", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
};

const METHOD_COLORS = {
  GET: "text-green-400",
  POST: "text-blue-400",
  PUT: "text-yellow-400",
  PATCH: "text-orange-400",
  DELETE: "text-red-400",
};

function ActivityContent() {
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    fetchActivity();
  }, [filterStatus, offset]);

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (filterStatus !== "all") params.set("status", filterStatus);

      const res = await fetch(`/api/activity?${params}`);
      const data = await res.json();

      if (res.ok) {
        setActions(data.actions || []);
      } else {
        toast.error(data.error || "Failed to load activity");
      }
    } catch {
      toast.error("Failed to load activity");
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AuthenticatedNav />

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black mb-2">Activity Log</h1>
              <p className="text-white/40">
                Audit trail of all API actions executed through ActionChat
              </p>
            </div>
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setOffset(0); }}>
              <SelectTrigger className="w-[180px] bg-white/5 border-white/10">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending_confirmation">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="executing">Executing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Actions
              </CardTitle>
              <CardDescription className="text-white/40">
                Every API call made through agents is logged here
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <SkeletonTable rows={8} cols={6} />
              ) : actions.length === 0 ? (
                <div className="text-center py-16">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-white/10" />
                  <p className="text-white/30 mb-1">No activity yet</p>
                  <p className="text-white/20 text-sm">
                    Actions will appear here once agents execute API calls
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="text-white/50">Time</TableHead>
                          <TableHead className="text-white/50">Agent</TableHead>
                          <TableHead className="text-white/50">Tool</TableHead>
                          <TableHead className="text-white/50">Method</TableHead>
                          <TableHead className="text-white/50">URL</TableHead>
                          <TableHead className="text-white/50">Status</TableHead>
                          <TableHead className="text-white/50">HTTP</TableHead>
                          <TableHead className="text-white/50 text-right">Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {actions.map((action) => {
                          const statusConfig = STATUS_CONFIG[action.status] || STATUS_CONFIG.failed;
                          const StatusIcon = statusConfig.icon;
                          return (
                            <TableRow key={action.id} className="border-white/5 hover:bg-white/[0.03]">
                              <TableCell className="text-xs text-white/40 whitespace-nowrap">
                                <span title={new Date(action.created_at).toLocaleString()}>
                                  {formatTime(action.created_at)}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">
                                {action.agent_name || <span className="text-white/20 italic">deleted</span>}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {action.tool_name}
                              </TableCell>
                              <TableCell>
                                <span className={`font-mono text-xs font-bold ${METHOD_COLORS[action.method] || "text-white/40"}`}>
                                  {action.method}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-white/40 max-w-xs truncate">
                                <span title={action.url}>{action.url}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${statusConfig.bg}`}>
                                  <StatusIcon className={`h-3 w-3 mr-1 ${statusConfig.color}`} />
                                  {statusConfig.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {action.response_status ? (
                                  <span className={`text-xs font-mono ${action.response_status < 400 ? "text-green-400" : "text-red-400"}`}>
                                    {action.response_status}
                                  </span>
                                ) : (
                                  <span className="text-white/20">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs text-white/40">
                                {formatDuration(action.duration_ms)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                    <p className="text-xs text-white/30">
                      Showing {offset + 1}–{offset + actions.length}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={offset === 0}
                        onClick={() => setOffset(Math.max(0, offset - limit))}
                        className="border-white/10"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actions.length < limit}
                        onClick={() => setOffset(offset + limit)}
                        className="border-white/10"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <AuthGuard>
      <ActivityContent />
    </AuthGuard>
  );
}
