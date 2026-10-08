import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspace.store';
import { cn } from '@/utils/helpers';
import { useNavigate } from 'react-router-dom';

export function WorkspaceSwitcher() {
  const { currentWorkspace, workspaces, setCurrentWorkspace } = useWorkspaceStore();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-sm font-medium transition-all"
      >
        <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-xs text-primary font-bold">
            {currentWorkspace?.name?.charAt(0).toUpperCase() || 'W'}
          </span>
        </div>
        <span className="flex-1 text-left truncate text-sm">
          {currentWorkspace?.name || 'Select Workspace'}
        </span>
        <ChevronsUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-1 max-h-48 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => { setCurrentWorkspace(ws); setOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-sm transition-all text-left"
              >
                <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-xs text-primary font-bold">{ws.name.charAt(0).toUpperCase()}</span>
                </div>
                <span className="flex-1 truncate">{ws.name}</span>
                {currentWorkspace?.id === ws.id && <Check className="w-3 h-3 text-primary shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-1">
            <button
              onClick={() => { setOpen(false); navigate('/workspaces'); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-sm text-muted-foreground transition-all"
            >
              <Plus className="w-3 h-3" />
              <span>Manage Workspaces</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}