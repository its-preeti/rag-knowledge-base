import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, FileText, MessageSquare, Search, Settings,
  LogOut, Moon, Sun, ChevronLeft, ChevronRight, Shield,
  Database, User, Bell, Plus, FolderOpen
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useThemeStore } from '@/store/theme.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { workspacesApi } from '@/services/api';
import { authApi } from '@/services/api';
import { cn } from '@/utils/helpers';
import toast from 'react-hot-toast';
import { WorkspaceSwitcher } from '@/components/workspaces/WorkspaceSwitcher';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/workspaces', icon: FolderOpen, label: 'Workspaces' },
];

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { currentWorkspace, setWorkspaces, setCurrentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    workspacesApi.getAll().then((res) => {
      const workspaces = res.data;
      setWorkspaces(workspaces);
      if (!currentWorkspace && workspaces.length > 0) {
        setCurrentWorkspace(workspaces.find((w: any) => w.isDefault) || workspaces[0]);
      }
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    logout();
    navigate('/auth/login');
    toast.success('Logged out successfully');
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={cn(
          'fixed lg:relative h-full z-50 flex flex-col bg-card border-r border-border',
          'transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Database className="w-4 h-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-bold text-lg truncate"
              >
                KnowledgeAI
              </motion.span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-1.5 rounded-md hover:bg-accent text-muted-foreground hidden lg:flex"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Workspace switcher */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-border">
            <WorkspaceSwitcher />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground',
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}

          {user?.role && ['ADMIN', 'SUPER_ADMIN'].includes(user.role) && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                )
              }
            >
              <Shield className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Admin</span>}
            </NavLink>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="px-2 py-3 border-t border-border space-y-0.5">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {user?.role && ['ADMIN', 'SUPER_ADMIN'].includes(user.role) && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all',
                  isActive && 'bg-primary/10 text-primary',
                )
              }
            >
              <Settings className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Settings</span>}
            </NavLink>
          )}

          {/* User profile */}
          <NavLink
            to="/profile"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-all"
          >
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="w-3 h-3 text-primary" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            )}
          </NavLink>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="flex items-center h-14 px-4 border-b border-border lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-md hover:bg-accent">
            <Database className="w-5 h-5" />
          </button>
          <span className="ml-3 font-semibold">KnowledgeAI</span>
        </div>

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}