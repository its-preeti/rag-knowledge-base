import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, Trash2, Pencil, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '@/services/api';
import { useWorkspaceStore } from '@/store/workspace.store';
import { formatRelativeTime } from '@/utils/helpers';
import toast from 'react-hot-toast';
import { useState } from 'react';

export function ChatPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['chats', currentWorkspace?.id],
    queryFn: () => chatApi.getAll({ workspaceId: currentWorkspace?.id, limit: 50 }).then((r) => r.data.data),
    enabled: !!currentWorkspace,
  });

  const createMutation = useMutation({
    mutationFn: () => chatApi.create({ workspaceId: currentWorkspace?.id, title: 'New Chat' }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      navigate(`/chat/${res.data.id}`);
    },
    onError: () => toast.error('Failed to create chat'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => chatApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      toast.success('Chat deleted');
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Conversations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Chat with your documents</p>
        </div>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!currentWorkspace || createMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {!currentWorkspace ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Please select a workspace to start chatting</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : !data?.length ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium mb-2">No conversations yet</p>
          <p className="text-sm mb-4">Upload documents first, then start a new chat</p>
          <button
            onClick={() => createMutation.mutate()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all"
          >
            Start New Chat
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((chat: any, i: number) => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-start gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/30 cursor-pointer transition-all group"
              onClick={() => navigate(`/chat/${chat.id}`)}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{chat.title}</p>
                {chat.messages?.[0] && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {chat.messages[0].content}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(chat.updatedAt)}
                  </span>
                  <span>{chat._count?.messages || 0} messages</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setChatToDelete(chat.id);
                }}
                className="p-2 opacity-0 group-hover:opacity-100 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-6 bg-card border border-border rounded-xl shadow-xl"
          >
            <h2 className="text-xl font-bold mb-2">Delete Conversation?</h2>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setChatToDelete(null)}
                className="px-4 py-2 rounded-lg font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteMutation.mutate(chatToDelete);
                  setChatToDelete(null);
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}