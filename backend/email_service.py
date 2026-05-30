"""SMTP email service (Outlook / Gmail / any SMTP provider).

Reads SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SENDER_EMAIL from env.
If SMTP_HOST is empty, falls back to "placeholder" mode (logs only — never blocks the app).

Outlook personal accounts:
  SMTP_HOST=smtp-mail.outlook.com
  SMTP_PORT=587
  SMTP_USERNAME=you@outlook.com
  SMTP_PASSWORD=<App Password from account.live.com/proofs/AppPassword>
  SENDER_EMAIL=you@outlook.com
"""
import logging
import os
from email.message import EmailMessage
from typing import Optional

import aiosmtplib

logger = logging.getLogger("email")

SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587") or 587)
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").strip()
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", SMTP_USERNAME).strip()
SENDER_NAME = os.environ.get("SENDER_NAME", "SkillSphere").strip()

_enabled = bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD)
if _enabled:
    logger.info(f"SMTP email enabled via {SMTP_HOST}:{SMTP_PORT} as {SMTP_USERNAME}")
else:
    logger.warning("SMTP not configured (SMTP_HOST/USERNAME/PASSWORD blank) — emails will be logged only")


async def send_email(to: str, subject: str, html: str, text: Optional[str] = None) -> dict:
    """Send transactional email via SMTP. Returns dict with status. Non-blocking."""
    if not _enabled:
        logger.info(f"[EMAIL-PLACEHOLDER] to={to}\nsubject={subject}\n--- html ---\n{html[:400]}")
        return {"status": "placeholder", "delivered": False, "to": to}

    msg = EmailMessage()
    msg["From"] = f"{SENDER_NAME} <{SENDER_EMAIL}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text or _html_to_text(html))
    msg.add_alternative(html, subtype="html")

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USERNAME,
            password=SMTP_PASSWORD,
            start_tls=True,
            timeout=20,
        )
        logger.info(f"Email sent → {to} | {subject}")
        return {"status": "sent", "delivered": True, "to": to}
    except Exception as e:
        logger.error(f"SMTP send failed for {to}: {e}")
        return {"status": "error", "delivered": False, "error": str(e), "to": to}


def _html_to_text(html: str) -> str:
    """Cheap fallback plaintext for clients that don't render HTML."""
    import re as _re
    txt = _re.sub(r"<style.*?</style>", "", html, flags=_re.S | _re.I)
    txt = _re.sub(r"<[^>]+>", " ", txt)
    txt = _re.sub(r"\s+", " ", txt).strip()
    return txt[:2000]


# ===== Templated emails (unchanged API — same callers across the app) =====

BASE_STYLE = """
  <style>
    body { font-family: -apple-system, 'Segoe UI', sans-serif; background: #f5f5f7; padding: 24px; margin: 0; color: #111; }
    .wrap { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e5e7; }
    .brand { font-weight: 700; letter-spacing: -0.02em; font-size: 18px; color: #6366F1; margin-bottom: 24px; }
    h1 { font-size: 24px; letter-spacing: -0.02em; margin: 0 0 16px; }
    p { color: #444; line-height: 1.6; margin: 0 0 12px; }
    .btn { display: inline-block; background: #6366F1; color: #fff !important; text-decoration: none; padding: 12px 22px; border-radius: 8px; margin-top: 16px; font-weight: 500; }
    .muted { color: #888; font-size: 13px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; }
  </style>
"""


def _wrap(inner: str) -> str:
    return f"<!doctype html><html><head>{BASE_STYLE}</head><body><div class='wrap'><div class='brand'>● SkillSphere</div>{inner}<div class='muted'>You're receiving this because you signed up for SkillSphere. — Built with AI.</div></div></body></html>"


async def email_welcome(to: str, name: str):
    inner = f"<h1>Welcome, {name}!</h1><p>Your SkillSphere account is ready. Start exploring 480+ courses, get AI tutoring, and apply to jobs — all in one place.</p><a class='btn' href='https://skillsphere.app/dashboard'>Open dashboard</a>"
    return await send_email(to, "Welcome to SkillSphere", _wrap(inner))


async def email_enrollment(to: str, name: str, course_title: str):
    inner = f"<h1>You're enrolled, {name} 🎓</h1><p>You just enrolled in <strong>{course_title}</strong>. Pick up where you left off anytime — your progress is saved automatically.</p><a class='btn' href='https://skillsphere.app/dashboard'>Resume learning</a>"
    return await send_email(to, f"Enrolled: {course_title}", _wrap(inner))


async def email_application_status(to: str, name: str, job_title: str, company: str, status: str):
    status_map = {
        "shortlisted": ("You're shortlisted! 🎉", "great-news"),
        "interview": ("Interview invitation", "next-step"),
        "rejected": ("Update on your application", "next-time"),
        "hired": ("Congratulations — you're hired! 🚀", "celebrate"),
        "applied": ("Application received", "confirmation"),
    }
    title, _ = status_map.get(status, ("Application update", "info"))
    inner = f"<h1>{title}</h1><p>Hi {name}, your application for <strong>{job_title}</strong> at <strong>{company}</strong> is now: <strong>{status.upper()}</strong>.</p><a class='btn' href='https://skillsphere.app/jobs'>View applications</a>"
    return await send_email(to, f"{title} — {job_title}", _wrap(inner))


async def email_payment_receipt(to: str, name: str, package: str, amount: float, currency: str = "USD"):
    inner = f"<h1>Payment received ✓</h1><p>Hi {name}, thanks for upgrading to <strong>{package}</strong>. You now have full access to all premium features.</p><p><strong>Amount:</strong> {amount:.2f} {currency.upper()}</p><a class='btn' href='https://skillsphere.app/dashboard'>Explore premium</a>"
    return await send_email(to, f"Payment receipt — {package}", _wrap(inner))


async def email_new_application(to: str, recruiter_name: str, candidate_name: str, job_title: str):
    inner = f"<h1>New application 📬</h1><p>Hi {recruiter_name}, <strong>{candidate_name}</strong> just applied to <strong>{job_title}</strong>. Review and shortlist on your dashboard.</p><a class='btn' href='https://skillsphere.app/dashboard'>Review applicants</a>"
    return await send_email(to, f"New application — {job_title}", _wrap(inner))
