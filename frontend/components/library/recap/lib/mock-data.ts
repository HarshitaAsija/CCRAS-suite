// Mock data for RECAP/KRITA research paper platform
import { Paper, ChatMessage, Collection, UploadedFile } from '@/types/paper';

export const MOCK_PAPERS: Paper[] = [
  {
    id: '1',
    title: 'Deep Learning for Natural Language Processing: A Comprehensive Survey',
    authors: ['Zhang, Wei', 'Smith, John', 'Kumar, Raj'],
    journal: 'Journal of Artificial Intelligence Research',
    year: 2024,
    doi: '10.1234/jair.2024.001',
    abstract: 'This paper presents a comprehensive survey of deep learning techniques applied to natural language processing tasks. We review recent advances in transformer architectures, pre-trained language models, and their applications across various NLP domains including machine translation, text classification, and question answering.',
    keywords: ['deep learning', 'NLP', 'transformers', 'language models'],
    citations: 156,
  },
  {
    id: '2',
    title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    authors: ['Lewis, Patrick', 'Oguz, Barlas', 'Yu, Wen-tau'],
    journal: 'Advances in Neural Information Processing Systems',
    year: 2023,
    doi: '10.1234/neurips.2023.042',
    abstract: 'We introduce retrieval-augmented generation (RAG), a hybrid approach that combines dense passage retrieval with sequence-to-sequence generation. Our method achieves state-of-the-art results on open-domain question answering and fact verification tasks.',
    keywords: ['RAG', 'retrieval', 'generation', 'question answering'],
    citations: 892,
  },
  {
    id: '3',
    title: 'Vector Databases for Semantic Search: Performance and Scalability Analysis',
    authors: ['Chen, Lina', 'Patel, Amit', 'Johnson, Michael'],
    journal: 'IEEE Transactions on Knowledge and Data Engineering',
    year: 2024,
    doi: '10.1234/tkde.2024.015',
    abstract: 'This study evaluates the performance and scalability of modern vector databases for semantic search applications. We compare indexing strategies, query optimization techniques, and hardware configurations across leading platforms.',
    keywords: ['vector database', 'semantic search', 'embeddings', 'performance'],
    citations: 78,
  },
  {
    id: '4',
    title: 'Graph Neural Networks for Citation Recommendation',
    authors: ['Williams, Sarah', 'Brown, David'],
    journal: 'ACM Conference on Recommender Systems',
    year: 2023,
    doi: '10.1234/recsys.2023.089',
    abstract: 'We propose a graph neural network approach for citation recommendation that leverages both paper content and citation network structure. Our model outperforms traditional collaborative filtering and content-based baselines.',
    keywords: ['graph neural networks', 'citation analysis', 'recommendation', 'academic search'],
    citations: 234,
  },
  {
    id: '5',
    title: 'Attention Mechanisms in Document Understanding: A Survey',
    authors: ['Liu, Yang', 'Kim, Soo-Jin', 'Mueller, Klaus'],
    journal: 'Pattern Recognition Letters',
    year: 2024,
    doi: '10.1234/patrec.2024.033',
    abstract: 'This survey reviews attention mechanisms applied to document understanding tasks including layout analysis, information extraction, and visual question answering. We categorize approaches and identify emerging trends.',
    keywords: ['attention', 'document understanding', 'computer vision', 'multimodal'],
    citations: 45,
  },
  {
    id: '6',
    title: 'Hybrid Search Systems: Combining Lexical and Semantic Retrieval',
    authors: ['Thompson, Emma', 'Garcia, Carlos'],
    journal: 'Information Processing and Management',
    year: 2024,
    doi: '10.1234/ipm.2024.077',
    abstract: 'We present a hybrid search architecture that combines traditional lexical retrieval with dense semantic search. Our experiments show significant improvements in recall and user satisfaction across diverse query types.',
    keywords: ['hybrid search', 'semantic retrieval', 'BM25', 'embeddings'],
    citations: 67,
  },
  {
    id: '7',
    title: 'Large Language Models for Scientific Literature Review',
    authors: ['Anderson, Robert', 'Lee, Jennifer', 'Wang, Xiaoming'],
    journal: 'Nature Machine Intelligence',
    year: 2024,
    doi: '10.1234/nmi.2024.012',
    abstract: 'This paper explores the application of large language models to automate aspects of scientific literature review, including paper summarization, key finding extraction, and trend identification.',
    keywords: ['LLM', 'literature review', 'scientific papers', 'automation'],
    citations: 189,
  },
  {
    id: '8',
    title: 'Prompt Engineering for Academic Search: Best Practices and Pitfalls',
    authors: ['Martinez, Sofia', 'O\'Brien, Patrick'],
    journal: 'Journal of Academic Librarianship',
    year: 2023,
    doi: '10.1234/jal.2023.056',
    abstract: 'We provide guidelines for effective prompt engineering in academic search systems powered by large language models. Our study identifies common pitfalls and recommends strategies for improving retrieval quality.',
    keywords: ['prompt engineering', 'academic search', 'LLM', 'information retrieval'],
    citations: 112,
  },
  {
    id: '9',
    title: 'Citation Network Analysis Using Machine Learning',
    authors: ['Nguyen, Thuy', 'Ibrahim, Hassan', 'Schmidt, Hans'],
    journal: 'Scientometrics',
    year: 2024,
    doi: '10.1234/sciento.2024.028',
    abstract: 'This work applies machine learning techniques to analyze citation networks and predict emerging research trends. We validate our approach on computer science and biomedical domains.',
    keywords: ['citation analysis', 'network science', 'trend prediction', 'bibliometrics'],
    citations: 91,
  },
  {
    id: '10',
    title: 'Embedding Models for Domain-Specific Document Retrieval',
    authors: ['Cool, Rebecca', 'Fernandez, Luis'],
    journal: 'Expert Systems with Applications',
    year: 2024,
    doi: '10.1234/eswa.2024.045',
    abstract: 'We investigate domain-adaptive pre-training strategies for embedding models used in specialized document retrieval. Our results show significant gains when fine-tuning on domain corpora.',
    keywords: ['embeddings', 'domain adaptation', 'retrieval', 'pre-training'],
    citations: 53,
  },
];

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'What are the main approaches to retrieval-augmented generation?',
    timestamp: new Date('2024-06-14T10:30:00'),
  },
  {
    id: '2',
    role: 'assistant',
    content: `Retrieval-Augmented Generation (RAG) combines information retrieval with text generation. The main approaches include:

1. **Dense Passage Retrieval + Generation**: Uses dense embeddings to retrieve relevant passages, then conditions a seq2seq model on both the query and retrieved content.

2. **Sparse Retrieval + Generation**: Traditional BM25/TF-IDF retrieval combined with generative models for answer synthesis.

3. **Hybrid Approaches**: Combine dense and sparse retrieval for improved coverage, using techniques like reciprocal rank fusion.

4. **Iterative Retrieval**: Multiple rounds of retrieval and generation, where each iteration can refine the search based on intermediate results.

5. **End-to-End Training**: Jointly optimizing retrieval and generation components rather than treating them as separate stages.

Key papers in this area include Lewis et al. (2023) on RAG architectures and recent work on hybrid search systems.`,
    timestamp: new Date('2024-06-14T10:30:05'),
    citations: [
      { paperId: '2', title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks', doi: '10.1234/neurips.2023.042' },
      { paperId: '6', title: 'Hybrid Search Systems: Combining Lexical and Semantic Retrieval', doi: '10.1234/ipm.2024.077' },
    ],
  },
];

export const MOCK_COLLECTIONS: Collection[] = [
  { id: '1', name: 'RAG Papers', paperIds: ['2', '6'], createdAt: new Date('2024-06-01') },
  { id: '2', name: 'NLP Survey', paperIds: ['1', '5'], createdAt: new Date('2024-06-05') },
  { id: '3', name: 'To Read', paperIds: ['3', '7', '10'], createdAt: new Date('2024-06-10') },
];

export const MOCK_UPLOADED_FILES: UploadedFile[] = [
  { id: '1', name: 'paper_001.pdf', size: 2456789, status: 'done', progress: 100 },
  { id: '2', name: 'survey_draft.pdf', size: 1234567, status: 'processing', progress: 65 },
  { id: '3', name: 'thesis_chapter3.pdf', size: 3456789, status: 'pending', progress: 0 },
];

export const CITATION_SEARCH_RESULTS: Paper[] = [
  {
    id: '11',
    title: 'Snowball Sampling for Systematic Literature Reviews',
    authors: ['Wohlin, Claes'],
    journal: 'International Conference on Evaluation and Assessment in Software Engineering',
    year: 2023,
    doi: '10.1234/ease.2023.001',
    abstract: 'This paper presents guidelines for using snowball sampling as a complement to database searches in systematic literature reviews.',
    keywords: ['snowball sampling', 'literature review', 'systematic review'],
    citations: 445,
  },
  {
    id: '12',
    title: 'Forward Citation Tracking in Digital Libraries',
    authors: ['Harzing, Anne-Wil', 'Albrecht, Sabine'],
    journal: 'Journal of Informetrics',
    year: 2024,
    doi: '10.1234/joi.2024.022',
    abstract: 'We evaluate the coverage and accuracy of forward citation tracking across major academic databases.',
    keywords: ['citation tracking', 'digital libraries', 'bibliometrics'],
    citations: 78,
  },
];