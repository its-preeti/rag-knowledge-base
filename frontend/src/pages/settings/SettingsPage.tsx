import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Settings, Key, Brain, Database, Save, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { settingsApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll().then((r) => r.data),
  });

  const [form, setForm] = useState({
    openai_model: 'gpt-4o',
    openai_temperature: '0.1',
    openai_max_tokens: '4096',
    embedding_model: 'text-embedding-3-large',
    rag_chunk_size: '1000',
    rag_top_k: '8',
    rag_score_threshold: '0.25',
  });

  useEffect(() => {
    if (settings) {
      setForm((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(settings).map(([k, v]) => [k, String(v)]),
        ),
      }));
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: () =>
      settingsApi.update({
        openai_model: form.openai_model,
        openai_temperature: parseFloat(form.openai_temperature),
        openai_max_tokens: parseInt(form.openai_max_tokens),
        embedding_model: form.embedding_model,
        rag_chunk_size: parseInt(form.rag_chunk_size),
        rag_top_k: parseInt(form.rag_top_k),
        rag_score_threshold: parseFloat(form.rag_score_threshold),
      }),
    onSuccess: () => toast.success('Settings saved'),
    onError: () => toast.error('Failed to save settings'),
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure AI and system parameters</p>
        </div>
      </div>

      {!isAdmin ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Admin access required</p>
          <p className="text-sm">Only administrators can modify system settings</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* OpenAI Settings */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">AI Model Settings</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Model</label>
                  <select
                    value={form.openai_model}
                    onChange={(e) => setForm({ ...form, openai_model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Embedding Model</label>
                  <select
                    value={form.embedding_model}
                    onChange={(e) => setForm({ ...form, embedding_model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="text-embedding-3-large">text-embedding-3-large</option>
                    <option value="text-embedding-3-small">text-embedding-3-small</option>
                    <option value="text-embedding-ada-002">text-embedding-ada-002</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Temperature ({form.openai_temperature})</label>
                  <input
                    type="range" min="0" max="2" step="0.1"
                    value={form.openai_temperature}
                    onChange={(e) => setForm({ ...form, openai_temperature: e.target.value })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Precise (0)</span><span>Creative (2)</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Max Tokens</label>
                  <input
                    type="number" value={form.openai_max_tokens}
                    onChange={(e) => setForm({ ...form, openai_max_tokens: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* RAG Settings */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">RAG Pipeline Settings</h2>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Chunk Size</label>
                <input
                  type="number" value={form.rag_chunk_size}
                  onChange={(e) => setForm({ ...form, rag_chunk_size: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-muted-foreground mt-1">Characters per chunk</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Top K Results</label>
                <input
                  type="number" value={form.rag_top_k}
                  onChange={(e) => setForm({ ...form, rag_top_k: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-muted-foreground mt-1">Chunks to retrieve</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Score Threshold</label>
                <input
                  type="number" step="0.05" min="0" max="1" value={form.rag_score_threshold}
                  onChange={(e) => setForm({ ...form, rag_score_threshold: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum similarity</p>
              </div>
            </div>
          </motion.div>

          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      )}
    </div>
  );
}