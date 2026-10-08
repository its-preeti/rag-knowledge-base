import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, FileText, MessageSquare, DollarSign, Activity, Shield, Trash2, Ban, Check } from 'lucide-react';
import { adminApi } from '@/services/api';
import { formatBytes, formatRelativeTime, cn } from '@/utils/helpers';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'logs' | 'analytics'>('dashboard');

  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminApi.getDashboard().then((r) => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getUsers().then((r) => r.data),
    enabled: activeTab === 'users',
  });

  const { data: logs } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => adminApi.getLogs().then((r) => r.data),
    enabled: activeTab === 'logs',
  });

  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => adminApi.getAnalytics(30).then((r) => r.data),
    enabled: activeTab === 'analytics',
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: any) => adminApi.updateUser(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User updated'); },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User deleted'); },
  });

  const tabs = ['dashboard', 'users', 'logs', 'analytics'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">System management and analytics</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl mb-6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all',
              activeTab === tab ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && stats && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: stats.users.total, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { label: 'Total Documents', value: stats.documents.total, icon: FileText, color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { label: 'Total Chats', value: stats.chats.total, icon: MessageSquare, color: 'text-green-500', bg: 'bg-green-500/10' },
              { label: 'Total Cost', value: `$${(stats.usage.totalCost || 0).toFixed(4)}`, icon: DollarSign, color: 'text-orange-500', bg: 'bg-orange-500/10' },
            ].map(({ label, value, icon: Icon, color, bg }, i) => (
              <motion.div key={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-4">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </motion.div>
            ))}
          </div>

          {/* Storage */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-3">Storage Usage</h2>
            <p className="text-2xl font-bold">{formatBytes(stats.storage.totalBytes)}</p>
            <p className="text-sm text-muted-foreground">Total storage used across all documents</p>
          </div>

          {/* Recent users */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Recent Users</h2>
            <div className="space-y-2">
              {stats.recentUsers?.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{u.firstName?.[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(u.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Users ({users?.meta?.total || 0})</h2>
          </div>
          <div className="divide-y divide-border">
            {users?.data?.map((u: any) => (
              <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-all">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{u.firstName?.[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-muted-foreground">{u.email} · {u.role}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{u._count?.documents} docs</span>
                  <span>{u._count?.chats} chats</span>
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full', u.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500')}>
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateUserMutation.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground transition-all"
                    title={u.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {u.isActive ? <Ban className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete user ${u.email}?`)) deleteUserMutation.mutate(u.id); }}
                    className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Usage Logs ({logs?.meta?.total || 0})</h2>
          </div>
          <div className="divide-y divide-border max-h-[600px] overflow-auto">
            {logs?.data?.map((log: any) => (
              <div key={log.id} className="flex items-center gap-4 p-3 text-sm hover:bg-accent/50 transition-all">
                <Activity className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{log.user?.email}</span>
                  <span className="text-muted-foreground ml-2">{log.action}</span>
                </div>
                <span className="text-xs text-muted-foreground">{log.model}</span>
                <span className="text-xs text-muted-foreground">{log.tokensUsed?.toLocaleString()} tokens</span>
                <span className="text-xs text-muted-foreground">${(log.cost || 0).toFixed(5)}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(log.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold mb-4">Usage by Action</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics.dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="action" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="_count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold mb-4">Documents by Type</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={analytics.documentsByType} dataKey="_count" nameKey="fileType" cx="50%" cy="50%" outerRadius={80} label={({ fileType, percent }) => `${fileType} ${(percent * 100).toFixed(0)}%`}>
                    {analytics.documentsByType?.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}