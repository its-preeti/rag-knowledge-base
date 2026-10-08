import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Send, ArrowLeft, RefreshCw, Copy, Check, Trash2,
  Pencil, Download, FileText, Loader2, Bot, User,
  Paperclip, Mic, MicOff, ChevronDown, ExternalLink,
} from 'lucide-react';
import { chatApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { formatRelativeTime, cn, downloadBlob } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  sources?: any[];
  tokensUsed?: number;
  createdAt: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-all">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function SourceCard({ source }: { source: any }) {
  return (
    <div className="flex items-start gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg text-xs">
      <FileText className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium text-primary truncate">{source.documentName}</p>
        {source.pageNumber && <p className="text-muted-foreground">Page {source.pageNumber}</p>}
        {source.excerpt && <p className="text-muted-foreground mt-0.5 line-clamp-2">{source.excerpt}</p>}
      </div>
    </div>
  );
}

function MessageBubble({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const isUser = message.role === 'USER';
  const [showSources, setShowSources] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1',
        isUser ? 'bg-primary/20' : 'bg-secondary border border-border',
      )}>
        {isUser ? <User className="w-4 h-4 text-primary" /> : <Bot className="w-4 h-4 text-foreground" />}
      </div>

      <div className={cn('max-w-[95%] md:max-w-[85%] space-y-1 min-w-0', isUser ? 'items-end' : 'items-start', 'flex flex-col')}>
        <div className={cn(
          'px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-full overflow-x-auto',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-card border border-border rounded-tl-sm',
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className={cn('chat-prose break-words max-w-full', isStreaming && 'typing-cursor')}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="relative group/code">
                        <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-all">
                          <CopyButton text={String(children)} />
                        </div>
                        <SyntaxHighlighter
                          style={oneDark as any}
                          language={match[1]}
                          PreTag="div"
                          className="!rounded-lg !text-xs !max-w-full"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className={cn('flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all px-1', isUser ? 'flex-row-reverse' : '')}>
          <CopyButton text={message.content} />
          {message.tokensUsed && (
            <span className="text-xs text-muted-foreground">{message.tokensUsed} tokens</span>
          )}
          <span className="text-xs text-muted-foreground">{formatRelativeTime(message.createdAt)}</span>
        </div>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <FileText className="w-3 h-3" />
              {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
              <ChevronDown className={cn('w-3 h-3 transition-transform', showSources && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-2 space-y-1.5"
                >
                  {(message.sources as any[]).map((s: any, i: number) => <SourceCard key={i} source={s} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ChatConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isListening, setIsListening] = useState(false);

  const { data: chat, isLoading } = useQuery({
    queryKey: ['chat', id],
    queryFn: () => chatApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });

  const renameMutation = useMutation({
    mutationFn: (title: string) => chatApi.rename(id!, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', id] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      setRenamingTitle(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => chatApi.delete(id!),
    onSuccess: () => { navigate('/chat'); toast.success('Chat deleted'); },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages, streamingContent]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const userMessage = input.trim();
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    // Optimistic user message
    queryClient.setQueryData(['chat', id], (old: any) => ({
      ...old,
      messages: [
        ...(old?.messages || []),
        { id: 'temp', role: 'USER', content: userMessage, createdAt: new Date().toISOString() },
      ],
    }));

    try {
      const isProd = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' || (import.meta as any).env?.PROD;
      const apiBaseUrl = isProd ? 'https://rag-backend-zy02.onrender.com/api' : '/api';

      const response = await fetch(`${apiBaseUrl}/chats/${id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json', // Inform backend we prefer stream but accept JSON fallback
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ content: userMessage }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const contentType = response.headers.get('content-type');
      
      // If server falls back to static JSON response (due to proxy block)
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        setStreamingContent(data.content || '');
        queryClient.invalidateQueries({ queryKey: ['chat', id] });
        queryClient.invalidateQueries({ queryKey: ['chats'] });
        return;
      }

      // Standard SSE stream response reader
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      abortRef.current = () => reader.cancel();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'delta') {
              fullContent += data.content;
              setStreamingContent(fullContent);
            } else if (data.type === 'done') {
              queryClient.invalidateQueries({ queryKey: ['chat', id] });
              queryClient.invalidateQueries({ queryKey: ['chats'] });
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
      queryClient.invalidateQueries({ queryKey: ['chat', id] });
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [input, isStreaming, id, accessToken, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const exportPdf = async () => {
    try {
      const res = await chatApi.exportPdf(id!);
      downloadBlob(res.data, `chat-${id}.pdf`);
    } catch { toast.error('Failed to export PDF'); }
  };

  const exportMarkdown = async () => {
    try {
      const res = await chatApi.exportMarkdown(id!);
      downloadBlob(res.data, `chat-${id}.md`);
    } catch { toast.error('Failed to export Markdown'); }
  };

  // Voice input via Web Speech API
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return toast.error('Voice input not supported in this browser');
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => prev + transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  const messages: Message[] = chat?.messages || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
        <button
          onClick={() => navigate('/chat')}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {renamingTitle ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => renameMutation.mutate(editTitle)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') renameMutation.mutate(editTitle);
              if (e.key === 'Escape') setRenamingTitle(false);
            }}
            className="flex-1 px-2 py-1 rounded bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        ) : (
          <div
            className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer group"
            onClick={() => { setEditTitle(chat?.title || ''); setRenamingTitle(true); }}
          >
            <h1 className="font-semibold truncate">{chat?.title || 'Chat'}</h1>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-all" />
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={exportPdf} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-all" title="Export PDF">
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => { if (confirm('Delete this chat?')) deleteMutation.mutate(); }}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">How can I help you?</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Ask me anything about your uploaded documents. I'll find relevant information and cite my sources.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 max-w-md w-full">
              {[
                'Summarize the main points',
                'What are the key findings?',
                'Explain the methodology',
                'List all conclusions',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-2 text-left text-sm bg-secondary hover:bg-accent border border-border rounded-lg transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <MessageBubble
            message={{
              id: 'streaming',
              role: 'ASSISTANT',
              content: streamingContent,
              createdAt: new Date().toISOString(),
            }}
            isStreaming
          />
        )}

        {/* Streaming indicator */}
        {isStreaming && !streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border p-4 bg-background/50 backdrop-blur-xl shrink-0 sticky bottom-0">
        <div className="max-w-4xl mx-auto">
          <div className="relative flex items-end gap-2 bg-card border border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl p-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              rows={1}
              style={{ resize: 'none', maxHeight: '160px' }}
              className="flex-1 bg-transparent text-sm sm:text-[15px] focus:outline-none px-4 py-3 placeholder:text-muted-foreground/70 leading-relaxed custom-scrollbar overflow-hidden"
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 160) + 'px';
              }}
            />
            <div className="flex items-center gap-1.5 shrink-0 px-1 pb-1">
              <button
                onClick={startListening}
                className={cn(
                  'p-2.5 rounded-xl transition-all',
                  isListening 
                    ? 'bg-red-500 text-white shadow-sm' 
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
                title="Voice input"
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              {isStreaming ? (
                <button
                  onClick={() => abortRef.current?.()}
                  className="p-2.5 rounded-xl bg-red-500 text-white shadow-sm hover:bg-red-600 transition-all flex items-center justify-center"
                  title="Stop generating"
                >
                  <RefreshCw className="w-5 h-5 animate-spin-slow" />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all flex items-center justify-center"
                  title="Send message"
                >
                  <Send className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/60 text-center mt-3 font-medium tracking-wide">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}