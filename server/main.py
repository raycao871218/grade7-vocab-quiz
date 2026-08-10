from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import get_vocab_list_slug
from .db import (
    close_pool,
    fetch_answer_records,
    fetch_reading_passage,
    fetch_reading_submissions,
    fetch_user_summary,
    fetch_vocab_words,
    insert_answer_record,
    insert_reading_submission,
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
    answer_duration_ms: int | None = Field(default=None, ge=0)


class ReadingSubmissionRequest(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    task_id: str = Field(min_length=1, max_length=80)
    passage_slug: str = Field(min_length=1, max_length=120)
    translation_text: str = Field(min_length=1, max_length=12000)
    duration_ms: int | None = Field(default=None, ge=0)


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

NO_STORE_HEADERS = {
    "Cache-Control": "no-store, max-age=0, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}


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


@app.get("/api/reading-passages/{slug}")
def get_reading_passage(slug: str) -> dict[str, Any]:
    passage = fetch_reading_passage(slug)
    if not passage:
        raise HTTPException(status_code=404, detail=f"没有找到阅读文章：{slug}")
    return {"passage": passage}


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
            "answer_duration_ms": payload.answer_duration_ms,
        }
    )
    return {"record": record}


@app.get("/api/users/{username}/records")
def get_records(username: str, limit: int = 200) -> dict[str, Any]:
    safe_limit = min(max(limit, 1), 500)
    return {"records": fetch_answer_records(username, safe_limit)}


@app.post("/api/reading-submissions")
def save_reading_submission(payload: ReadingSubmissionRequest) -> dict[str, Any]:
    username = normalize_username(payload.username)
    if not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")

    submission = insert_reading_submission(
        {
            "username": username,
            "task_id": payload.task_id,
            "passage_slug": payload.passage_slug,
            "translation_text": payload.translation_text,
            "duration_ms": payload.duration_ms,
        }
    )
    return {"submission": submission}


@app.get("/api/users/{username}/reading-submissions")
def get_reading_submissions(username: str, limit: int = 100) -> dict[str, Any]:
    safe_limit = min(max(limit, 1), 200)
    return {"submissions": fetch_reading_submissions(username, safe_limit)}


@app.get("/api/users/{username}/summary")
def get_summary(username: str) -> dict[str, Any]:
    return {"summary": fetch_user_summary(username)}


dist_dir = Path(__file__).resolve().parent.parent / "dist"
if dist_dir.exists():
    @app.get("/", include_in_schema=False)
    def frontend_index() -> FileResponse:
        return FileResponse(dist_dir / "index.html", headers=NO_STORE_HEADERS)

    @app.get("/index.html", include_in_schema=False)
    def frontend_index_html() -> FileResponse:
        return FileResponse(dist_dir / "index.html", headers=NO_STORE_HEADERS)

    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
