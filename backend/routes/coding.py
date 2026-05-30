"""Coding playground — hybrid: Piston API (when PISTON_API_URL points to a reachable instance,
self-hosted via docker-compose for full language support), else local subprocess sandbox.
"""
import asyncio
import os
import sys
try:
    import resource
    HAS_RESOURCE = True
except ImportError:
    HAS_RESOURCE = False
import shutil
import tempfile
import uuid
import aiohttp
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import db, now_iso
from auth import get_current_user, require_role, UserPublic

router = APIRouter(prefix="/coding", tags=["coding"])

PISTON_API_URL = os.environ.get("PISTON_API_URL", "").strip().rstrip("/")
PISTON_ENABLED = False  # set at startup by probe_piston()

# Local sandbox runtimes (available without Piston)
PYTHON_CMD = sys.executable
LOCAL_RUNTIMES = {
    "python": {"label": "Python 3", "ext": "py", "cmd": [PYTHON_CMD], "available": True, "mem_mb": 256},
    "javascript": {"label": "JavaScript (Node)", "ext": "js", "cmd": ["node", "--max-old-space-size=512"], "available": bool(shutil.which("node")), "mem_mb": 1536},
}

# Piston runtime mapping (when self-hosted instance is reachable).
PISTON_LANG_MAP = {
    "python": {"language": "python", "ext": "py", "label": "Python 3"},
    "javascript": {"language": "javascript", "ext": "js", "label": "JavaScript"},
    "typescript": {"language": "typescript", "ext": "ts", "label": "TypeScript"},
    "java": {"language": "java", "ext": "java", "label": "Java"},
    "cpp": {"language": "c++", "ext": "cpp", "label": "C++"},
    "c": {"language": "c", "ext": "c", "label": "C"},
    "go": {"language": "go", "ext": "go", "label": "Go"},
    "rust": {"language": "rust", "ext": "rs", "label": "Rust"},
    "ruby": {"language": "ruby", "ext": "rb", "label": "Ruby"},
}

_piston_versions: dict = {}

CPU_LIMIT = 5
WALL_LIMIT = 8
OUT_LIMIT = 64 * 1024


def _make_preexec(mem_mb: int):
    if not HAS_RESOURCE:
        return None
    def _pre():
        resource.setrlimit(resource.RLIMIT_CPU, (CPU_LIMIT, CPU_LIMIT))
        resource.setrlimit(resource.RLIMIT_AS, (mem_mb * 1024 * 1024, mem_mb * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_NPROC, (64, 64))
        resource.setrlimit(resource.RLIMIT_FSIZE, (10 * 1024 * 1024, 10 * 1024 * 1024))
        os.setsid()
    return _pre


async def probe_piston() -> bool:
    """Check if PISTON_API_URL is reachable; cache available runtime versions."""
    global PISTON_ENABLED, _piston_versions
    if not PISTON_API_URL:
        PISTON_ENABLED = False
        return False
    try:
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as s:
            async with s.get(f"{PISTON_API_URL}/runtimes") as r:
                if r.status != 200:
                    PISTON_ENABLED = False
                    return False
                runtimes = await r.json()
        for rt in runtimes:
            lang = rt.get("language")
            ver = rt.get("version")
            if lang and ver and lang not in _piston_versions:
                _piston_versions[lang] = ver
        PISTON_ENABLED = True
        return True
    except Exception:
        PISTON_ENABLED = False
        return False


async def _run_piston(language: str, code: str, stdin: str) -> dict:
    cfg = PISTON_LANG_MAP[language]
    piston_lang = cfg["language"]
    version = _piston_versions.get(piston_lang, "*")
    payload = {
        "language": piston_lang, "version": version,
        "files": [{"name": f"main.{cfg['ext']}", "content": code}],
        "stdin": stdin or "",
        "compile_timeout": 10000,
        "run_timeout": (WALL_LIMIT - 1) * 1000,
    }
    timeout = aiohttp.ClientTimeout(total=WALL_LIMIT + 5)
    async with aiohttp.ClientSession(timeout=timeout) as s:
        async with s.post(f"{PISTON_API_URL}/execute", json=payload) as r:
            if r.status >= 400:
                txt = await r.text()
                raise HTTPException(502, f"Piston error: {txt[:200]}")
            data = await r.json()
    run = data.get("run", {}) or {}
    code_val = run.get("code")
    return {
        "stdout": (run.get("stdout") or "")[:OUT_LIMIT],
        "stderr": (run.get("stderr") or "") or ((data.get("compile") or {}).get("stderr") or ""),
        "exit_code": code_val if code_val is not None else -1,
    }


async def _run_local(language: str, code: str, stdin: str) -> dict:
    if language not in LOCAL_RUNTIMES:
        raise HTTPException(400, f"Language '{language}' not available locally — enable Piston for full language support")
    rt = LOCAL_RUNTIMES[language]
    if not rt["available"]:
        raise HTTPException(501, f"{rt['label']} runtime not installed on this server")
    workdir = tempfile.mkdtemp(prefix="skl_run_")
    try:
        fpath = os.path.join(workdir, f"main.{rt['ext']}")
        with open(fpath, "w") as f:
            f.write(code)
        # Merge system env to ensure cryptographic initialization (like CSPRNG on Windows) has access to SystemRoot
        child_env = os.environ.copy()
        child_env["HOME"] = workdir
        proc = await asyncio.create_subprocess_exec(
            *rt["cmd"], fpath,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=workdir,
            preexec_fn=_make_preexec(rt.get("mem_mb", 256)),
            env=child_env,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(input=(stdin or "").encode()),
                timeout=WALL_LIMIT,
            )
            code_ret = proc.returncode if proc.returncode is not None else -1
        except asyncio.TimeoutError:
            try: proc.kill()
            except Exception: pass
            return {"stdout": "", "stderr": f"Time limit exceeded ({WALL_LIMIT}s)", "exit_code": 124}
        # Decode and normalize Windows newlines (\r\n -> \n) for cross-platform test matching
        stdout_str = stdout[:OUT_LIMIT].decode(errors="replace").replace("\r\n", "\n")
        stderr_str = stderr[:OUT_LIMIT].decode(errors="replace").replace("\r\n", "\n")
        if code_ret == -9:
            return {
                "stdout": stdout_str,
                "stderr": stderr_str + f"\nKilled by CPU limit ({CPU_LIMIT}s)",
                "exit_code": 124,
            }
        return {
            "stdout": stdout_str,
            "stderr": stderr_str,
            "exit_code": code_ret,
        }
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


async def execute(language: str, code: str, stdin: str = "") -> dict:
    """Route execution to Piston when enabled & supported, else local sandbox."""
    if PISTON_ENABLED and language in PISTON_LANG_MAP:
        try:
            return await _run_piston(language, code, stdin)
        except Exception:
            pass
    return await _run_local(language, code, stdin)


def all_languages() -> list:
    """Aggregate languages — local always; Piston extras when enabled."""
    out = []
    seen = set()
    for k, v in LOCAL_RUNTIMES.items():
        out.append({"id": k, "label": v["label"], "ext": v["ext"], "available": v["available"], "via": "local"})
        seen.add(k)
    if PISTON_ENABLED:
        for k, v in PISTON_LANG_MAP.items():
            if k in seen: continue
            out.append({"id": k, "label": v["label"], "ext": v["ext"], "available": True, "via": "piston"})
    return out


class RunRequest(BaseModel):
    language: str
    code: str
    stdin: str = ""


class RunResult(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    language: str


@router.get("/languages")
async def languages():
    return all_languages()


@router.get("/_probe")
async def probe():
    ok = await probe_piston()
    return {"piston_enabled": ok, "piston_url": PISTON_API_URL, "versions": _piston_versions}


@router.post("/run", response_model=RunResult)
async def run_code(req: RunRequest, user: UserPublic = Depends(get_current_user)):
    res = await execute(req.language, req.code, req.stdin)
    return RunResult(**res, language=req.language)


# ============ Coding Challenges ============
class TestCase(BaseModel):
    stdin: str = ""
    expected_stdout: str
    description: str = ""


class ChallengeCreate(BaseModel):
    title: str
    description: str
    difficulty: str = "Easy"
    language: str = "python"
    starter_code: str = ""
    test_cases: List[TestCase]
    time_limit_min: int = 30
    course_id: Optional[str] = None
    tags: List[str] = []


@router.post("/challenges")
async def create_challenge(req: ChallengeCreate, user: UserPublic = Depends(require_role("trainer", "admin"))):
    supported = set(LOCAL_RUNTIMES.keys()) | (set(PISTON_LANG_MAP.keys()) if PISTON_ENABLED else set())
    if req.language not in supported:
        raise HTTPException(400, f"Language '{req.language}' not available. Supported: {sorted(supported)}")
    doc = {
        "id": str(uuid.uuid4()), **req.model_dump(),
        "trainer_id": user.id, "trainer_name": user.name, "created_at": now_iso(),
    }
    await db.coding_challenges.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/challenges")
async def list_challenges(course_id: Optional[str] = None, difficulty: Optional[str] = None):
    filt: dict = {}
    if course_id: filt["course_id"] = course_id
    if difficulty: filt["difficulty"] = difficulty
    docs = await db.coding_challenges.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    for d in docs:
        d["test_cases"] = [
            {"description": tc.get("description", ""), "stdin": tc.get("stdin", "")}
            for tc in d.get("test_cases", [])
        ]
    return docs


@router.get("/challenges/{cid}")
async def get_challenge(cid: str, user: UserPublic = Depends(get_current_user)):
    doc = await db.coding_challenges.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if user.role == "student":
        doc["test_cases"] = [
            {"description": tc.get("description", ""), "stdin": tc.get("stdin", "")}
            for tc in doc.get("test_cases", [])
        ]
    return doc


class SubmitRequest(BaseModel):
    code: str


@router.post("/challenges/{cid}/submit")
async def submit_challenge(cid: str, req: SubmitRequest, user: UserPublic = Depends(get_current_user)):
    ch = await db.coding_challenges.find_one({"id": cid})
    if not ch:
        raise HTTPException(404, "Not found")
    results = []
    passed = 0
    total = len(ch["test_cases"])
    for tc in ch["test_cases"]:
        run = await execute(ch["language"], req.code, tc.get("stdin", ""))
        actual = (run.get("stdout") or "").rstrip()
        expected = (tc.get("expected_stdout") or "").rstrip()
        ok = actual == expected and run.get("exit_code") == 0
        if ok: passed += 1
        results.append({
            "description": tc.get("description", ""),
            "passed": ok, "stdin": tc.get("stdin", ""),
            "expected": expected, "actual": actual,
            "stderr": run.get("stderr", ""),
        })
    score = round((passed / total) * 100) if total else 0
    attempt = {
        "id": str(uuid.uuid4()), "challenge_id": cid,
        "user_id": user.id, "user_name": user.name,
        "code": req.code, "score": score, "passed": passed, "total": total,
        "results": results, "submitted_at": now_iso(),
    }
    await db.coding_attempts.insert_one(attempt)
    attempt.pop("_id", None)
    # XP only on full pass, idempotent per challenge
    if score == 100:
        from routes.gamification import award_xp
        await award_xp(user.id, "coding_solve", ref_id=cid)
    return attempt


@router.get("/challenges/{cid}/leaderboard")
async def challenge_leaderboard(cid: str):
    attempts = await db.coding_attempts.find({"challenge_id": cid}, {"_id": 0}).sort("score", -1).to_list(500)
    best = {}
    for a in attempts:
        if a["user_id"] not in best or a["score"] > best[a["user_id"]]["score"]:
            best[a["user_id"]] = a
    return sorted(best.values(), key=lambda x: -x["score"])[:20]


@router.get("/challenges/me/attempts")
async def my_coding_attempts(user: UserPublic = Depends(get_current_user)):
    return await db.coding_attempts.find({"user_id": user.id}, {"_id": 0}).sort("submitted_at", -1).to_list(100)
