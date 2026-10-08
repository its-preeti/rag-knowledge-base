import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, AlignLeft, Layers, FileText, ChevronRight, Filter, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchApi, chatApi } from '@/services/api';
import { useWorkspaceStore } from '@/store/workspace.store';
import { cn, formatRelativeTime, getFileIcon } from '@/utils/helpers';
import { useDebounce } from 'use-debounce';
import toast from 'react-hot-toast';

const MODES = [
  { value: 'hybrid', label: 'Hybrid', icon: Layers, desc: 'Best results' },
  { value: 'semantic', label: 'Semantic', icon: Sparkles, desc: 'Meaning-based' },
  { value: 'keyword', label: 'Keyword', icon: AlignLeft, desc: 'Exact match' },
];

function ResultCard({ result, onChat }: { result: any; onChat: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5">{getFileIcon(result.metadata?.fileType || '')}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="font-medium text-sm truncate">{result.documentName}</p>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                {Math.round(result.score * 100)}% match
              </span>
              {result.searchType && (
                <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-md">
                  {result.searchType}
                </span>
              )}
            </div>
          </div>
          {result.pageNumber && (
            <p className="text-xs text-muted-foreground mb-2">Page {result.pageNumber}</p>
          )}
          <p className={cn('text-sm text-muted-foreground leading-relaxed', !expanded && 'line-clamp-3')}>
            {result.content}
          </p>
          {result.content.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary hover:underline mt-1"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-border">
        <button
          onClick={onChat}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs hover:bg-primary/20 transition-all"
        >
          <ChevronRight className="w-3 h-3" /> Ask about this
        </button>
      </div>
    </motion.div>
  );
}

export function SearchPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'semantic' | 'keyword' | 'hybrid'>('hybrid');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [debouncedQuery] = useDebounce(query, 500);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery, currentWorkspace?.id, mode, fileTypeFilter],
    queryFn: () =>
      searchApi.search({
        q: debouncedQuery,
        workspaceId: currentWorkspace?.id,
        mode,
        fileTypes: fileTypeFilter || undefined,
        limit: 20,
      }).then((r) => r.data),
    enabled: !!debouncedQuery && !!currentWorkspace,
  });

  const handleChatAbout = async (result: any) => {
    try {
      const res = await chatApi.create({
        workspaceId: currentWorkspace?.id,
        title: `About: ${result.documentName}`,
      });
      navigate(`/chat/${res.data.id}`);
    } catch { toast.error('Failed to create chat'); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Search</h1>
        <p className="text-sm text-muted-foreground">Search across your documents using AI-powered semantic search</p>
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your documents..."
          className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isFetching && (
          <div className="absolute right-12 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 mb-4">
        {MODES.map(({ value, label, icon: Icon, desc }) => (
          <button
            key={value}
            onClick={() => setMode(value as any)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all',
              mode === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent text-muted-foreground',
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
        <select
          value={fileTypeFilter}
          onChange={(e) => setFileTypeFilter(e.target.value)}
          className="ml-auto px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none text-muted-foreground"
        >
          <option value="">All types</option>
          {['pdf', 'docx', 'txt', 'csv', 'json', 'md', 'jpg', 'png'].map((t) => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {!query ? (
          <div className="text-center py-20 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-1">Start searching</p>
            <p className="text-sm">Enter a query to search across all your documents</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array(4).fill(0).map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : !data?.results?.length ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium mb-1">No results found</p>
            <p className="text-sm">Try different keywords or switch search mode</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <p className="text-sm text-muted-foreground mb-3">
              Found <span className="font-medium text-foreground">{data.results.length}</span> results
              {data.results.length > 0 && ` using ${mode} search`}
            </p>
            {data.results.map((result: any, i: number) => (
              <ResultCard key={`${result.documentId}_${result.chunkIndex}_${i}`} result={result} onChat={() => handleChatAbout(result)} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}