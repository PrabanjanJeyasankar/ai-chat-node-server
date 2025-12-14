Below is a **ready-to-use implementation prompt** you can give directly to your agent.
It is **instructional, deterministic, no decisions left to the agent**, aligned with **Node.js**, **Qdrant**, **Ollama (local)**, **OpenAI (prod)**, **free-first**, **production-grade RAG**.

---

## 🎯 ROLE

You are a **Senior Backend Engineer** implementing a **high-accuracy RAG pipeline**.
You **must not redesign or reinterpret** the system.
Your job is **only to implement exactly what is specified**.

No UI work.
No experimentation.
No architectural changes beyond what is written.

---

## 🧠 GOAL

Upgrade the existing RAG system to include:

1. **Hybrid Retrieval (semantic + keyword)**
2. **Local Cross-Encoder Reranking (FREE)**
3. **Strict relevance filtering before generation**
4. **No extra LLM calls for scoring**
5. **Works with Ollama (local) + OpenAI (production)**

Accuracy is the priority.
Cost must remain **zero for retrieval & scoring**.

---

## 🏗️ FINAL RAG FLOW (DO NOT CHANGE)

```
User Query
  ↓
Query Normalization
  ↓
Hybrid Retrieval
  ├─ Vector Search (Qdrant)
  └─ Keyword / BM25 Search
  ↓
Result Merge (Reciprocal Rank Fusion)
  ↓
Local Cross-Encoder Reranking
  ↓
Relevance Filtering (threshold-based)
  ↓
Context Assembly
  ↓
LLM Generation
  ├─ Ollama (local)
  └─ OpenAI (prod)
```

---

## 📁 REQUIRED FOLDER STRUCTURE

````
src/
├── rag/
│   ├── retrieval/
│   │   ├── vectorRetriever.ts
│   │   ├── keywordRetriever.ts
│   │   ├── hybridRetriever.ts
│   │
│   ├── reranking/
│   │   ├── crossEncoderClient.ts
│   │   ├── rerankResults.ts
│   │
│   ├── filtering/
│   │   ├── relevanceFilter.ts
│   │
│   ├── scoring/
│   │   ├── reciprocalRankFusion.ts
│   │
│   ├── pipeline/
│   │   ├── ragPipeline.ts
│


---

## 📦 REQUIRED PACKAGES (EXACT)

### Node dependencies

```json
{
  "axios": "^1.x",
  "natural": "^6.x",
  "stopword": "^2.x"
}
````

### Python (reranker microservice)

```txt
sentence-transformers
torch
fastapi
uvicorn
```

---

## 🤖 CROSS-ENCODER (MANDATORY)

**Model (FREE, LOCAL):**

```
BAAI/bge-reranker-base
```

**Hosting:**

- Python FastAPI
- Runs locally or on CPU EC2
- Node calls it via HTTP

**Input:**

```json
{
  "query": "user query",
  "documents": ["doc1", "doc2", "..."]
}
```

**Output:**

```json
[
  { "index": 0, "score": 0.91 },
  { "index": 1, "score": 0.72 }
]
```

---

## 🔍 HYBRID RETRIEVAL DETAILS

### 1️⃣ Vector Retriever

- Use existing Qdrant collection
- Top K = 20
- Semantic embedding only

### 2️⃣ Keyword Retriever

- Use `natural` BM25
- Index article chunks at ingestion
- Query tokens cleaned with `stopword`

### 3️⃣ Fusion

- Use **Reciprocal Rank Fusion**
- Formula:

```
score = Σ (1 / (k + rank))
k = 60
```

---

## 🧪 RELEVANCE FILTERING (STRICT)

After reranking:

- Drop results with score `< 0.35`
- If fewer than **3 chunks survive**, abort generation and return:

```
"The available sources are not relevant enough to answer accurately."
```

---

## 🧠 PROMPT RULES (CRITICAL)

The LLM prompt **must contain ONLY filtered chunks**.

System instruction:

```
You must answer strictly using the provided context.
If the answer is not fully supported, say you don't have enough information.
Do not add external knowledge.
```

---

## 🔌 LLM USAGE RULES

### Ollama (Local)

- Used during development
- No streaming required
- No scoring

### OpenAI (Production)

- Single call per user query
- NEVER used for reranking or validation

---

## 🚫 HARD CONSTRAINTS

- ❌ No second LLM call for scoring
- ❌ No heuristic relevance checks
- ❌ No random weighting
- ❌ No UI changes
- ❌ No schema redesign
- ❌ No embeddings stored in SQL

---

## ✅ ACCEPTANCE CRITERIA

The task is complete only if:

- Hybrid retrieval is implemented
- Cross-encoder reranking runs locally
- Reranking output affects final context
- Irrelevant sources never reach the LLM
- System works without OpenAI for scoring
- Code matches folder structure exactly

---

## 🧠 REMINDER

You are **not designing a system**.
You are **implementing a predefined architecture**.

If something is unclear → **ask before coding**.
