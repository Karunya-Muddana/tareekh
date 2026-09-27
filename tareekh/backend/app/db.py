"""SQLite store for the practice registry and ingest bookkeeping.

Hindsight holds the memories. This holds what needs exact lookups: which cases exist,
their nicknames, and the state of each upload.
"""
import json
import sqlite3
from contextlib import contextmanager

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS judges   (id TEXT PRIMARY KEY, name TEXT, short TEXT, court TEXT, court_hall TEXT, level TEXT);
CREATE TABLE IF NOT EXISTS counsel  (id TEXT PRIMARY KEY, name TEXT, chamber TEXT);
CREATE TABLE IF NOT EXISTS clients  (id TEXT PRIMARY KEY, name TEXT, type TEXT);
CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY, case_number TEXT, title TEXT, short_name TEXT, nature TEXT,
    judge_id TEXT, opposing_counsel_id TEXT, client_id TEXT, represents TEXT,
    court TEXT, stage TEXT, next_date TEXT
);
CREATE TABLE IF NOT EXISTS aliases (alias TEXT, case_id TEXT, PRIMARY KEY (alias, case_id));
CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY, created_at TEXT, status TEXT, error TEXT,
    hints TEXT,            -- JSON: {case_id, hearing_date, author, auto_confirm}
    files TEXT,            -- JSON list of {name, path, kind}
    raw_text TEXT
);
CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY, upload_id TEXT, source_file TEXT, case_id TEXT, hearing_date TEXT,
    author TEXT, doc_type TEXT, text TEXT, confidence REAL, reason TEXT,
    status TEXT            -- review | confirmed | retained | rejected | failed
);
"""


def connect() -> sqlite3.Connection:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(settings.db_path, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con


@contextmanager
def tx():
    con = connect()
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init():
    with tx() as con:
        con.executescript(SCHEMA)


def rows(sql, *args) -> list[dict]:
    with tx() as con:
        return [dict(r) for r in con.execute(sql, args).fetchall()]


def row(sql, *args) -> dict | None:
    r = rows(sql, *args)
    return r[0] if r else None


def execute(sql, *args):
    with tx() as con:
        con.execute(sql, args)


def dumps(x) -> str:
    return json.dumps(x, ensure_ascii=False)
