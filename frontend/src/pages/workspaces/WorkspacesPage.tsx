import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, FileText, MessageSquare, Trash2, Settings, Crown, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { workspacesApi } from '@/services/api';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useAuthStore } from '@/store/auth.store';
import { cn, formatRelativeTime } from '@/utils/helpers';
import toast from 'react-hot-toast';

function DeleteConfirmationModal({ workspaceName, onClose, onConfirm }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-foreground mb-1">Delete Workspace</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete <span className="font-medium text-foreground">"{workspaceName}"</span>? 
              This action cannot be undone. All documents, index vector points, and chats will be permanently deleted.
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent border border-border transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
          >
            Delete Workspace
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function CreateWorkspaceModal({ onClose, onCreate }: any) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-xl p-6 w-full max-w-md"
      >
        <h3 className="font-semibold text-lg mb-4">Create Workspace</h3>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-sm font-medium mb-1 block">Name *</label>
            <input
              autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="My Workspace"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <textarea
              value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-accent transition-all">Cancel</button>
          <button
            onClick={() => name.trim() && onCreate({ name: name.trim(), description: desc.trim() })}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            Create
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function WorkspacesPage() {
  const { user } = useAuthStore();
  const { currentWorkspace, setCurrentWorkspace, setWorkspaces } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState<any>(null);

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspacesApi.getAll().then((r) => r.data),
    onSuccess: (data: any) => setWorkspaces(data),
  } as any);

  const createMutation = useMutation({
    mutationFn: (data: any) => workspacesApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setCreating(false);
      toast.success('Workspace created');
    },
    onError: () => toast.error('Failed to create workspace'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workspacesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete workspace'),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Organize your documents and chats</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" /> New Workspace
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {((workspaces as any) || []).map((ws: any, i: number) => (
            <motion.div
              key={ws.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'bg-card border rounded-xl p-5 cursor-pointer transition-all group hover:shadow-md',
                currentWorkspace?.id === ws.id ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:border-primary/30',
              )}
              onClick={() => setCurrentWorkspace(ws)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">{ws.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm">{ws.name}</p>
                      {ws.isDefault && <Crown className="w-3 h-3 text-amber-500" />}
                    </div>
                    {ws.description && <p className="text-xs text-muted-foreground">{ws.description}</p>}
                  </div>
                </div>
                {!ws.isDefault && ws.ownerId === user?.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingWorkspace(ws);
                    }}
                    className="p-1.5 opacity-0 group-hover:opacity-100 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {ws._count?.documents || 0} docs
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {ws._count?.chats || 0} chats
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {ws.members?.length || 0} members
                </span>
              </div>

              {currentWorkspace?.id === ws.id && (
                <div className="mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-primary font-medium">Currently active</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {creating && (
          <CreateWorkspaceModal
            onClose={() => setCreating(false)}
            onCreate={(data: any) => createMutation.mutate(data)}
          />
        )}

        {deletingWorkspace && (
          <DeleteConfirmationModal
            workspaceName={deletingWorkspace.name}
            onClose={() => setDeletingWorkspace(null)}
            onConfirm={() => {
              deleteMutation.mutate(deletingWorkspace.id);
              setDeletingWorkspace(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}