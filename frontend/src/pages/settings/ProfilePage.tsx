import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { User, Lock, Save, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { usersApi } from '@/services/api';
import toast from 'react-hot-toast';

export function ProfilePage() {
  const { user, setUser } = useAuthStore();

  const profileForm = useForm({ defaultValues: { firstName: user?.firstName || '', lastName: user?.lastName || '' } });
  const passwordForm = useForm({ defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });

  const profileMutation = useMutation({
    mutationFn: (data: any) => usersApi.updateProfile(data),
    onSuccess: (res) => { setUser(res.data); toast.success('Profile updated'); },
    onError: () => toast.error('Failed to update profile'),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: any) => {
      if (data.newPassword !== data.confirmPassword) throw new Error('Passwords do not match');
      return usersApi.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
    },
    onSuccess: () => { passwordForm.reset(); toast.success('Password changed successfully'); },
    onError: (err: any) => toast.error(err.message || 'Failed to change password'),
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your account settings</p>
        </div>
      </div>

      {/* Avatar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div>
            <p className="font-semibold text-lg">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-1 inline-block">{user?.role}</span>
          </div>
        </div>
      </motion.div>

      {/* Profile form */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Personal Information</h2>
        <form onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">First Name</label>
              <input {...profileForm.register('firstName')} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Last Name</label>
              <input {...profileForm.register('lastName')} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <input value={user?.email || ''} disabled className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-muted-foreground cursor-not-allowed" />
          </div>
          <button type="submit" disabled={profileMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all">
            {profileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </form>
      </motion.div>

      {/* Password form */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Lock className="w-4 h-4" /> Change Password</h2>
        <form onSubmit={passwordForm.handleSubmit((d) => passwordMutation.mutate(d))} className="space-y-4">
          {[
            { name: 'currentPassword', label: 'Current Password' },
            { name: 'newPassword', label: 'New Password' },
            { name: 'confirmPassword', label: 'Confirm New Password' },
          ].map(({ name, label }) => (
            <div key={name}>
              <label className="text-sm font-medium mb-1.5 block">{label}</label>
              <input
                type="password"
                {...passwordForm.register(name as any)}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          ))}
          <button type="submit" disabled={passwordMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all">
            {passwordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Change Password
          </button>
        </form>
      </motion.div>
    </div>
  );
}