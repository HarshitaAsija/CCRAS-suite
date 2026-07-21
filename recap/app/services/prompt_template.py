from typing import List, Dict

CITATION_TEMPLATE = """
You are a research assistant analyzing academic papers. Answer based ONLY on the provided context.

**Context from Papers:**
{context}

**Question:** {question}

**Instructions:**
1. Answer ONLY using information from the context
2. For each claim, cite using [source_id]
3. If not found, say "I couldn't find this information"
4. Reference paper titles when possible

**Response:**
"""

SYNTHESIS_TEMPLATE = """
Synthesize information from multiple papers.

**Sources:**
{sources}

**Task:** {task}

**Instructions:**
1. Compare findings across papers
2. Identify common themes
3. Cite sources appropriately

**Synthesis:**
"""

def create_citation_prompt(context: str, question: str) -> str:
    return CITATION_TEMPLATE.format(context=context, question=question)

def create_synthesis_prompt(sources: List[Dict], task: str) -> str:
    sources_text = "\n\n".join([
        f"Source {i+1}: {s.get('title', 'Unknown')}\n{s.get('content', '')}"
        for i, s in enumerate(sources)
    ])
    return SYNTHESIS_TEMPLATE.format(sources=sources_text, task=task)

def format_chunks(chunks: List[Dict]) -> str:
    formatted = []
    for i, chunk in enumerate(chunks, 1):
        title = chunk.get('title', 'Untitled')
        content = chunk.get('content', '')
        formatted.append(f"[{i}] From '{title}':\n{content}")
    return "\n\n".join(formatted)