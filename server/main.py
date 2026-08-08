from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_vocab_list_slug
from .db import close_pool, fetch_vocab_words, open_pool


@asynccontextmanager
async def lifespan(_app: FastAPI):
    open_pool()
    try:
        yield
    finally:
        close_pool()


app = FastAPI(title="Grade 7 Vocabulary API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/vocab")
def get_vocab(list_slug: str | None = None) -> dict[str, Any]:
    slug = list_slug or get_vocab_list_slug()
    words = fetch_vocab_words(slug)

    if not words:
        raise HTTPException(status_code=404, detail=f"没有找到词表：{slug}")

    return {
        "sourcePath": f"PostgreSQL vocab list: {slug}",
        "words": words,
    }


dist_dir = Path(__file__).resolve().parent.parent / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
