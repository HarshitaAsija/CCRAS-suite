import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Loader, ChevronUp, ChevronDown } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{
    id: string;
    title: string;
    year?: string;
    journal?: string;
  }>;
  confidence_score?: number;
  confidence_level?: string;
}

interface RagPanelProps = {};

export const RagPanel: React.FC<RagPanelProps> = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>(() => {
    // Generate a random session ID for demo purposes
    return Math.random().toString(36).substring(2, 15);
  });
  const messagesEndRef = useRef<div>(null);

  // Determine if we are in dev mode (for authentication)
  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  const authHeaders = isDevMode
    ? { Authorization: `Bearer dev-token` }
    : {};

  // Scroll to the bottom of the chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const question = input;
    setInput('');
    setLoading(true);

    // Add user message to chat
    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: question,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch('/api/rag/chat/enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          question,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get response: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: data.answer,
        citations: data.cited_papers?.map((paper: any) => ({
          id: paper.id,
          title: paper.title,
          year: paper.published_date?.substring(0, 4) ?? '',
          journal: paper.journal,
        })),
        confidence_score: data.confidence_score,
        confidence_level: data.confidence_level,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
      // Add an error message
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content:
          'Sorry, something went wrong. Please try again later.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[80%] ${
              msg.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'mr-auto bg-muted'
            } rounded-lg px-4 py-2`}
          >
            <div className="text-sm font-medium mb-1">
              {msg.role === 'user' ? 'You' : 'Assistant'}
            </div>
            <p className="text-sm">{msg.content}</p>
            {msg.citations && msg.citations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {msg.citations.map((cite) => (
                  <span
                    key={cite.id}
                    className="badge badge-outline bg-primary/20 text-primary/80"
                  >
                    {cite.title}
                  </span>
                ))}
              </div>
            )}
            {(msg.confidence_score !== undefined &&
              msg.confidence_level !== undefined) && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="badge badge-outline">
                  Confidence: {Math.round(
                    msg.confidence_score * 100
                  )}% ({msg.confidence_level})
                </span>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {loading && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2">
            <Loader className="h-4 w-4" />
            <span className="text-sm">Thinking...</span>
          </div>
        </div>
      )}

      <div className="flex items-center p-4 bg-muted gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about the literature..."
          className="flex-1 input input-bordered"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="btn btn-primary"
        >
          {loading ? 'Sending...' : 'Ask'}
        </button>
      </div>
    </div>
  );
};