import math
import os
import time
from typing import List
import torch

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

app = FastAPI(title="Local Reranker", version="1.0.0")

MODEL_NAME = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-base")

print(f"🔄 Loading reranker model: {MODEL_NAME}")
load_start = time.time()

# Optimize for CPU inference
model = CrossEncoder(MODEL_NAME, max_length=512)

# Set to evaluation mode and disable gradients for faster inference
if hasattr(model, 'model'):
    model.model.eval()
    for param in model.model.parameters():
        param.requires_grad = False

# Set number of threads for CPU inference
torch.set_num_threads(4)

load_time = time.time() - load_start
print(f"✅ Model loaded in {load_time:.2f}s | CPU threads: {torch.get_num_threads()}")


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


class RerankRequest(BaseModel):
    query: str
    documents: List[str]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/rerank")
def rerank(req: RerankRequest):
    start = time.time()
    doc_count = len(req.documents)
    
    print(f"🔄 [RERANK START] Processing {doc_count} documents")
    
    # Build pairs
    pair_start = time.time()
    pairs = [[req.query, d] for d in req.documents]
    pair_time = (time.time() - pair_start) * 1000
    
    # Predict scores with optimized batch size and no conversion overhead
    predict_start = time.time()
    with torch.no_grad():
        raw_scores = model.predict(
            pairs, 
            batch_size=64,
            show_progress_bar=False,
            convert_to_numpy=True,
            convert_to_tensor=False
        )
    predict_time = (time.time() - predict_start) * 1000
    print(f"  ⏱️  Model prediction: {predict_time:.1f}ms ({doc_count} docs, {predict_time/doc_count:.1f}ms/doc)")
    
    # Apply sigmoid efficiently
    sigmoid_start = time.time()
    results = [
        {"index": i, "score": float(sigmoid(float(score)))}
        for i, score in enumerate(raw_scores)
    ]
    sigmoid_time = (time.time() - sigmoid_start) * 1000
    
    total_time = (time.time() - start) * 1000
    print(f"✅ [RERANK COMPLETE] Total: {total_time:.1f}ms | docs={doc_count}")
    
    return results
