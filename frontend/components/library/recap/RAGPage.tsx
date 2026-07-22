// @ts-nocheck
// RAG Assistant Page
// Chat interface with streaming responses and source citations
// Features: session sidebar, chat bubbles, streaming indicator, cited papers
// File: /app/rag/page.tsx

"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Send,
  Plus,
  MessageSquare,
  Trash2,
  Bot,
  Sparkles,
  Clock,
  Menu,
  X,
  Copy,
  Download,
  Leaf,
  ChevronRight,
  Loader2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ========================================
// Types
// ========================================
interface Citation {
  id: string;
  title: string;
  authors?: string[];
  journal?: string;
  year?: number;
  doi?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence?: {
    score: number;
    level: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
  };
  timestamp: Date;
  isStreaming?: boolean;
}

interface Session {
  id: string;
  title: string;
  date: string;
  messageCount: number;
}

// ========================================
// Chat Bubble Component
// ========================================
const ChatBubble = ({
  message,
  onCitationClick
}: {
  message: ChatMessage;
  onCitationClick?: (citation: Citation) => void;
}) => {
  const getConfidenceColor = (level: string) => {
    switch (level) {
      case "HIGH": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "MEDIUM": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "LOW": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content);
  };

  return (
    <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] md:max-w-[75%] ${message.role === "user"
          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
          : "bg-card border border-border text-foreground rounded-2xl rounded-tl-sm"
        } p-4`}>
        {/* Message Header */}
        <div className="flex items-center gap-2 mb-1.5">
          {message.role === "assistant" && (
            <>
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-purple-700 flex items-center justify-center flex-shrink-0">
                <Bot className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">KRITA Assistant</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {formatTime(message.timestamp)}
              </span>
            </>
          )}
          {message.role === "user" && (
            <>
              <span className="text-xs text-primary-foreground/60 ml-auto">
                {formatTime(message.timestamp)}
              </span>
              <div className="w-6 h-6 rounded-lg bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            </>
          )}
        </div>

        {/* Message Content */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content || (message.isStreaming && (
            <span className="inline-flex items-center gap-1">
              <span className="animate-pulse">▊</span>
            </span>
          ))}
        </div>

        {/* Citations */}
        {message.role === "assistant" && message.citations && message.citations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs font-semibold text-primary flex items-center gap-1.5 mb-2">
              <MessageSquare className="h-3 w-3" /> Sources
            </p>
            <div className="space-y-1.5">
              {message.citations.map((cite, idx) => (
                <div
                  key={idx}
                  onClick={() => onCitationClick?.(cite)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/50 hover:bg-accent transition cursor-pointer group"
                >
                  <span className="text-[10px] font-bold text-primary bg-primary/20 px-1.5 py-0.5 rounded">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition truncate">
                    {cite.title || "Untitled Paper"}
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition ml-auto" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confidence */}
        {message.role === "assistant" && message.confidence && (
          <div className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${getConfidenceColor(message.confidence.level)}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {(message.confidence.score * 100).toFixed(0)}% · {message.confidence.level}
          </div>
        )}

        {/* Actions */}
        {message.role === "assistant" && message.content && !message.isStreaming && (
          <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-border/50">
            <button
              onClick={copyMessage}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ========================================
// Main Component
// ========================================
export default function RAGAssistantPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Login and load sessions
  useEffect(() => {
    loginAndLoadSessions();
  }, []);

  const loginAndLoadSessions = async () => {
    setIsInitializing(true);
    try {
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "username=newuser@example.com&password=test123"
      });

      if (loginRes.ok) {
        const data = await loginRes.json();
        setToken(data.access_token);
        await loadSessions(data.access_token);
      }
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  const loadSessions = async (authToken: string) => {
    try {
      const res = await fetch(`${API_URL}/api/rag/sessions`, {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const sessionsData = data.sessions || [];
        setSessions(sessionsData.map((s: any) => ({
          id: s.id,
          title: s.title || "Untitled",
          date: s.created_at ? new Date(s.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          messageCount: s.message_count || 0
        })));
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    }
  };

  const loadSession = async (sessionId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/rag/conversation/${sessionId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const historyMessages = data.messages || [];
        setMessages(historyMessages.map((msg: any) => ({
          id: crypto.randomUUID(),
          role: msg.role,
          content: msg.content,
          citations: msg.citations || [],
          timestamp: new Date(msg.created_at || Date.now())
        })));
        setActiveSession(sessionId);
      }
    } catch (error) {
      console.error("Error loading session:", error);
    }
  };

  const createNewSession = async () => {
    if (!token) return;

    try {
      // Create a new session with a title
      const title = newSessionTitle || "New Chat";
      const res = await fetch(`${API_URL}/api/rag/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          question: title,
          session_id: null
        })
      });

      if (res.ok) {
        const data = await res.json();
        const sessionId = data.session_id;

        const newSession: Session = {
          id: sessionId,
          title: title,
          date: new Date().toISOString().split("T")[0],
          messageCount: 1
        };

        setSessions((prev) => [newSession, ...prev]);
        setActiveSession(sessionId);
        setMessages([{
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer || "New session created. Ask me anything!",
          citations: data.cited_papers || [],
          timestamp: new Date()
        }]);
        setIsNewSessionDialogOpen(false);
        setNewSessionTitle("");
      }
    } catch (error) {
      console.error("Error creating session:", error);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    if (!token) return;

    try {
      await fetch(`${API_URL}/api/rag/conversation/${sessionId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSession === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !token) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      citations: [],
      timestamp: new Date(),
      isStreaming: true
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch(`${API_URL}/api/rag/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          question: userMessage.content,
          session_id: activeSession || undefined
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullAnswer = "";
      let citations: Citation[] = [];
      let confidence = null;
      let sessionId = null;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim().startsWith("data: ")) {
            try {
              const jsonStr = line.trim().substring(6);
              const data = JSON.parse(jsonStr);

              if (data.type === "token") {
                fullAnswer += data.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: fullAnswer }
                      : msg
                  )
                );
              } else if (data.type === "citations") {
                citations = data.papers || [];
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, citations }
                      : msg
                  )
                );
              } else if (data.type === "confidence") {
                confidence = data;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                        ...msg,
                        confidence: {
                          score: confidence.score,
                          level: confidence.level
                        }
                      }
                      : msg
                  )
                );
              } else if (data.type === "done") {
                sessionId = data.session_id;
                if (sessionId && !activeSession) {
                  setActiveSession(sessionId);
                  await loadSessions(token);
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, isStreaming: false }
            : msg
        )
      );

    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
              ...msg,
              content: "Sorry, something went wrong. Please try again.",
              isStreaming: false
            }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const exportChat = () => {
    if (messages.length === 0) return;
    let text = "KRITA RAG Assistant - Conversation Export\n";
    text += "=".repeat(50) + "\n\n";
    messages.forEach(msg => {
      text += `${msg.role === "user" ? "👤 User" : "🤖 Assistant"}: ${msg.content}\n\n`;
    });
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `krita-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading KRITA Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-40 w-72 bg-card border-r border-border
        h-full transition-transform duration-300 ease-in-out-300 ease-in-out flex flex-col
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Brand */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-purple-700 flex items-center justify-center shadow-lg shadow-primary/30">
              <Leaf className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">KRITA</h1>
              <p className="text-xs text-muted-foreground">Research Engine</p>
            </div>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3 flex-shrink-0">
          <Dialog open={isNewSessionDialogOpen} onOpenChange={setIsNewSessionDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" /> New Chat
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>New Chat Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Session title (optional)"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createNewSession()}
                  className="bg-background border-border text-foreground"
                />
                <Button
                  onClick={createNewSession}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Create Session
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Sessions List */}
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 pb-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-2 mb-2">
              Recent Sessions
            </p>
            {sessions.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No chat sessions yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Click "New Chat" to start</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                    activeSession === session.id
                      ? "bg-accent border border-border"
                      : "hover:bg-accent/50"
                  )}
                  onClick={() => loadSession(session.id)}
                >
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                    activeSession === session.id
                      ? "bg-primary/20"
                      : "bg-accent"
                  )}>
                    <MessageSquare className={cn(
                      "h-4 w-4",
                      activeSession === session.id ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      activeSession === session.id ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {session.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                      <Clock className="h-3 w-3" />
                      {session.date}
                      <span>• {session.messageCount} msgs</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => deleteSession(session.id, e)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-purple-700 flex items-center justify-center flex-shrink-0">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm truncate">
                {activeSession
                  ? sessions.find(s => s.id === activeSession)?.title || "Research Assistant"
                  : "Research Assistant"
                }
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                Powered by RAG
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={exportChat}
              title="Export chat"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 px-4 md:px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-16">
                <div className="h-20 w-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-4">
                  <Bot className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Welcome to KRITA Research Assistant</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Ask questions about research papers, get summaries, find related work,
                  or explore citation networks. I&apos;ll provide answers with citations.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("Explain retrieval-augmented generation")}
                    className="border-primary/30 hover:bg-primary/10"
                  >
                    Explain RAG
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("What papers discuss semantic search?")}
                    className="border-primary/30 hover:bg-primary/10"
                  >
                    Find papers on semantic search
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("Compare dense and sparse retrieval")}
                    className="border-primary/30 hover:bg-primary/10"
                  >
                    Compare retrieval methods
                  </Button>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  onCitationClick={setSelectedCitation}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  placeholder="Ask a question about research papers..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="h-12 bg-background border-border focus:border-primary focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Responses are grounded in your KRITA library. Citations link to source chunks.
            </p>
          </div>
        </div>
      </main>

      {/* Right Panel - Citation Details */}
      {selectedCitation && (
        <div className="fixed md:relative z-40 right-0 top-0 h-full w-80 md:w-96 bg-card border-l border-border overflow-y-auto p-6 shadow-2xl animate-in slide-in-from-right">
          <button
            onClick={() => setSelectedCitation(null)}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mt-4 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold">
              <MessageSquare className="h-3.5 w-3.5" /> Citation
            </div>
            <h3 className="text-lg font-bold">{selectedCitation.title || "Untitled"}</h3>
            <p className="text-sm text-muted-foreground">
              {selectedCitation.authors?.join(", ") || "Unknown authors"}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedCitation.journal && (
                <span className="text-xs bg-accent border border-border px-3 py-1 rounded-full text-muted-foreground">
                  {selectedCitation.journal}
                </span>
              )}
              {selectedCitation.year && (
                <span className="text-xs bg-accent border border-border px-3 py-1 rounded-full text-muted-foreground">
                  {selectedCitation.year}
                </span>
              )}
              {selectedCitation.doi && (
                <span className="text-xs bg-accent border border-border px-3 py-1 rounded-full text-muted-foreground">
                  DOI: {selectedCitation.doi}
                </span>
              )}
            </div>
            <div className="pt-4 border-t border-border">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Open Paper →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}