"""
loan_routes.py
==============
Flask Blueprint: Loan Approval & Utilization Tracking
MongoDB database: loan_db
Collections: loan_applications, loan_utilization

Endpoints
---------
POST   /loan/apply                        Submit a new loan application
GET    /loan/applications                 List all applications (optional ?status=)
GET    /loan/applications/<id>            Get single application by ID
PUT    /loan/applications/<id>/status     Update status (Approved/Rejected/Disbursed)
POST   /loan/utilization                  Record a utilization/drawdown event
GET    /loan/utilization/<loan_id>        Get utilization history for a loan
GET    /loan/dashboard                    Aggregated stats for the dashboard
"""

import os
import math
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, request, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient, DESCENDING

_REACT_DIR = os.path.join(os.path.dirname(__file__), "static", "loan_app")


def _serve_react(path=""):
    """Serve the built React SPA. Any non-asset path serves index.html."""
    target = os.path.join(_REACT_DIR, path) if path else ""
    if path and os.path.isfile(target):
        return send_from_directory(_REACT_DIR, path)
    # Fall through to React Router
    return send_from_directory(_REACT_DIR, "index.html")

# ─────────────────────────────────────────────
# Blueprint
# ─────────────────────────────────────────────
loan_bp = Blueprint("loan", __name__, url_prefix="/loan")
CORS(loan_bp)  # Allow cross-origin from React dev server

# ── Serve the merged React SPA from Flask ─────
@loan_bp.route("/app/", defaults={"path": ""})
@loan_bp.route("/app/<path:path>")
def serve_loan_app(path):
    """Serve the React app (built into static/loan_app/) at /loan/app/*."""
    return _serve_react(path)

# ─────────────────────────────────────────────
# MongoDB helpers
# ─────────────────────────────────────────────
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")


def get_loan_db():
    """Return MongoDB loan_db, or None if unreachable."""
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
        client.admin.command("ping")
        return client["loan_db"]
    except Exception as e:
        print(f"[loan_routes] MongoDB unavailable: {e}")
        return None


def serialize(doc):
    """Convert a MongoDB document to a JSON-serialisable dict."""
    if doc is None:
        return None
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    return doc


# ─────────────────────────────────────────────
# Utility: EMI Calculator
# ─────────────────────────────────────────────
def calculate_emi(principal: float, annual_rate: float, tenure_months: int) -> float:
    """Standard reducing-balance EMI formula."""
    if annual_rate <= 0 or tenure_months <= 0:
        return round(principal / max(tenure_months, 1), 2)
    monthly_rate = annual_rate / (12 * 100)
    emi = principal * monthly_rate * math.pow(1 + monthly_rate, tenure_months) / \
          (math.pow(1 + monthly_rate, tenure_months) - 1)
    return round(emi, 2)


def calculate_amortization_schedule(principal: float, annual_rate: float, tenure_months: int) -> list:
    """Generate month-by-month reducing-balance amortization schedule."""
    if principal <= 0 or tenure_months <= 0:
        return []
    
    emi = calculate_emi(principal, annual_rate, tenure_months)
    monthly_rate = (annual_rate / (12 * 100)) if annual_rate > 0 else 0.0
    
    schedule = []
    current_balance = round(float(principal), 2)
    cumulative_interest = 0.0
    cumulative_principal = 0.0
    
    for month in range(1, tenure_months + 1):
        if current_balance <= 0:
            break
        interest_portion = round(current_balance * monthly_rate, 2)
        if month == tenure_months or (emi - interest_portion) >= current_balance:
            principal_portion = current_balance
            month_emi = round(principal_portion + interest_portion, 2)
            closing_balance = 0.0
        else:
            principal_portion = round(emi - interest_portion, 2)
            month_emi = emi
            closing_balance = round(max(current_balance - principal_portion, 0.0), 2)
            
        cumulative_interest = round(cumulative_interest + interest_portion, 2)
        cumulative_principal = round(cumulative_principal + principal_portion, 2)
        
        schedule.append({
            "month": month,
            "opening_balance": current_balance,
            "emi": month_emi,
            "principal_portion": principal_portion,
            "interest_portion": interest_portion,
            "closing_balance": closing_balance,
            "cumulative_interest": cumulative_interest,
            "cumulative_principal": cumulative_principal
        })
        
        current_balance = closing_balance
        
    return schedule


# ─────────────────────────────────────────────
# Utility: Loan ID validator
# ─────────────────────────────────────────────
def valid_object_id(id_str: str):
    try:
        return ObjectId(id_str)
    except (InvalidId, TypeError):
        return None


# ═══════════════════════════════════════════════════════════════════
# ROUTE 1 - Submit a New Loan Application
# POST /loan/apply
# ═══════════════════════════════════════════════════════════════════
@loan_bp.route("/apply", methods=["POST"])
def apply_loan():
    data = request.get_json(silent=True) or {}

    required_fields = [
        "applicant_name", "email", "phone",
        "loan_type", "amount_requested", "tenure_months"
    ]
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return jsonify({"success": False, "error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        amount = float(data["amount_requested"])
        tenure = int(data["tenure_months"])
        rate = float(data.get("interest_rate", 10.5))
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Invalid numeric values for amount, tenure or rate."}), 400

    if amount <= 0:
        return jsonify({"success": False, "error": "Loan amount must be positive."}), 400
    if tenure <= 0 or tenure > 360:
        return jsonify({"success": False, "error": "Tenure must be 1-360 months."}), 400

    loan_types = {"Personal", "Business", "Home", "Education", "Vehicle"}
    if data["loan_type"] not in loan_types:
        return jsonify({"success": False, "error": f"loan_type must be one of: {', '.join(sorted(loan_types))}"}), 400

    emi = calculate_emi(amount, rate, tenure)
    now = datetime.now(timezone.utc).isoformat()

    application = {
        # ── Core personal info ─────────────────────────────────
        "applicant_name": str(data["applicant_name"]).strip(),
        "email": str(data["email"]).strip().lower(),
        "phone": str(data["phone"]).strip(),
        # ── Identity / KYC fields (from Aadhaar + PAN verification) ──
        "dob":             str(data.get("dob", "")).strip(),
        "gender":          str(data.get("gender", "")).strip(),
        "aadhaar_number":  str(data.get("aadhaar_number", "")).strip(),
        "pan_number":      str(data.get("pan_number", "")).strip().upper(),
        "id_verified":     bool(data.get("id_verified", False)),
        "aadhaar_duplicate": bool(data.get("aadhaar_duplicate", False)),
        "pan_duplicate":   bool(data.get("pan_duplicate", False)),
        # ── Loan details ───────────────────────────────────────
        "loan_type": data["loan_type"],
        "amount_requested": amount,
        "tenure_months": tenure,
        "interest_rate": rate,
        "purpose": str(data.get("purpose", "")).strip(),
        "loan_documents": data.get("loan_documents", []),
        "status": "Pending",
        "applied_at": now,
        "updated_at": now,
        "approved_amount": None,
        "approval_notes": None,
        "emi": emi,
        "total_disbursed": 0.0,
        "total_repaid": 0.0,
        "outstanding_balance": 0.0,
    }

    db = get_loan_db()
    if db is None:
        return jsonify({"success": False, "error": "Database unavailable. Please start MongoDB."}), 503

    result = db["loan_applications"].insert_one(application)
    application["_id"] = str(result.inserted_id)

    return jsonify({
        "success": True,
        "message": "Loan application submitted successfully.",
        "application": application
    }), 201


# ═══════════════════════════════════════════════════════════════════
# ROUTE 2 - List All Loan Applications
# GET /loan/applications?status=Pending&loan_type=Home&page=1&limit=20
# ═══════════════════════════════════════════════════════════════════
@loan_bp.route("/applications", methods=["GET"])
def list_applications():
    db = get_loan_db()
    if db is None:
        return jsonify({"success": False, "error": "Database unavailable."}), 503

    query = {}
    status_filter = request.args.get("status")
    type_filter = request.args.get("loan_type")
    search = request.args.get("search", "").strip()
    email_filter = request.args.get("email", "").strip().lower()

    if status_filter:
        query["status"] = status_filter
    if type_filter:
        query["loan_type"] = type_filter
    if email_filter:
        query["email"] = email_filter
    if search:
        search_condition = {"applicant_name": {"$regex": search, "$options": "i"}}
        if "$and" in query:
            query["$and"].append(search_condition)
        else:
            query["applicant_name"] = search_condition["applicant_name"]

    page = max(int(request.args.get("page", 1)), 1)
    limit = min(int(request.args.get("limit", 20)), 100)
    skip = (page - 1) * limit

    total = db["loan_applications"].count_documents(query)
    cursor = db["loan_applications"].find(query).sort("applied_at", DESCENDING).skip(skip).limit(limit)
    applications = [serialize(doc) for doc in cursor]

    return jsonify({
        "success": True,
        "total": total,
        "page": page,
        "limit": limit,
        "applications": applications
    })


# ═══════════════════════════════════════════════════════════════════
# ROUTE 3 - Get Single Application
# GET /loan/applications/<id>
# ═══════════════════════════════════════════════════════════════════
@loan_bp.route("/applications/<loan_id>", methods=["GET"])
def get_application(loan_id):
    oid = valid_object_id(loan_id)
    if oid is None:
        return jsonify({"success": False, "error": "Invalid loan ID format."}), 400

    db = get_loan_db()
    if db is None:
        return jsonify({"success": False, "error": "Database unavailable."}), 503

    doc = db["loan_applications"].find_one({"_id": oid})
    if doc is None:
        return jsonify({"success": False, "error": "Loan application not found."}), 404

    return jsonify({"success": True, "application": serialize(doc)})


# ═══════════════════════════════════════════════════════════════════
# ROUTE 4 - Update Loan Status (Approve / Reject / Disburse / Close)
# PUT /loan/applications/<id>/status
# ═══════════════════════════════════════════════════════════════════
@loan_bp.route("/applications/<loan_id>/status", methods=["PUT"])
def update_status(loan_id):
    oid = valid_object_id(loan_id)
    if oid is None:
        return jsonify({"success": False, "error": "Invalid loan ID format."}), 400

    data = request.get_json(silent=True) or {}
    new_status = data.get("status")

    valid_statuses = {"Approved", "Rejected", "Disbursed", "Closed"}
    if new_status not in valid_statuses:
        return jsonify({
            "success": False,
            "error": f"Status must be one of: {', '.join(sorted(valid_statuses))}"
        }), 400

    db = get_loan_db()
    if db is None:
        return jsonify({"success": False, "error": "Database unavailable."}), 503

    doc = db["loan_applications"].find_one({"_id": oid})
    if doc is None:
        return jsonify({"success": False, "error": "Loan application not found."}), 404

    update_fields = {
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "approval_notes": str(data.get("notes", "")).strip() or doc.get("approval_notes"),
    }

    if new_status == "Approved":
        approved_amount = data.get("approved_amount")
        if approved_amount is None:
            approved_amount = doc.get("amount_requested")
        try:
            approved_amount = float(approved_amount)
        except (ValueError, TypeError):
            return jsonify({"success": False, "error": "approved_amount must be numeric."}), 400
        update_fields["approved_amount"] = approved_amount
        update_fields["emi"] = calculate_emi(
            approved_amount,
            doc.get("interest_rate", 10.5),
            doc.get("tenure_months", 12)
        )
        update_fields["outstanding_balance"] = approved_amount

    if new_status == "Disbursed":
        disbursed_amount = doc.get("approved_amount") or doc.get("amount_requested")
        util_event = {
            "loan_id": loan_id,
            "event_type": "Disbursement",
            "amount": disbursed_amount,
            "balance_remaining": disbursed_amount,
            "event_date": datetime.now(timezone.utc).isoformat(),
            "notes": "Initial disbursement on loan activation."
        }
        db["loan_utilization"].insert_one(util_event)
        update_fields["total_disbursed"] = disbursed_amount
        update_fields["outstanding_balance"] = disbursed_amount

    db["loan_applications"].update_one({"_id": oid}, {"$set": update_fields})
    updated = serialize(db["loan_applications"].find_one({"_id": oid}))

    return jsonify({
        "success": True,
        "message": f"Loan status updated to '{new_status}'.",
        "application": updated
    })


# ═══════════════════════════════════════════════════════════════════
# ROUTE 5 - Record a Utilization / Expense Proof Event
# POST /loan/utilization
# ═══════════════════════════════════════════════════════════════════
@loan_bp.route("/utilization", methods=["POST"])
def record_utilization():
    data = request.get_json(silent=True) or {}

    required = ["loan_id", "event_type", "amount"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"success": False, "error": f"Missing fields: {', '.join(missing)}"}), 400

    valid_events = {
        "Disbursement", "Fund Utilization", "Vendor Payment",
        "Material Purchase", "Equipment Purchase", "Operational Expense",
        "EMI Payment", "Prepayment", "Principal Repayment", "Interest Payment", "Penalty"
    }
    if data["event_type"] not in valid_events:
        return jsonify({
            "success": False,
            "error": f"event_type must be one of: {', '.join(sorted(valid_events))}"
        }), 400

    try:
        amount = float(data["amount"])
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Amount must be numeric."}), 400
    if amount <= 0:
        return jsonify({"success": False, "error": "Amount must be positive."}), 400

    loan_id = str(data["loan_id"])
    oid = valid_object_id(loan_id)

    db = get_loan_db()
    if db is None:
        return jsonify({"success": False, "error": "Database unavailable."}), 503

    if oid is None:
        return jsonify({"success": False, "error": "Invalid loan_id."}), 400

    loan = db["loan_applications"].find_one({"_id": oid})
    if loan is None:
        return jsonify({"success": False, "error": "Loan not found."}), 404

    if loan.get("status") not in ("Approved", "Disbursed", "Closed"):
        return jsonify({
            "success": False,
            "error": f"Cannot record utilization for a loan in '{loan.get('status')}' status."
        }), 400

    event_type = data["event_type"]
    current_balance = float(loan.get("outstanding_balance") or 0)
    current_disbursed = float(loan.get("total_disbursed") or 0)
    current_repaid = float(loan.get("total_repaid") or 0)
    current_interest_paid = float(loan.get("total_interest_paid") or 0)

    loan_update = {}
    new_balance = current_balance
    principal_comp = 0.0
    interest_comp = 0.0

    if event_type == "Disbursement":
        new_balance = current_balance + amount
        loan_update = {
            "total_disbursed": current_disbursed + amount,
            "outstanding_balance": new_balance,
        }
    elif event_type == "EMI Payment":
        # Amortized EMI: interest calculated on outstanding principal balance
        rate = float(loan.get("interest_rate") or 10.5)
        monthly_rate = (rate / (12 * 100)) if rate > 0 else 0.0
        monthly_interest = round(current_balance * monthly_rate, 2)
        if amount <= monthly_interest:
            interest_comp = amount
            principal_comp = 0.0
        else:
            interest_comp = monthly_interest
            principal_comp = min(round(amount - interest_comp, 2), current_balance)

        new_balance = max(round(current_balance - principal_comp, 2), 0.0)
        loan_update = {
            "total_repaid": round(current_repaid + principal_comp, 2),
            "total_interest_paid": round(current_interest_paid + interest_comp, 2),
            "outstanding_balance": new_balance,
        }
        if new_balance <= 0:
            loan_update["status"] = "Closed"
    elif event_type in ("Prepayment", "Principal Repayment"):
        principal_comp = min(amount, current_balance)
        new_balance = max(round(current_balance - principal_comp, 2), 0.0)
        loan_update = {
            "total_repaid": round(current_repaid + principal_comp, 2),
            "outstanding_balance": new_balance,
        }
        if new_balance <= 0:
            loan_update["status"] = "Closed"
    elif event_type == "Interest Payment":
        interest_comp = amount
        loan_update = {
            "total_interest_paid": round(current_interest_paid + amount, 2)
        }
    elif event_type == "Penalty":
        new_balance = current_balance + amount
        loan_update = {"outstanding_balance": new_balance}
    else:
        # Fund Utilization / Vendor / Material / Equipment Purchase (Proof of Expenditure)
        # Tracks how the borrower utilizes the disbursed funds with proof
        pass

    loan_update["updated_at"] = datetime.now(timezone.utc).isoformat()
    if loan_update:
        db["loan_applications"].update_one({"_id": oid}, {"$set": loan_update})

    proof_url = data.get("proof_image") or data.get("proof_data")

    util_event = {
        "loan_id": loan_id,
        "applicant_name": loan.get("applicant_name"),
        "loan_type": loan.get("loan_type"),
        "event_type": event_type,
        "amount": amount,
        "principal_component": principal_comp,
        "interest_component": interest_comp,
        "balance_remaining": new_balance,
        "category": str(data.get("category", "General Expense")).strip(),
        "vendor_name": str(data.get("vendor_name", "")).strip(),
        "invoice_no": str(data.get("invoice_no", "")).strip(),
        "proof_data": proof_url,  # Base64 data URL for uploaded bill/invoice proof
        "proof_image": proof_url,
        "payment_mode": str(data.get("payment_mode", "Bank Transfer")).strip(),
        "event_date": datetime.now(timezone.utc).isoformat(),
        "notes": str(data.get("notes", "")).strip()
    }
    result = db["loan_utilization"].insert_one(util_event)
    util_event["_id"] = str(result.inserted_id)

    return jsonify({
        "success": True,
        "message": f"{event_type} record submitted successfully.",
        "event": util_event,
        "principal_component": principal_comp,
        "interest_component": interest_comp,
        "new_balance": new_balance
    }), 201


# ═══════════════════════════════════════════════════════════════════
# ROUTE 5B - Loan Repayment & Interest Servicing Module
# POST /loan/repay
# ═══════════════════════════════════════════════════════════════════
@loan_bp.route("/repay", methods=["POST"])
def repay_loan():
    data = request.get_json(silent=True) or {}

    loan_id = str(data.get("loan_id", "")).strip()
    payment_type = str(data.get("payment_type", "emi")).strip().lower()  # "emi", "principal", or "interest"
    
    if not loan_id:
        return jsonify({"success": False, "error": "Loan ID is required."}), 400

    try:
        amount = float(data.get("amount", 0))
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Repayment amount must be numeric."}), 400

    if amount <= 0:
        return jsonify({"success": False, "error": "Repayment amount must be greater than zero."}), 400

    oid = valid_object_id(loan_id)
    if oid is None:
        return jsonify({"success": False, "error": "Invalid Loan ID format."}), 400

    db = get_loan_db()
    if db is None:
        return jsonify({"success": False, "error": "Database unavailable."}), 503

    loan = db["loan_applications"].find_one({"_id": oid})
    if loan is None:
        return jsonify({"success": False, "error": "Loan application not found."}), 404

    if loan.get("status") not in ("Approved", "Disbursed", "Closed"):
        return jsonify({
            "success": False,
            "error": f"Cannot make payment on a loan with status '{loan.get('status')}'."
        }), 400

    current_balance = float(loan.get("outstanding_balance") or 0)
    current_repaid = float(loan.get("total_repaid") or 0)
    current_interest_paid = float(loan.get("total_interest_paid") or 0)
    payment_mode = str(data.get("payment_mode", "UPI")).strip()
    txn_ref = str(data.get("transaction_ref", f"TXN{int(datetime.now().timestamp()*1000)}")).strip()
    notes = str(data.get("notes", "")).strip()
    proof_data = data.get("proof_image") or data.get("proof_data")
    now_iso = datetime.now(timezone.utc).isoformat()

    loan_update = {"updated_at": now_iso}

    if payment_type in ("emi", "emi payment"):
        # OPTION 1: Standard Amortized EMI Payment
        # Monthly interest calculated on current reducing balance
        rate = float(loan.get("interest_rate") or 10.5)
        monthly_rate = (rate / (12 * 100)) if rate > 0 else 0.0
        monthly_interest = round(current_balance * monthly_rate, 2)

        if amount <= monthly_interest:
            interest_comp = amount
            principal_comp = 0.0
        else:
            interest_comp = monthly_interest
            principal_comp = min(round(amount - interest_comp, 2), current_balance)

        new_balance = max(round(current_balance - principal_comp, 2), 0.0)
        new_repaid = round(current_repaid + principal_comp, 2)
        new_interest_paid = round(current_interest_paid + interest_comp, 2)

        loan_update["total_repaid"] = new_repaid
        loan_update["total_interest_paid"] = new_interest_paid
        loan_update["outstanding_balance"] = new_balance
        if new_balance <= 0:
            loan_update["status"] = "Closed"

        event_name = "EMI Payment"
        message = (
            f"✓ EMI payment of ₹{amount:,.2f} processed. "
            f"(Principal: ₹{principal_comp:,.2f}, Interest: ₹{interest_comp:,.2f}). "
            f"Remaining Balance: ₹{new_balance:,.2f}"
        )
    elif payment_type == "interest":
        # OPTION 2: Pay Loan Interest
        interest_comp = amount
        principal_comp = 0.0
        new_interest_paid = round(current_interest_paid + amount, 2)
        loan_update["total_interest_paid"] = new_interest_paid
        event_name = "Interest Payment"
        new_balance = current_balance
        message = f"✓ Interest payment of ₹{amount:,.2f} recorded successfully."
    else:
        # OPTION 3: Repay Principal Amount (Prepayment / Foreclosure)
        payment_type = "principal"
        principal_comp = min(amount, current_balance)
        interest_comp = 0.0
        new_balance = max(round(current_balance - principal_comp, 2), 0.0)
        new_repaid = round(current_repaid + principal_comp, 2)
        loan_update["total_repaid"] = new_repaid
        loan_update["outstanding_balance"] = new_balance
        if new_balance <= 0:
            loan_update["status"] = "Closed"
        event_name = "Principal Repayment"
        message = f"✓ Principal prepayment of ₹{principal_comp:,.2f} processed. Remaining Balance: ₹{new_balance:,.2f}"

    db["loan_applications"].update_one({"_id": oid}, {"$set": loan_update})
    updated_loan = serialize(db["loan_applications"].find_one({"_id": oid}))

    repay_event = {
        "loan_id": loan_id,
        "applicant_name": loan.get("applicant_name"),
        "loan_type": loan.get("loan_type"),
        "event_type": event_name,
        "payment_type": payment_type,
        "amount": amount,
        "principal_component": principal_comp,
        "interest_component": interest_comp,
        "balance_remaining": new_balance,
        "payment_mode": payment_mode,
        "transaction_ref": txn_ref,
        "proof_data": proof_data,
        "proof_image": proof_data,
        "event_date": now_iso,
        "notes": notes or f"{event_name} via {payment_mode}"
    }
    result = db["loan_utilization"].insert_one(repay_event)
    repay_event["_id"] = str(result.inserted_id)

    return jsonify({
        "success": True,
        "message": message,
        "payment_type": payment_type,
        "amount_paid": amount,
        "principal_component": principal_comp,
        "interest_component": interest_comp,
        "new_balance": new_balance,
        "total_interest_paid": updated_loan.get("total_interest_paid", 0),
        "total_repaid": updated_loan.get("total_repaid", 0),
        "receipt": repay_event,
        "loan": updated_loan
    }), 200


# ═══════════════════════════════════════════════════════════════════
# ROUTE 5C - Loan Amortization Schedule
# GET /loan/applications/<loan_id>/amortization
# ═══════════════════════════════════════════════════════════════════
@loan_bp.route("/applications/<loan_id>/amortization", methods=["GET"])
def get_amortization(loan_id):
    oid = valid_object_id(loan_id)
    if oid is None:
        return jsonify({"success": False, "error": "Invalid loan ID format."}), 400

    db = get_loan_db()
    if db is None:
        return jsonify({"success": False, "error": "Database unavailable."}), 503

    doc = db["loan_applications"].find_one({"_id": oid})
    if doc is None:
        return jsonify({"success": False, "error": "Loan application not found."}), 404

    principal = float(doc.get("approved_amount") or doc.get("amount_requested") or 0)
    rate = float(doc.get("interest_rate") or 10.5)
    tenure = int(doc.get("tenure_months") or 12)
    schedule = calculate_amortization_schedule(principal, rate, tenure)
    emi = calculate_emi(principal, rate, tenure)

    return jsonify({
        "success": True,
        "loan_id": loan_id,
        "principal": principal,
        "interest_rate": rate,
        "tenure_months": tenure,
        "emi": emi,
        "outstanding_balance": float(doc.get("outstanding_balance") or principal),
        "total_repaid": float(doc.get("total_repaid") or 0),
        "total_interest_paid": float(doc.get("total_interest_paid") or 0),
        "schedule": schedule
    })


# ═══════════════════════════════════════════════════════════════════
# ROUTE 6 - Get Utilization & Payment History for a Loan
# GET /loan/utilization/<loan_id>
# ═══════════════════════════════════════════════════════════════════
@loan_bp.route("/utilization/<loan_id>", methods=["GET"])
def get_utilization(loan_id):
    db = get_loan_db()
    if db is None:
        return jsonify({"success": False, "error": "Database unavailable."}), 503

    oid = valid_object_id(loan_id)
    loan_doc = db["loan_applications"].find_one({"_id": oid}) if oid else None

    events = list(
        db["loan_utilization"]
        .find({"loan_id": loan_id})
        .sort("event_date", DESCENDING)
    )
    events = [serialize(e) for e in events]
    for e in events:
        proof = e.get("proof_image") or e.get("proof_data")
        e["proof_image"] = proof
        e["proof_data"] = proof
        dt = e.get("event_date") or e.get("created_at") or e.get("date")
        e["event_date"] = dt
        e["created_at"] = dt

    return jsonify({
        "success": True,
        "loan_id": loan_id,
        "loan": serialize(loan_doc),
        "count": len(events),
        "events": events
    })


# ═══════════════════════════════════════════════════════════════════
# ROUTE 7 - Dashboard Aggregated Stats
# GET /loan/dashboard
# ═══════════════════════════════════════════════════════════════════
@loan_bp.route("/dashboard", methods=["GET"])
def dashboard():
    db = get_loan_db()
    if db is None:
        return jsonify({"success": False, "error": "Database unavailable."}), 503

    col = db["loan_applications"]
    email_filter = request.args.get("email", "").strip().lower()

    match_stage = [{"$match": {"email": email_filter}}] if email_filter else []

    pipeline_status = match_stage + [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = {doc["_id"]: doc["count"] for doc in col.aggregate(pipeline_status)}

    pipeline_type = match_stage + [
        {"$group": {"_id": "$loan_type", "count": {"$sum": 1}, "total_amount": {"$sum": "$amount_requested"}}}
    ]
    type_breakdown = [
        {"loan_type": doc["_id"], "count": doc["count"], "total_amount": round(doc["total_amount"], 2)}
        for doc in col.aggregate(pipeline_type)
    ]

    pipeline_totals = match_stage + [
        {
            "$group": {
                "_id": None,
                "total_applications": {"$sum": 1},
                "total_requested": {"$sum": "$amount_requested"},
                "total_approved": {
                    "$sum": {"$cond": [{"$ifNull": ["$approved_amount", False]}, "$approved_amount", 0]}
                },
                "total_disbursed": {"$sum": {"$ifNull": ["$total_disbursed", 0]}},
                "total_repaid": {"$sum": {"$ifNull": ["$total_repaid", 0]}},
                "total_interest_paid": {"$sum": {"$ifNull": ["$total_interest_paid", 0]}},
                "total_outstanding": {"$sum": {"$ifNull": ["$outstanding_balance", 0]}}
            }
        }
    ]
    totals_result = list(col.aggregate(pipeline_totals))
    totals = totals_result[0] if totals_result else {
        "total_applications": 0,
        "total_requested": 0,
        "total_approved": 0,
        "total_disbursed": 0,
        "total_repaid": 0,
        "total_interest_paid": 0,
        "total_outstanding": 0
    }
    totals.pop("_id", None)
    totals = {k: round(float(v), 2) for k, v in totals.items()}

    find_filter = {"email": email_filter} if email_filter else {}
    recent = [serialize(d) for d in col.find(find_filter).sort("applied_at", DESCENDING).limit(10)]

    pipeline_trend = match_stage + [
        {
            "$group": {
                "_id": {
                    "year": {"$substr": ["$applied_at", 0, 4]},
                    "month": {"$substr": ["$applied_at", 5, 2]}
                },
                "count": {"$sum": 1},
                "amount": {"$sum": "$amount_requested"}
            }
        },
        {"$sort": {"_id.year": 1, "_id.month": 1}},
        {"$limit": 6}
    ]
    trend = [
        {
            "month": f"{doc['_id']['year']}-{doc['_id']['month']}",
            "count": doc["count"],
            "amount": round(doc["amount"], 2)
        }
        for doc in col.aggregate(pipeline_trend)
    ]

    utilization_rate = 0.0
    if totals.get("total_disbursed", 0) > 0 and totals.get("total_approved", 0) > 0:
        utilization_rate = round(
            (totals["total_disbursed"] / totals["total_approved"]) * 100, 1
        )

    return jsonify({
        "success": True,
        "stats": {
            "total_applications": totals.get("total_applications", 0),
            "total_requested": totals.get("total_requested", 0),
            "total_approved": totals.get("total_approved", 0),
            "total_disbursed": totals.get("total_disbursed", 0),
            "total_repaid": totals.get("total_repaid", 0),
            "total_interest_paid": totals.get("total_interest_paid", 0),
            "total_outstanding": totals.get("total_outstanding", 0),
            "utilization_rate_pct": utilization_rate,
            "pending_approvals": status_counts.get("Pending", 0),
            "approved_count": status_counts.get("Approved", 0),
            "disbursed_count": status_counts.get("Disbursed", 0),
            "rejected_count": status_counts.get("Rejected", 0),
            "closed_count": status_counts.get("Closed", 0),
        },
        "status_breakdown": [{"status": k, "count": v} for k, v in status_counts.items()],
        "type_breakdown": type_breakdown,
        "monthly_trend": trend,
        "recent_applications": recent
    })

_MEMORY_USERS = {}

@loan_bp.route("/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    password = (data.get("password") or "").strip()
    role = data.get("role", "user")

    id_type = (data.get("id_type") or "Aadhaar").strip()
    id_number = (data.get("id_number") or "").strip()
    id_verified = bool(data.get("id_verified", False))

    if not name or not email or not password:
        return jsonify({"success": False, "error": "Name, email, and password are required."}), 400

    # Check in-memory store
    if email in _MEMORY_USERS:
        return jsonify({"success": False, "error": "An account with this email already exists. Please log in."}), 409

    db = get_loan_db()
    if db is not None:
        try:
            user_col = db["loan_users"]
            existing = user_col.find_one({"email": email})
            if existing:
                return jsonify({"success": False, "error": "An account with this email already exists. Please log in."}), 409

            user_doc = {
                "name": name,
                "email": email,
                "phone": phone,
                "password": password,
                "role": role,
                "id_type": id_type,
                "id_number": id_number,
                "id_verified": id_verified,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            res = user_col.insert_one(user_doc)
            user_doc["_id"] = str(res.inserted_id)
            # Sync to in-memory fallback
            _MEMORY_USERS[email] = {
                "name": name,
                "email": email,
                "phone": phone,
                "password": password,
                "role": role,
                "id_type": id_type,
                "id_number": id_number,
                "id_verified": id_verified,
                "_id": user_doc["_id"]
            }
            user_doc.pop("password", None)
            return jsonify({"success": True, "user": user_doc, "message": "Account registered successfully."}), 201
        except Exception as e:
            print(f"[loan_routes] Auth register db error: {e}")

    # Fallback / Local mode
    _MEMORY_USERS[email] = {
        "name": name,
        "email": email,
        "phone": phone,
        "password": password,
        "role": role,
        "id_type": id_type,
        "id_number": id_number,
        "id_verified": id_verified,
        "_id": f"mem_{len(_MEMORY_USERS)+1}"
    }
    return jsonify({
        "success": True,
        "user": {
            "name": name,
            "email": email,
            "phone": phone,
            "role": role,
            "id_type": id_type,
            "id_number": id_number,
            "id_verified": id_verified
        },
        "message": "Account registered successfully."
    }), 201


# ═══════════════════════════════════════════════════════════════════
# ROUTE 9 - User / Officer Login
# POST /loan/auth/login
# ═══════════════════════════════════════════════════════════════════
@loan_bp.route("/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    role = data.get("role", "user")

    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required."}), 400

    # 1. Officer Login Check
    if role == "officer":
        # Check if registered officer in DB or allow officer demo credentials
        db = get_loan_db()
        if db is not None:
            try:
                user = db["loan_users"].find_one({"email": email, "role": "officer"})
                if user:
                    if user.get("password") and user.get("password") != password:
                        return jsonify({"success": False, "error": "Incorrect officer password. Please try again."}), 401
                    user_res = serialize(user)
                    user_res.pop("password", None)
                    return jsonify({"success": True, "user": user_res}), 200
            except Exception as e:
                print(f"[loan_routes] Officer login error: {e}")

        # Standard officer portal access (default officer credentials)
        if email in ["admin@fund.com", "officer@fund.com", "admin@fundmatrix.com", "officer@bank.com"] or "officer" in email or "admin" in email:
            if password not in ["123456", "officer123", "admin123", "password", "bank123"]:
                return jsonify({"success": False, "error": "Incorrect password for Loan Officer. (Default: 123456)"}), 401
            return jsonify({
                "success": True,
                "user": {
                    "email": email,
                    "name": "Senior Loan Officer",
                    "role": "officer",
                    "phone": "+91 9876543210"
                }
            }), 200

    # 2. Customer / User Login Check
    db = get_loan_db()
    if db is not None:
        try:
            user_col = db["loan_users"]
            user = user_col.find_one({"email": email})
            if user:
                if user.get("password") and user.get("password") != password:
                    return jsonify({"success": False, "error": "Incorrect password. Please try again."}), 401
                user_res = serialize(user)
                user_res.pop("password", None)
                return jsonify({"success": True, "user": user_res}), 200
        except Exception as e:
            print(f"[loan_routes] Auth login db error: {e}")

    # 3. Check memory store fallback
    if email in _MEMORY_USERS:
        mem_user = _MEMORY_USERS[email]
        if mem_user.get("password") and mem_user.get("password") != password:
            return jsonify({"success": False, "error": "Incorrect password. Please try again."}), 401
        return jsonify({
            "success": True,
            "user": {
                "email": mem_user["email"],
                "name": mem_user["name"],
                "role": mem_user["role"],
                "phone": mem_user.get("phone", "")
            }
        }), 200

    # If user not found anywhere
    return jsonify({
        "success": False,
        "error": f"No account found with email '{email}'. Please create an account first."
    }), 404