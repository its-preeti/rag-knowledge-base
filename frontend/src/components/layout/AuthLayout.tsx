import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { motion } from 'framer-motion';
import { Database } from 'lucide-react';

export function AuthLayout() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-background">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="relative z-10 flex flex-col justify-center px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                <Database className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold">KnowledgeAI</span>
            </div>
            <h1 className="text-4xl font-bold mb-4 leading-tight">
              Chat with your
              <br />
              <span className="text-primary">documents</span> using AI
            </h1>
            <p className="text-muted-foreground text-lg mb-8 max-w-md">
              Upload PDFs, Word docs, images, and more. Ask questions and get accurate answers with source citations.
            </p>
            <div className="space-y-4">
              {[
                { icon: '📄', text: 'Support for 10+ file formats' },
                { icon: '🔍', text: 'Semantic & hybrid search' },
                { icon: '💬', text: 'Real-time streaming responses' },
                { icon: '📌', text: 'Source citations with page numbers' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 text-muted-foreground">
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Database className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">KnowledgeAI</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}