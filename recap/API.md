# Aakriti's API Documentation
## Semantic Search + RAG Chat Pipeline

Base URL: `http://localhost:8000`

---

## 1. Semantic Search
**Endpoint:** `POST /api/search/semantic`

**What it does:** Takes a plain English query, finds papers by meaning using vector similarity.

**Request:**
```json
{
  "query": "ayurvedic herbs for diabetes",
  "top_k": 5
}
```

**Response:**
```json
{
  "query": "ayurvedic herbs for diabetes",
  "total_found": 5,
  "papers": [
    {
      "id": "uuid",
      "title": "Paper title here",
      "abstract": "Paper abstract...",
      "authors": [],
      "journal": "Journal name",
      "doi": "10.xxxx/xxxxx",
      "published_date": "2023",
      "keywords": ["keyword1", "keyword2"],
      "similarity_score": 0.87,
      "matched_chunk": "The specific excerpt that matched your query..."
    }
  ]
}
```

---

## 2. RAG Chat (Normal)
**Endpoint:** `POST /api/rag/chat`

**What it does:** Takes a question, finds relevant papers, generates AI answer citing those papers. Returns full response at once.

**Request:**
```json
{
  "question": "What herbs help with diabetes?",
  "session_id": null,
  "user_id": null
}
```

**Response:**
```json
{
  "session_id": "uuid-of-session",
  "question": "What herbs help with diabetes?",
  "answer": "Based on the paper 'Ayurvedic herbs...' curcumin has been shown to...",
  "cited_papers": [
    {
      "id": "uuid",
      "title": "Paper title",
      "doi": "10.xxxx/xxxxx"
    }
  ]
}
```

---

## 3. RAG Chat (Streaming) ⭐ Recommended for UI
**Endpoint:** `POST /api/rag/chat/stream`

**What it does:** Same as above but streams answer token by token like ChatGPT. Use this for the chat UI.

**Request:** Same as above
```json
{
  "question": "What herbs help with diabetes?",
  "session_id": null,
  "user_id": null
}
```

**Response:** Server-Sent Events (SSE stream)

**How to handle in frontend (React):**
```javascript
const response = await fetch('http://localhost:8000/api/rag/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: "your question here" })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
  
  for (const line of lines) {
    const data = JSON.parse(line.replace('data: ', ''));
    
    if (data.type === 'token') {
      // Append token to UI
      setAnswer(prev => prev + data.content);
    } else if (data.type === 'citations') {
      // Show cited papers
      setCitedPapers(data.papers);
    } else if (data.type === 'done') {
      // Save session_id for continuing conversation
      setSessionId(data.session_id);
    }
  }
}
```

---

## 4. Chat History
**Endpoint:** `GET /api/rag/history/{session_id}`

**What it does:** Returns all messages for a chat session.

**Response:**
```json
{
  "session_id": "uuid",
  "messages": [
    {
      "role": "user",
      "content": "What herbs help with diabetes?",
      "created_at": "2024-01-01T00:00:00"
    },
    {
      "role": "assistant", 
      "content": "Based on the papers...",
      "cited_paper_ids": ["uuid1", "uuid2"],
      "created_at": "2024-01-01T00:00:01"
    }
  ]
}
```

---

## 5. Get All Sessions
**Endpoint:** `GET /api/rag/sessions`

**Optional query param:** `?user_id=xxx`

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "title": "What herbs help with diabetes?",
      "created_at": "2024-01-01T00:00:00"
    }
  ]
}
```

---

## Quick Test (copy paste in terminal)

**Test Search:**
```bash
curl -X POST http://localhost:8000/api/search/semantic \
  -H "Content-Type: application/json" \
  -d '{"query": "ayurvedic herbs for diabetes", "top_k": 3}'
```

**Test RAG Chat:**
```bash
curl -X POST http://localhost:8000/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What herbs help with diabetes?"}'
```

**Or use Swagger UI:** `http://localhost:8000/docs`

---

## Supabase Tables Used
- `paper_chunks` — vector embeddings of all papers
- `chat_sessions` — stores each conversation
- `chat_messages` — stores each message with cited paper IDs