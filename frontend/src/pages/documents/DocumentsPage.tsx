import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  Upload, Search, Filter, Trash2, RefreshCw, FileText,
  Grid, List, X, Plus, ChevronDown, Eye, Download, Pencil,
  Loader2, CheckCircle2, Clock, AlertCircle, Tag,
} from 'lucide-react';
import { documentsApi } from '@/services/api';
import { useWorkspaceStore } from '@/store/workspace.store';
import { formatBytes, formatRelativeTime, getFileIcon, getStatusBadgeClass, cn } from '@/utils/helpers';
import toast from 'react-hot-toast';

const FILE_TYPES = ['pdf', 'docx', 'txt', 'csv', 'json', 'md', 'jpg', 'png', 'jpeg', 'webp', 'zip'];

function UploadProgress({ file, progress, status }: { file: string; progress: number; status: 'uploading' | 'done' | 'error' }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
      <span className="text-lg">{getFileIcon(file.split('.').pop() || '')}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file}</p>
        <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', status === 'error' ? 'bg-red-500' : 'bg-primary')}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
      {status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
      {status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
      {status === 'uploading' && <span className="text-xs text-muted-foreground shrink-0">{progress}%</span>}
    </div>
  );
}

function RenameModal({ doc, onClose, onRename }: any) {
  const [name, setName] = useState(doc.name);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-xl p-6 w-full max-w-sm"
      >
        <h3 className="font-semibold mb-4">Rename Document</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
          onKeyDown={(e) => { if (e.key === 'Enter') onRename(name); if (e.key === 'Escape') onClose(); }}
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm hover:bg-accent transition-all">Cancel</button>
          <button
            onClick={() => onRename(name)}
            className="px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            Rename
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function DocumentsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [uploads, setUploads] = useState<{ name: string; progress: number; status: 'uploading' | 'done' | 'error' }[]>([]);
  const [renaming, setRenaming] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', currentWorkspace?.id, search, filterType, filterStatus],
    queryFn: () =>
      documentsApi.getAll({
        workspaceId: currentWorkspace?.id,
        search: search || undefined,
        fileType: filterType || undefined,
        status: filterStatus || undefined,
        limit: 50,
      }).then((r) => r.data),
    enabled: !!currentWorkspace,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted');
    },
    onError: () => toast.error('Failed to delete document'),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => documentsApi.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document queued for reprocessing');
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => documentsApi.rename(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setRenaming(null);
      toast.success('Document renamed');
    },
  });

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!currentWorkspace) return toast.error('Please select a workspace');

      const newUploads = acceptedFiles.map((f) => ({ name: f.name, progress: 0, status: 'uploading' as const }));
      setUploads((prev) => [...prev, ...newUploads]);

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspaceId', currentWorkspace.id);

        try {
          await documentsApi.upload(formData, (progress) => {
            setUploads((prev) =>
              prev.map((u, idx) => (u.name === file.name ? { ...u, progress } : u)),
            );
          });
          setUploads((prev) =>
            prev.map((u) => (u.name === file.name ? { ...u, progress: 100, status: 'done' } : u)),
          );
        } catch {
          setUploads((prev) =>
            prev.map((u) => (u.name === file.name ? { ...u, status: 'error' } : u)),
          );
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setTimeout(() => setUploads([]), 3000);
    },
    [currentWorkspace, queryClient],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'text/markdown': ['.md'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/zip': ['.zip'],
    },
  });

  const documents = data?.data || [];
  const total = data?.meta?.total || 0;

  return (
    <div {...getRootProps()} className={cn('flex flex-col h-full', isDragActive && 'drop-zone-active ring-2 ring-primary ring-inset')}>
      <input {...getInputProps()} />

      {/* Drag overlay */}
      <AnimatePresence>
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm pointer-events-none"
          >
            <div className="text-center">
              <Upload className="w-16 h-16 text-primary mx-auto mb-3" />
              <p className="text-xl font-semibold text-primary">Drop files here</p>
              <p className="text-muted-foreground text-sm mt-1">Supports PDF, DOCX, TXT, CSV, JSON, MD, images, ZIP</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Documents</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{total} documents in {currentWorkspace?.name || 'workspace'}</p>
          </div>
          <button
            onClick={open}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" /> Upload
          </button>
        </div>

        {/* Search + filters */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all', showFilters ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent')}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            <ChevronDown className={cn('w-3 h-3 transition-transform', showFilters && 'rotate-180')} />
          </button>
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView('list')} className={cn('px-3 py-2', view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setView('grid')} className={cn('px-3 py-2', view === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-3 pt-3">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm focus:outline-none"
                >
                  <option value="">All file types</option>
                  {FILE_TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm focus:outline-none"
                >
                  <option value="">All statuses</option>
                  {['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].map((s) => (
                    <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                  ))}
                </select>
                {(filterType || filterStatus) && (
                  <button
                    onClick={() => { setFilterType(''); setFilterStatus(''); }}
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="px-6 py-3 border-b border-border space-y-2">
          {uploads.map((u, i) => (
            <UploadProgress key={i} file={u.name} progress={u.progress} status={u.status} />
          ))}
        </div>
      )}

      {/* Document list */}
      <div className="flex-1 overflow-auto p-6">
        {!currentWorkspace ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="w-12 h-12 text-muted-foreground opacity-30 mb-3" />
            <p className="font-medium">No workspace selected</p>
            <p className="text-sm text-muted-foreground">Please select a workspace from the sidebar</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-border rounded-xl">
            <Upload className="w-12 h-12 text-muted-foreground opacity-30 mb-3" />
            <p className="font-medium">No documents yet</p>
            <p className="text-sm text-muted-foreground mb-4">Drag & drop files or click Upload to get started</p>
            <button
              onClick={open}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all"
            >
              Upload Documents
            </button>
          </div>
        ) : view === 'list' ? (
          <div className="space-y-2">
            {documents.map((doc: any, i: number) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/30 transition-all group"
              >
                <span className="text-2xl">{getFileIcon(doc.fileType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                    <span>{formatBytes(doc.size)}</span>
                    {doc.pageCount && <span>{doc.pageCount} pages</span>}
                    {doc.wordCount && <span>{doc.wordCount.toLocaleString()} words</span>}
                    <span>{formatRelativeTime(doc.createdAt)}</span>
                  </div>
                  {doc.tags?.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {doc.tags.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadgeClass(doc.status)}`}>
                  {doc.status === 'PROCESSING' && <Loader2 className="w-3 h-3 inline animate-spin mr-1" />}
                  {doc.status.toLowerCase()}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <button
                    onClick={() => setRenaming(doc)}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
                    title="Rename"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {doc.status === 'FAILED' && (
                    <button
                      onClick={() => retryMutation.mutate(doc.id)}
                      className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
                      title="Retry"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${doc.name}"?`)) deleteMutation.mutate(doc.id);
                    }}
                    className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {documents.map((doc: any, i: number) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all group"
              >
                <div className="text-4xl mb-3 text-center">{getFileIcon(doc.fileType)}</div>
                <p className="text-sm font-medium text-center truncate mb-1">{doc.name}</p>
                <p className="text-xs text-muted-foreground text-center">{formatBytes(doc.size)}</p>
                <div className="flex justify-center mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusBadgeClass(doc.status)}`}>
                    {doc.status.toLowerCase()}
                  </span>
                </div>
                <div className="flex justify-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => setRenaming(doc)}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${doc.name}"?`)) deleteMutation.mutate(doc.id); }}
                    className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {renaming && (
        <RenameModal
          doc={renaming}
          onClose={() => setRenaming(null)}
          onRename={(name: string) => renameMutation.mutate({ id: renaming.id, name })}
        />
      )}
    </div>
  );
}