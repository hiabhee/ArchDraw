import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const ragTutorial = defineTutorial({
  id: 'rag-application-architecture',
  title: 'How to Design RAG Application Architecture',
  description: 'Build a production RAG (Retrieval-Augmented Generation) system. Learn document ingestion, chunking strategies, vector embeddings, semantic search, reranking, and LLM synthesis at scale.',
  difficulty: 'intermediate',
  estimatedMinutes: 25,
  tags: ['ai', 'llm', 'embeddings'],
  icon: 'Brain',
  color: '#7C3AED',

  levels: [
    level({
      title: 'The Query Pipeline',
      steps: [
        step({
          component: 'Web Client', nodeType: 'client_web', noConnect: true,
          phases: {
            context: { heading: 'Welcome to RAG Architecture',
              body: 'RAG (Retrieval-Augmented Generation) connects your private data to LLMs. The system retrieves relevant documents and feeds them as context — stopping hallucinations by grounding answers in real data.' },
            intro: { heading: 'The client: where questions begin',
              body: 'A simple chat interface. The user types a natural language question — "What does our Q3 report say about margins?" — and expects a grounded, cited answer.' },
            teaching: { heading: 'Why the client matters',
              body: 'RAG changes the UX contract. The client must display cited sources alongside the answer, show a confidence indicator, and handle the longer latency of retrieval + synthesis (typically 2-5s vs 0.5s for plain LLM). Without this expectation set in the UI, users distrust the system.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'Web', and add the client." },
            connecting: { heading: 'No connections yet', body: 'First step — connect nothing.' },
            celebration: { heading: 'Web Client added.', body: 'Now the API layer.' },
          },
          hints: ['Search for "Web"'],
        }),
        step({
          component: 'API Gateway', nodeType: 'api_gateway', parent: 'Web Client',
          phases: {
            context: { heading: 'Step 2: API Gateway', body: 'Two flows enter the gateway: real-time queries and background document ingestion. The gateway handles auth and rate limiting for both.' },
            intro: { heading: 'Two flows, one gate', body: 'Queries are latency-critical (user is waiting). Ingestion is throughput-critical (bulk uploads). The gateway must route them to separate downstream services.' },
            teaching: { heading: 'Why rate limiting is critical in RAG',
              body: 'Each RAG query triggers: a vector search, a reranking call, and an LLM call. Without rate limiting at the gateway, a single burst of requests can exhaust LLM token budgets within seconds and cost hundreds of dollars.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'API Gateway', and add it." },
            connecting: { heading: 'Connect it', body: 'Connect Web Client → API Gateway.' },
            celebration: { heading: 'API Gateway added.', body: 'Now the Embedding Service.' },
          },
          hints: ['Search for "API Gateway"', 'Connect Web Client to it'],
        }),
        step({
          component: 'Embedding Service', nodeType: 'embedding_service', parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 3: Embedding Service', body: 'The Embedding Service converts the user\'s text question into a vector — a list of numbers that captures its meaning. This vector is used to search the database for semantically similar documents.' },
            intro: { heading: 'What is an embedding?', body: 'An embedding maps text to a point in high-dimensional space. Questions with similar meaning land near each other, even if worded differently.' },
            teaching: { heading: 'Why embeddings enable semantic search',
              body: 'Keyword search fails RAG: "revenue decline" won\'t match a document that says "sales dropped." Embeddings fix this — both phrases land in the same region of vector space. The embedding model (e.g. text-embedding-3-small) must be the same model used during ingestion, otherwise query and document vectors live in different spaces and similarity scores are meaningless.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'Embedding', and add the Embedding Service." },
            connecting: { heading: 'Connect it', body: 'Connect API Gateway → Embedding Service.' },
            celebration: { heading: 'Embedding Service added.', body: 'Now the Vector Database.' },
          },
          hints: ['Search for "Embedding"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Vector Database', nodeType: 'vector_db', parent: 'Embedding Service',
          phases: {
            context: { heading: 'Step 4: Vector Database', body: 'The Vector Database stores pre-computed embeddings of every document chunk. The query embedding is compared against all stored vectors using cosine similarity to find the top-K most relevant chunks.' },
            intro: { heading: 'Why not a regular database?', body: 'SQL databases do exact matches ("WHERE id = 5"). Vector DBs do approximate nearest-neighbor (ANN) search — finding the 10 vectors out of 10 million that are geometrically closest to the query vector in microseconds.' },
            teaching: { heading: 'The core of RAG quality',
              body: 'Retrieval quality determines 80% of RAG output quality. A bad vector DB setup (wrong chunk size, wrong embedding model, no metadata filtering) means the LLM gets irrelevant context and hallucinates anyway. Popular options: Pinecone (managed), pgvector (Postgres extension), Weaviate, Chroma (local dev).' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'Vector', and add the Vector Database." },
            connecting: { heading: 'Connect it', body: 'Connect Embedding Service → Vector Database.' },
            celebration: { heading: 'Vector Database added.', body: 'Now the RAG Pipeline.' },
          },
          hints: ['Search for "Vector"', 'Connect Embedding Service to it'],
        }),
        step({
          component: 'RAG Pipeline', nodeType: 'rag_pipeline', parents: ['Vector Database', 'API Gateway'],
          phases: {
            context: { heading: 'Step 5: RAG Pipeline', body: 'The RAG Pipeline orchestrates the full retrieval-synthesis loop: retrieve top-K chunks → rerank by relevance → build the prompt → call the LLM → return the cited answer.' },
            intro: { heading: 'The synthesis orchestrator', body: 'This is where retrieval meets generation. The pipeline takes the query + top chunks and constructs a prompt like: "Answer using only these sources: [chunk1][chunk2]…"' },
            teaching: { heading: 'Why reranking matters',
              body: 'Vector similarity is not the same as relevance. The top-K chunks from the vector DB are ranked by geometric distance, not semantic fit. A reranker (cross-encoder model) re-scores the top 20 chunks and picks the best 3-5. This two-stage retrieval pattern consistently outperforms single-stage by 15-30% on answer quality.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'RAG', and add the RAG Pipeline." },
            connecting: { heading: 'Connect both sources', body: 'Connect Vector Database → RAG Pipeline and API Gateway → RAG Pipeline.' },
            celebration: { heading: 'RAG Pipeline added.', body: 'Now the LLM.' },
          },
          hints: ['Search for "RAG"', 'Connect Vector Database and API Gateway to it'],
        }),
        step({
          component: 'LLM API (GPT / Claude)', nodeType: 'llm_api', parent: 'RAG Pipeline',
          phases: {
            context: { heading: 'Step 6: LLM API', body: 'The LLM receives a structured prompt containing the user question and the retrieved document chunks. It synthesizes a grounded answer — it cannot invent facts because everything it says must come from the provided context.' },
            intro: { heading: 'LLM as synthesizer, not knowledge base', body: 'In a RAG system, the LLM\'s job is synthesis, not recall. You do not need GPT-4 for this — smaller, cheaper models (GPT-3.5, Claude Haiku) often work equally well when context quality is high.' },
            teaching: { heading: 'Prompt engineering for RAG',
              body: 'The prompt template is: System: "Answer only from the provided sources. If the answer is not in the sources, say so." User: "{question}" Sources: "{chunk1} {chunk2}…". The "answer only from sources" instruction is what prevents hallucination. Without it, the LLM blends retrieved context with its training data.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'LLM API', and add it." },
            connecting: { heading: 'Connect it', body: 'Connect RAG Pipeline → LLM API.' },
            celebration: { heading: 'LLM API added.', body: 'Query pipeline complete. Now ingestion.' },
          },
          hints: ['Search for "LLM API"', 'Connect RAG Pipeline to it'],
        }),
      ],
    }),
    level({
      title: 'The Ingestion Pipeline',
      steps: [
        step({
          component: 'Text Splitter / Chunker', nodeType: 'text_splitter', parent: 'API Gateway',
          phases: {
            context: { heading: 'Level 2: Document Ingestion', body: 'Before documents can be retrieved, they must be ingested: split into chunks, embedded, and stored. Chunking strategy is the single biggest factor in RAG quality.' },
            intro: { heading: 'Why chunk at all?', body: 'LLMs have context limits. A 500-page PDF cannot fit in a single prompt. Chunking splits it into overlapping segments (~500 tokens each) so the most relevant segment can be retrieved.' },
            teaching: { heading: 'Chunk size tradeoffs',
              body: 'Small chunks (128 tokens): precise retrieval, may lose context. Large chunks (1024 tokens): rich context, lower precision. Best practice: recursive character splitting with 10-20% overlap so a sentence cut across a boundary appears in both adjacent chunks.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'Text Splitter', and add it." },
            connecting: { heading: 'Connect it', body: 'Connect API Gateway → Text Splitter / Chunker.' },
            celebration: { heading: 'Chunker added.', body: 'Now the Embedding Service feeds it too.' },
          },
          hints: ['Search for "Text Splitter"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'SQL Database', nodeType: 'sql_db', parent: 'RAG Pipeline',
          phases: {
            context: { heading: 'Step 2: SQL Database', body: 'The SQL Database stores document metadata: original file name, upload timestamp, chunk IDs, source URL, access permissions. The Vector DB stores vectors; the SQL DB stores everything else.' },
            intro: { heading: 'Two databases, two jobs', body: 'Vector DB: semantic similarity search. SQL DB: structured filtering. Combining both enables hybrid search: "find chunks about revenue (vector) from Q3 reports (SQL filter)".' },
            teaching: { heading: 'Metadata filtering is the killer feature',
              body: 'Without SQL metadata, a query about "employee benefits" retrieves chunks from all documents. With metadata filtering you can scope retrieval: only search documents uploaded by HR, only from the last 6 months. This is what makes enterprise RAG actually usable.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'SQL', and add the database." },
            connecting: { heading: 'Connect it', body: 'Connect RAG Pipeline → SQL Database.' },
            celebration: { heading: 'SQL Database added.', body: 'RAG system complete!' },
          },
          hints: ['Search for "SQL"', 'Connect RAG Pipeline to it'],
        }),
      ],
    }),
  ],
});

export default ragTutorial;
