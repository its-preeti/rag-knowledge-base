import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileText, MessageSquare, HardDrive, TrendingUp, Upload, Clock, Zap, DollarSign } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { usersApi, documentsApi, chatApi, workspacesApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { formatBytes, formatRelativeTime, getFileIcon, getStatusBadgeClass } from '@/utils/helpers';
import { SkeletonCard } from '@/components/common/SkeletonCard';

const statCards = [
  { key: 'documentCount', label: 'Documents', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { key: 'chatCount', label: 'Conversations', icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { key: 'storageUsed', label: 'Storage Used', icon: HardDrive, color: 'text-green-500', bg: 'bg-green-500/10', format: formatBytes },
  { key: 'totalCost', label: 'Total Cost', icon: DollarSign, color: 'text-orange-500', bg: 'bg-orange-500/10', format: (v: number) => `$${v.toFixed(4)}` },
];

export function DashboardPage() {
  const { user } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['workspace-stats', currentWorkspace?.id],
    queryFn: () =>
      currentWorkspace
        ? workspacesApi.getStats(currentWorkspace.id).then((r) => r.data)
        : Promise.resolve({ documentCount: 0, chatCount: 0, storageUsed: 0, totalCost: 0 }),
    enabled: !!currentWorkspace,
  });

  const { data: recentDocs = [], isLoading: docsLoading } = useQuery({
    queryKey: ['recent-documents', currentWorkspace?.id],
    queryFn: () =>
      currentWorkspace
        ? documentsApi.getAll({ workspaceId: currentWorkspace.id, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })
            .then((r) => Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [])
            .catch(() => [])
        : Promise.resolve([]),
    enabled: !!currentWorkspace,
  });

  const { data: recentChats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ['recent-chats', currentWorkspace?.id],
    queryFn: () =>
      currentWorkspace
        ? chatApi.getAll({ workspaceId: currentWorkspace.id, limit: 5 })
            .then((r) => Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [])
            .catch(() => [])
        : Promise.resolve([]),
    enabled: !!currentWorkspace,
  });

  const chatsRef = import.meta.env ? (window as any).useRef?.() || { current: null } : { current: null };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},{' '}
          <span className="text-primary">{user?.firstName}</span> 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          {currentWorkspace ? `Viewing ${currentWorkspace.name}` : 'Select a workspace to get started'}
        </p>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ key, label, icon: Icon, color, bg, format }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            {statsLoading ? (
              <SkeletonCard />
            ) : (
              <>
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <p className="text-2xl font-bold">
                  {format
                    ? format(stats?.[key] || 0)
                    : (stats?.[key] || 0).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Link
          to="/documents"
          className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group"
        >
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
            <Upload className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium group-hover:text-primary transition-colors">Upload Document</span>
        </Link>
        
        <Link
          to="/chat"
          className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group"
        >
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium group-hover:text-primary transition-colors">New Chat</span>
        </Link>

        <Link
          to="/search"
          className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group"
        >
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium group-hover:text-primary transition-colors">Search Docs</span>
        </Link>

        <button
          onClick={() => {
            const el = document.getElementById('recent-chats-panel');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left w-full group"
        >
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium group-hover:text-primary transition-colors">View History</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Recent Documents
            </h2>
            <Link to="/documents" className="text-xs text-primary hover:underline">View all</Link>
          </div>

          {docsLoading ? (
            <div className="space-y-3">{Array(3).fill(0).map((_, i) => <SkeletonCard key={i} className="h-12" />)}</div>
          ) : recentDocs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No documents yet</p>
              <Link to="/documents" className="text-xs text-primary hover:underline mt-1 inline-block">Upload your first document</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDocs?.map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-all cursor-pointer"
                  onClick={() => navigate('/documents')}
                >
                  <span className="text-xl">{getFileIcon(doc.fileType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(doc.createdAt)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusBadgeClass(doc.status)}`}>
                    {doc.status.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Chats */}
        <motion.div
          id="recent-chats-panel"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" /> Recent Conversations
            </h2>
            <Link to="/chat" className="text-xs text-primary hover:underline">View all</Link>
          </div>

          {chatsLoading ? (
            <div className="space-y-3">{Array(3).fill(0).map((_, i) => <SkeletonCard key={i} className="h-12" />)}</div>
          ) : recentChats?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <Link to="/chat" className="text-xs text-primary hover:underline mt-1 inline-block">Start a new chat</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentChats?.map((chat: any) => (
                <div
                  key={chat.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-all cursor-pointer"
                  onClick={() => navigate(`/chat/${chat.id}`)}
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {chat._count?.messages || 0} messages · {formatRelativeTime(chat.updatedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}