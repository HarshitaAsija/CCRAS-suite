import React from 'react';
import { ChevronRight } from 'lucide-react';

interface Citation {
  id: string;
  title: string;
  authors?: string[];
  journal?: string;
  year?: number;
  doi?: string;
}

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
  onCitationClick?: (citation: Citation) => void;
}

export function ChatBubble({ 
  role, 
  content, 
  citations, 
  isStreaming,
  onCitationClick 
}: ChatBubbleProps) {
  const isUser = role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-2xl px-4 py-2 rounded-lg ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white border border-gray-200 text-gray-800'
        }`}
      >
        <p className="whitespace-pre-wrap">{content}</p>
        {isStreaming && (
          <span className="inline-block w-2 h-2 ml-1 bg-gray-400 rounded-full animate-pulse" />
        )}
        
        {/* Citations Display */}
        {citations && citations.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-200">
            <p className="text-xs font-semibold text-blue-600 flex items-center gap-1 mb-2">
              📚 Sources
            </p>
            <div className="space-y-1.5">
              {citations.map((cite, idx) => (
                <div
                  key={idx}
                  onClick={() => onCitationClick?.(cite)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition cursor-pointer group"
                >
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-gray-600 group-hover:text-gray-900 transition truncate flex-1">
                    {cite.title || "Untitled Paper"}
                  </span>
                  <ChevronRight className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}