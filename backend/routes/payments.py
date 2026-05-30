"""Stripe payments — premium subscription packages, course purchase."""
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest,
)
from db import db, now_iso
from auth import get_current_user, UserPublic
from email_service import email_payment_receipt
from routes.referrals import get_discount_pct_for_user, complete_referral
import asyncio

router = APIRouter(prefix="/payments", tags=["payments"])

STRIPE_API_KEY = os.environ["STRIPE_API_KEY"]

# Server-side fixed packages — NEVER take amount from frontend
PACKAGES = {
    "premium_monthly": {"name": "Premium Monthly", "amount": 19.00, "currency": "usd", "type": "subscription", "duration_days": 30},
    "premium_yearly": {"name": "Premium Yearly", "amount": 149.00, "currency": "usd", "type": "subscription", "duration_days": 365},
    "premium_lifetime": {"name": "Premium Lifetime", "amount": 399.00, "currency": "usd", "type": "subscription", "duration_days": 36500},
}


class CheckoutIn(BaseModel):
    package_id: Optional[str] = None
    course_id: Optional[str] = None
    origin_url: str


@router.get("/packages")
async def list_packages():
    return [{"id": k, **v} for k, v in PACKAGES.items()]


@router.post("/checkout")
async def create_checkout(req: CheckoutIn, http: Request, user: UserPublic = Depends(get_current_user)):
    host_url = str(http.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    amount = None
    currency = "usd"
    metadata = {"user_id": user.id, "user_email": user.email}
    purchase_type = ""

    if req.package_id:
        if req.package_id not in PACKAGES:
            raise HTTPException(400, "Invalid package")
        pkg = PACKAGES[req.package_id]
        amount = float(pkg["amount"])
        currency = pkg["currency"]
        metadata["package_id"] = req.package_id
        purchase_type = "subscription"
    elif req.course_id:
        course = await db.courses.find_one({"id": req.course_id})
        if not course:
            raise HTTPException(404, "Course not found")
        if course.get("price", 0) <= 0:
            raise HTTPException(400, "Course is free")
        amount = float(course["price"])
        metadata["course_id"] = req.course_id
        purchase_type = "course"
    else:
        raise HTTPException(400, "Either package_id or course_id required")

    # Apply referral discount if the user still has a pending one (one-time).
    referral_discount_pct = await get_discount_pct_for_user(user.id)
    discount_amount = 0.0
    if referral_discount_pct > 0 and amount is not None:
        discount_amount = round(amount * referral_discount_pct / 100.0, 2)
        amount = round(amount - discount_amount, 2)
        metadata["referral_discount_pct"] = str(referral_discount_pct)
        metadata["referral_discount_amount"] = f"{discount_amount:.2f}"

    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/payment/return?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pricing"

    checkout_request = CheckoutSessionRequest(
        amount=amount, currency=currency,
        success_url=success_url, cancel_url=cancel_url, metadata=metadata,
    )
    session = await sc.create_checkout_session(checkout_request)

    txn = {
        "id": str(uuid.uuid4()), "user_id": user.id, "user_email": user.email,
        "session_id": session.session_id, "amount": amount, "currency": currency,
        "metadata": metadata, "purchase_type": purchase_type,
        "package_id": req.package_id, "course_id": req.course_id,
        "payment_status": "initiated", "status": "pending", "created_at": now_iso(),
        "referral_discount_pct": referral_discount_pct,
        "referral_discount_amount": discount_amount,
    }
    await db.payment_transactions.insert_one(txn)
    return {"url": session.url, "session_id": session.session_id, "discount_applied": discount_amount}


@router.get("/status/{session_id}")
async def status(session_id: str, http: Request, user: UserPublic = Depends(get_current_user)):
    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn:
        raise HTTPException(404, "Transaction not found")
    host_url = str(http.base_url).rstrip("/")
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")
    cs = await sc.get_checkout_status(session_id)

    new_status = cs.status
    new_payment_status = cs.payment_status

    already_processed = txn.get("payment_status") == "paid"

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": new_status, "payment_status": new_payment_status, "updated_at": now_iso()}},
    )

    # only fulfill once
    if new_payment_status == "paid" and not already_processed:
        await _fulfill(txn)

    return {"status": new_status, "payment_status": new_payment_status, "amount": cs.amount_total, "currency": cs.currency}


async def _fulfill(txn: dict):
    """Apply benefits after confirmed payment."""
    user_id = txn["user_id"]
    user_email = txn.get("user_email")
    user = await db.users.find_one({"id": user_id})
    user_name = user.get("name") if user else "there"
    # Complete any pending referral — awards XP to referrer + consumes referee discount.
    try:
        await complete_referral(user_id, txn.get("id"))
    except Exception:
        pass
    if txn.get("purchase_type") == "subscription" and txn.get("package_id"):
        await db.users.update_one({"id": user_id}, {"$set": {"is_premium": True, "premium_package": txn["package_id"]}})
        pkg_name = txn.get("package_id", "Premium").replace("_", " ").title()
        if user_email:
            asyncio.create_task(email_payment_receipt(user_email, user_name, pkg_name, txn["amount"], txn.get("currency", "usd")))
    elif txn.get("purchase_type") == "course" and txn.get("course_id"):
        existing = await db.enrollments.find_one({"user_id": user_id, "course_id": txn["course_id"]})
        if not existing:
            await db.enrollments.insert_one({
                "id": str(uuid.uuid4()), "user_id": user_id, "course_id": txn["course_id"],
                "progress_pct": 0, "completed_lessons": [], "created_at": now_iso(),
            })
            await db.courses.update_one({"id": txn["course_id"]}, {"$inc": {"students_count": 1}})
        if user_email:
            course = await db.courses.find_one({"id": txn["course_id"]})
            asyncio.create_task(email_payment_receipt(user_email, user_name, f"Course: {course.get('title', '')}" if course else "Course", txn["amount"], txn.get("currency", "usd")))


@router.get("/history")
async def history(user: UserPublic = Depends(get_current_user)):
    txns = await db.payment_transactions.find({"user_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return txns


# Webhook (mounted on main app, not router)
async def stripe_webhook_handler(http: Request):
    body = await http.body()
    signature = http.headers.get("Stripe-Signature", "")
    host_url = str(http.base_url).rstrip("/")
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")
    try:
        evt = await sc.handle_webhook(body, signature)
    except Exception as e:
        raise HTTPException(400, f"Webhook error: {e}")
    if evt.payment_status == "paid":
        txn = await db.payment_transactions.find_one({"session_id": evt.session_id})
        if txn and txn.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": evt.session_id},
                {"$set": {"payment_status": "paid", "status": "complete", "updated_at": now_iso()}},
            )
            await _fulfill(txn)
    return {"received": True}
