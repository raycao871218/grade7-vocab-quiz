from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import get_vocab_list_slug
from .db import (
    close_pool,
    fetch_answer_records,
    fetch_user_summary,
    fetch_vocab_words,
    insert_answer_record,
    normalize_username,
    open_pool,
    upsert_user,
)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=60)


class AnswerRecordRequest(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    session_id: str = Field(min_length=1, max_length=120)
    mode: str
    difficulty: str | None = None
    question_count: int | None = None
    word_display_order: int
    english: str
    chinese: str
    prompt: str = ""
    user_answer: str
    correct: bool


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


@app.post("/api/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    username = normalize_username(payload.username)
    if not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")
    return {"user": upsert_user(username)}


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


@app.post("/api/answers")
def save_answer(payload: AnswerRecordRequest) -> dict[str, Any]:
    username = normalize_username(payload.username)
    if not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")

    record = insert_answer_record(
        {
            "username": username,
            "session_id": payload.session_id,
            "mode": payload.mode,
            "difficulty": payload.difficulty,
            "question_count": payload.question_count,
            "word_display_order": payload.word_display_order,
            "english": payload.english,
            "chinese": payload.chinese,
            "prompt": payload.prompt,
            "user_answer": payload.user_answer,
            "correct": payload.correct,
        }
    )
    return {"record": record}


@app.get("/api/users/{username}/records")
def get_records(username: str, limit: int = 200) -> dict[str, Any]:
    safe_limit = min(max(limit, 1), 500)
    return {"records": fetch_answer_records(username, safe_limit)}


@app.get("/api/users/{username}/summary")
def get_summary(username: str) -> dict[str, Any]:
    return {"summary": fetch_user_summary(username)}


dist_dir = Path(__file__).resolve().parent.parent / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
