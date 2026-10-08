import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, KeyRound, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { authApi } from '@/services/api';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Invalid email'),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.forgotPassword(data.email);
      setSuccess(true);
      if (res.data?.resetLink) {
        setResetUrl(res.data.resetLink);
      }
      toast.success('Reset link generated!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate reset link');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Forgot password?</h2>
        <p className="text-muted-foreground">Enter your email to request a reset link</p>
      </div>

      {!success ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Reset Link
          </button>
        </form>
      ) : (
        <div className="text-center py-6 space-y-4 bg-primary/5 border border-primary/20 rounded-xl px-4">
          <CheckCircle className="w-12 h-12 text-primary mx-auto animate-pulse" />
          <div>
            <h3 className="font-semibold text-foreground text-lg">Verification Sent!</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              For local testing and offline modes, use the generated reset link below to update your password:
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link to="/auth/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to login
        </Link>
      </div>
    </motion.div>
  );
}