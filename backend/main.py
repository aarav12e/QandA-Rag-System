import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv
from rag_service import RAGService

load_dotenv()

app = FastAPI(
    title="WebChat AI Backend",
    description="RAG-powered Q&A API using LangChain + Gemini",
    version="1.0.0"
)

# Allow all origins so the Chrome Extension can reach the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store: { session_id: RAGService }
sessions: dict[str, RAGService] = {}


# ──────────────────────────── Request Models ────────────────────────────

class LoadURLsRequest(BaseModel):
    urls: List[str]
    session_id: str

class ChatRequest(BaseModel):
    query: str
    session_id: str


# ──────────────────────────── Routes ────────────────────────────────────

@app.get("/")
async def root():
    """Health check — confirm the backend is running."""
    return {
        "status": "ok",
        "message": "WebChat AI Backend is running 🚀",
        "version": "1.0.0"
    }


@app.post("/load-urls")
async def load_urls(request: LoadURLsRequest):
    """
    Scrape the given URLs, split content into chunks,
    generate embeddings, and store them in a session-specific vector DB.
    """
    try:
        rag = RAGService()
        result = await rag.process_urls(request.urls)
        sessions[request.session_id] = rag
        return {
            "status": "success",
            "message": f"Successfully loaded {len(request.urls)} URL(s)",
            "chunks": result["chunks"],
            "urls": request.urls,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Perform similarity search on the session's vector DB,
    build a context-aware prompt, and return the Gemini AI response.
    """
    if request.session_id not in sessions:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Please load URLs first."
        )
    try:
        rag = sessions[request.session_id]
        answer, sources = await rag.chat(request.query)
        return {
            "answer": answer,
            "sources": sources,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Clear a session from memory (called when user resets the extension)."""
    if session_id in sessions:
        del sessions[session_id]
    return {"status": "cleared"}


@app.get("/health")
async def health():
    """Returns how many active sessions are in memory."""
    return {"active_sessions": len(sessions)}
