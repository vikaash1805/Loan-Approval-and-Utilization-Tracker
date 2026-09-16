import os
import json
import re
import io
import base64
import hashlib
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from flask import Flask, request, render_template_string, jsonify
from flask_cors import CORS

from google import genai
from google.genai import types

from PIL import Image

from pydantic import BaseModel, Field
from typing import Optional, List

from pymongo import MongoClient


# ============================================================
# FLASK APPLICATION
# ============================================================

app = Flask(__name__)
CORS(app)


# ============================================================
# MONGODB CONFIGURATION & HELPERS
# ============================================================

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
FALLBACK_DB_FILE = os.path.join(os.path.dirname(__file__), "local_image_db.json")

def get_mongo_client():
    try:
        client_obj = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
        # Test connection with ping
        client_obj.admin.command('ping')
        db_obj = client_obj["image_verification_db"]
        return client_obj, db_obj
    except Exception as e:
        # Print warning but allow application to use fallback local storage gracefully if MongoDB is offline
        print(f"MongoDB Connection Note: {e}")
        return None, None


def load_fallback_db():
    if os.path.exists(FALLBACK_DB_FILE):
        try:
            with open(FALLBACK_DB_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def save_fallback_db(data):
    with open(FALLBACK_DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ============================================================
# GEMINI RESPONSE MODELS
# ============================================================

class IdentityCardData(BaseModel):
    card_type: str = Field(
        description="Type of identity card: Aadhaar or PAN"
    )
    name: Optional[str] = Field(
        None,
        description="Full name exactly as printed on the card"
    )
    aadhaar_number: Optional[str] = Field(
        None,
        description="12 digit Aadhaar number. Null if this is a PAN card."
    )
    pan_number: Optional[str] = Field(
        None,
        description="10 character PAN number. Null if this is an Aadhaar card."
    )
    dob: Optional[str] = Field(
        None,
        description="Date of birth in DD/MM/YYYY format"
    )
    gender: Optional[str] = Field(
        None,
        description="Gender. Usually available on Aadhaar. Null if not available."
    )
    is_valid_id: bool = Field(
        description="True if the uploaded document is a valid Indian Aadhaar or PAN card."
    )


class ImageAnalysisData(BaseModel):
    description: str = Field(
        description="Detailed visual description of content, subject, background, and features in the image."
    )
    category: str = Field(
        description="Primary category of the image (e.g. Document, Photo, Product, Logo, Artwork, ID Card, Receipt, Landscape, Portrait, Chart, Text Document)."
    )
    detected_text: Optional[str] = Field(
        None,
        description="Any readable text found in the image. Return null or empty string if no readable text."
    )
    visual_tags: List[str] = Field(
        default_factory=list,
        description="5-8 key visual terms or objects present in the image."
    )
    is_valid_image: bool = Field(
        default=True,
        description="True if this is a valid, readable image file."
    )


# ============================================================
# GEMINI CLIENT
# ============================================================

try:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if api_key:
        client = genai.Client(api_key=api_key)
    else:
        client = genai.Client()

    print("Gemini client initialized successfully!")

except Exception as e:
    print("Gemini initialization error:")
    print(e)
    client = None


# ============================================================
# HTML TEMPLATE
# ============================================================

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Image Verification & MongoDB Duplicate Checker</title>

<!-- Modern Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<style>
:root {
    --bg-gradient: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    --card-bg: #ffffff;
    --card-border: #e2e8f0;
    --text-main: #0f172a;
    --text-muted: #64748b;
    --primary: #4f46e5;
    --primary-hover: #4338ca;
    --success: #10b981;
    --success-bg: #ecfdf5;
    --success-border: #10b981;
    --danger: #ef4444;
    --danger-bg: #fef2f2;
    --danger-border: #ef4444;
    --accent: #6366f1;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'Inter', sans-serif;
    background-color: #f8fafc;
    background-image: 
        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.05) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(79, 70, 229, 0.05) 0px, transparent 50%);
    min-height: 100vh;
    color: var(--text-main);
    padding: 30px 20px;
}

.container {
    max-width: 1000px;
    margin: 0 auto;
}

/* Header */
.header {
    text-align: center;
    margin-bottom: 30px;
}

.header h1 {
    font-family: 'Outfit', sans-serif;
    font-size: 2.4rem;
    font-weight: 800;
    background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 8px;
}

.header p {
    color: var(--text-muted);
    font-size: 1rem;
}

/* Status Pill */
.db-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #ffffff;
    border: 1px solid var(--card-border);
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 0.85rem;
    color: #334155;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    margin-top: 14px;
}

.status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--danger);
}

.status-dot.online {
    background: var(--success);
    box-shadow: 0 0 8px var(--success);
}

/* Navigation Tabs */
.tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 25px;
    background: #e2e8f0;
    padding: 6px;
    border-radius: 12px;
    border: 1px solid #cbd5e1;
}

.tab-btn {
    flex: 1;
    padding: 12px 20px;
    font-family: 'Outfit', sans-serif;
    font-size: 0.98rem;
    font-weight: 600;
    background: transparent;
    color: var(--text-muted);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.tab-btn:hover {
    color: var(--text-main);
    background: rgba(255, 255, 255, 0.6);
}

.tab-btn.active {
    background: #ffffff;
    color: var(--primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Tab Content */
.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
}

/* Glass Card */
.glass-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    margin-bottom: 24px;
}

/* Upload Area */
.upload-dropzone {
    border: 2px dashed #cbd5e1;
    border-radius: 12px;
    padding: 35px 20px;
    text-align: center;
    background: #f8fafc;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
}

.upload-dropzone:hover {
    border-color: var(--primary);
    background: #eef2ff;
}

.upload-icon {
    font-size: 2.8rem;
    margin-bottom: 12px;
}

.upload-title {
    font-weight: 600;
    font-size: 1.1rem;
    color: var(--text-main);
    margin-bottom: 6px;
}

.upload-sub {
    color: var(--text-muted);
    font-size: 0.85rem;
}

input[type="file"] {
    display: none;
}

.preview-container {
    display: none;
    margin-top: 20px;
    text-align: center;
}

.preview-img {
    max-width: 100%;
    max-height: 250px;
    border-radius: 8px;
    border: 1px solid var(--card-border);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

/* Form Controls */
.form-group {
    margin-bottom: 20px;
}

label {
    display: block;
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 8px;
    color: #334155;
}

input[type="text"], select {
    width: 100%;
    padding: 12px 16px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    color: var(--text-main);
    font-size: 0.95rem;
    outline: none;
    transition: all 0.2s ease;
}

input[type="text"]:focus, select:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
}

/* Action Buttons */
.btn-primary {
    width: 100%;
    padding: 14px 24px;
    font-family: 'Outfit', sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(79, 70, 229, 0.25);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(79, 70, 229, 0.4);
}

.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

/* Result Banners */
.result-box {
    display: none;
    margin-top: 25px;
    padding: 24px;
    border-radius: 14px;
    animation: fadeIn 0.4s ease-in-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.result-positive {
    background: var(--success-bg);
    border: 2px solid var(--success-border);
    box-shadow: 0 2px 12px rgba(16, 185, 129, 0.15);
}

.result-negative {
    background: var(--danger-bg);
    border: 2px solid var(--danger-border);
    box-shadow: 0 2px 12px rgba(239, 68, 68, 0.15);
}

.result-title {
    font-family: 'Outfit', sans-serif;
    font-size: 1.3rem;
    font-weight: 700;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.result-positive .result-title { color: #059669; }
.result-negative .result-title { color: #dc2626; }

.result-message {
    font-size: 1.05rem;
    line-height: 1.5;
    margin-bottom: 16px;
    color: var(--text-main);
}

/* Data Display Grid */
.info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
    margin-top: 16px;
}

.info-item {
    background: #f8fafc;
    padding: 14px;
    border-radius: 8px;
    border: 1px solid var(--card-border);
}

.info-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 4px;
}

.info-value {
    font-size: 0.95rem;
    font-weight: 600;
    color: #0f172a;
    word-break: break-all;
}

/* Database Table */
.db-table-container {
    margin-top: 20px;
    overflow-x: auto;
}

.db-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
}

.db-table th, .db-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--card-border);
}

.db-table th {
    background: #f1f5f9;
    color: #475569;
    font-weight: 600;
}

.db-table td {
    color: #334155;
}

.db-table tr:hover {
    background: #f8fafc;
}

.badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
}

.badge-purple { background: rgba(139, 92, 246, 0.12); color: #7c3aed; border: 1px solid #c4b5fd; }

pre {
    background: #0f172a;
    padding: 14px;
    border-radius: 8px;
    font-size: 0.85rem;
    color: #a5f3fc;
    overflow-x: auto;
    max-height: 250px;
}
</style>
</head>

<body>

<div class="container">

    <!-- Header -->
    <div class="header">
        <h1>AI Image & Document Verification System</h1>
        <p>Powered by Google AI Studio (Gemini 2.5/3.5) & MongoDB Compass Database</p>
        
        <div class="db-status-pill">
            <span class="status-dot" id="dbDot"></span>
            <span id="dbStatusText">Checking MongoDB status...</span>
        </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('imageCheckTab', this)">
            🖼️ Image Duplicate Check (MongoDB & Gemini AI)
        </button>
        <button class="tab-btn" onclick="switchTab('idVerifyTab', this)">
            🆔 Aadhaar & PAN Card Verification
        </button>
    </div>

    <!-- ========================================================
         TAB 1: IMAGE DUPLICATE CHECK
    ======================================================== -->
    <div id="imageCheckTab" class="tab-content active">
        <div class="glass-card">
            <h2 style="font-family: 'Outfit'; font-size: 1.4rem; margin-bottom: 6px; color: #4338ca;">
                Image Verification & MongoDB Duplicate Detector
            </h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">
                Upload an image. The algorithm will verify the image using <strong>Google AI Studio API</strong> and search if it already exists in the <strong>MongoDB Compass</strong> database.
            </p>

            <form id="imageCheckForm" enctype="multipart/form-data">
                <div class="upload-dropzone" onclick="document.getElementById('checkImageInput').click()">
                    <div class="upload-icon">📸</div>
                    <div class="upload-title">Click or Drag & Drop Image Here</div>
                    <div class="upload-sub">Supports PNG, JPG, JPEG, WEBP, GIF (Max 10MB)</div>
                    <input type="file" id="checkImageInput" name="image" accept="image/*" required onchange="handleImagePreview(this, 'checkPreview', 'checkPreviewImg')">
                </div>

                <div id="checkPreview" class="preview-container">
                    <img id="checkPreviewImg" class="preview-img" src="" alt="Preview">
                </div>

                <button type="submit" id="imageSubmitBtn" class="btn-primary" style="margin-top: 20px;">
                    🔍 Verify Image in MongoDB
                </button>
            </form>

            <!-- Result Box -->
            <div id="imageResultBox" class="result-box">
                <div class="result-title" id="imageResultTitle"></div>
                <div class="result-message" id="imageResultMessage"></div>
                
                <h4 style="color: #334155; margin-top: 16px; font-size: 0.95rem;">AI Visual Analysis (Google AI Studio):</h4>
                <div class="info-grid" id="imageInfoGrid"></div>

                <h4 style="color: #334155; margin-top: 20px; font-size: 0.95rem;">Full Response Payload:</h4>
                <pre id="imageJsonOutput" style="margin-top: 8px;"></pre>
            </div>
        </div>

        <!-- Database Overview Card -->
        <div class="glass-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="font-family: 'Outfit'; color: #0f172a; font-size: 1.2rem;">
                    📁 Registered Images in MongoDB Compass
                </h3>
                <button onclick="loadRegisteredImages()" style="background: #f1f5f9; border: 1px solid var(--card-border); color: #475569; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500;">
                    🔄 Refresh List
                </button>
            </div>
            
            <div class="db-table-container">
                <table class="db-table">
                    <thead>
                        <tr>
                            <th>Preview</th>
                            <th>Filename</th>
                            <th>Category</th>
                            <th>SHA-256 Hash</th>
                            <th>Registered Date</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="dbTableBody">
                        <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Loading database records...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>


    <!-- ========================================================
         TAB 2: AADHAAR & PAN VERIFICATION
    ======================================================== -->
    <div id="idVerifyTab" class="tab-content">
        <div class="glass-card">
            <h2 style="font-family: 'Outfit'; font-size: 1.4rem; margin-bottom: 6px; color: #7c3aed;">
                Loan Identity Verification (Aadhaar + PAN)
            </h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 24px;">
                Extract and cross-verify customer details against uploaded Aadhaar and PAN documents using Google AI Studio.
            </p>

            <form id="idVerificationForm" enctype="multipart/form-data">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                    <div class="form-group">
                        <label>Full Name *</label>
                        <input type="text" name="user_name" placeholder="Full name as on ID" required>
                    </div>

                    <div class="form-group">
                        <label>Date of Birth *</label>
                        <input type="text" name="user_dob" placeholder="DD/MM/YYYY" required>
                    </div>

                    <div class="form-group">
                        <label>Gender *</label>
                        <select name="user_gender" required>
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Transgender">Transgender</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Aadhaar Number *</label>
                        <input type="text" name="user_aadhaar" placeholder="12 digit Aadhaar (e.g. 1234 5678 9012)" maxlength="19" required>
                    </div>

                    <div class="form-group">
                        <label>PAN Number *</label>
                        <input type="text" name="user_pan" placeholder="10 char PAN (ABCDE1234F)" maxlength="10" required>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 10px;">
                    <div class="form-group">
                        <label>Aadhaar Card Image *</label>
                        <input type="file" name="aadhaar_image" accept="image/*" required style="display: block; width: 100%; padding: 10px; background: #f8fafc; border: 1px solid var(--card-border); border-radius: 8px; color: #334155;">
                    </div>

                    <div class="form-group">
                        <label>PAN Card Image *</label>
                        <input type="file" name="pan_image" accept="image/*" required style="display: block; width: 100%; padding: 10px; background: #f8fafc; border: 1px solid var(--card-border); border-radius: 8px; color: #334155;">
                    </div>
                </div>

                <button type="submit" id="idSubmitBtn" class="btn-primary" style="margin-top: 20px;">
                    🪪 Verify Aadhaar + PAN Cards
                </button>
            </form>

            <div id="idResultBox" class="result-box">
                <div class="result-title" id="idResultTitle"></div>
                <div id="idMatchResults" style="margin-top: 16px;"></div>
                <h4 style="color: #334155; margin-top: 20px;">Extracted Structured Data:</h4>
                <pre id="idExtractedData" style="margin-top: 8px;"></pre>
            </div>
        </div>
    </div>

</div>

<script>
// Tab Switcher
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');

    if (tabId === 'imageCheckTab') {
        loadRegisteredImages();
    }
}

// Image Preview Handler
function handleImagePreview(input, containerId, imgId) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(imgId).src = e.target.result;
            document.getElementById(containerId).style.display = 'block';
        }
        reader.readAsDataURL(file);
    }
}

// Check MongoDB Connection Status
async function checkDbStatus() {
    const dot = document.getElementById('dbDot');
    const text = document.getElementById('dbStatusText');
    try {
        const res = await fetch('/db-status');
        const data = await res.json();
        if (data.connected) {
            dot.className = 'status-dot online';
            text.innerText = `MongoDB Compass Connected (${data.database})`;
        } else {
            dot.className = 'status-dot';
            text.innerText = `MongoDB Offline (${data.message})`;
        }
    } catch (e) {
        dot.className = 'status-dot';
        text.innerText = 'MongoDB Status Check Failed';
    }
}

// Load List of Registered Images from MongoDB
async function loadRegisteredImages() {
    const tbody = document.getElementById('dbTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Fetching registered images from MongoDB...</td></tr>';
    
    try {
        const res = await fetch('/mongodb-images');
        const data = await res.json();
        
        if (!data.success || !data.images || data.images.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No registered images found in MongoDB yet. Upload an image above!</td></tr>';
            return;
        }

        let html = '';
        data.images.forEach(img => {
            const hashShort = img.sha256_hash ? img.sha256_hash.substring(0, 16) + '...' : 'N/A';
            const cat = (img.gemini_analysis && img.gemini_analysis.category) || 'General';
            const dateStr = img.uploaded_at || 'N/A';
            const imgTag = img.image_data 
                ? `<img src="${img.image_data}" alt="Preview" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid var(--card-border);">` 
                : `<span style="font-size: 1.5rem;">🖼️</span>`;

            html += `
                <tr>
                    <td>${imgTag}</td>
                    <td><strong>${img.filename || 'Unnamed Image'}</strong></td>
                    <td><span class="badge badge-purple">${cat}</span></td>
                    <td><code style="font-size:0.8rem; color:#94a3b8;">${hashShort}</code></td>
                    <td>${dateStr}</td>
                    <td><button onclick="alert('Document ID: ${img._id}')" style="background:none; border:none; color:#818cf8; cursor:pointer; text-decoration:underline;">View ID</button></td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171;">Failed to load records: ${e.message}</td></tr>`;
    }
}

// Image Duplicate Check Form Handler
document.getElementById('imageCheckForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('imageSubmitBtn');
    const resultBox = document.getElementById('imageResultBox');
    const resultTitle = document.getElementById('imageResultTitle');
    const resultMsg = document.getElementById('imageResultMessage');
    const infoGrid = document.getElementById('imageInfoGrid');
    const jsonOutput = document.getElementById('imageJsonOutput');

    btn.disabled = true;
    btn.innerText = '🔍 Verifying Image with Google AI Studio & MongoDB...';
    resultBox.style.display = 'none';

    const formData = new FormData(this);

    try {
        const response = await fetch('/check-image', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        resultBox.style.display = 'block';

        if (!response.ok && !data.status) {
            throw new Error(data.error || 'Image verification failed');
        }

        // Display Positive or Negative Result
        if (data.status === 'positive') {
            resultBox.className = 'result-box result-positive';
            resultTitle.innerHTML = '<span>✓ POSITIVE RESULT</span>';
            resultMsg.innerText = data.message;
        } else {
            resultBox.className = 'result-box result-negative';
            resultTitle.innerHTML = '<span>✗ NEGATIVE RESULT (DUPLICATE DETECTED)</span>';
            resultMsg.innerText = data.message;
        }

        // Render AI Analysis Info Grid
        const analysis = data.gemini_analysis || {};
        const tags = (analysis.visual_tags || []).join(', ') || 'N/A';
        
        infoGrid.innerHTML = `
            <div class="info-item">
                <div class="info-label">Result Status</div>
                <div class="info-value" style="color: ${data.status === 'positive' ? '#34d399' : '#f87171'}">${data.status.toUpperCase()}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Image Category</div>
                <div class="info-value">${analysis.category || 'General'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Visual Tags</div>
                <div class="info-value">${tags}</div>
            </div>
            <div class="info-item">
                <div class="info-label">SHA-256 Hash</div>
                <div class="info-value" style="font-size:0.8rem;">${data.sha256_hash || 'N/A'}</div>
            </div>
            <div class="info-item" style="grid-column: 1 / -1;">
                <div class="info-label">AI Visual Description</div>
                <div class="info-value" style="font-weight:400; font-size:0.9rem;">${analysis.description || 'N/A'}</div>
            </div>
        `;

        jsonOutput.innerText = JSON.stringify(data, null, 2);

        // Refresh database table
        loadRegisteredImages();

    } catch (err) {
        resultBox.style.display = 'block';
        resultBox.className = 'result-box result-negative';
        resultTitle.innerHTML = '<span>⚠️ System Error</span>';
        resultMsg.innerText = err.message;
        jsonOutput.innerText = '';
    } finally {
        btn.disabled = false;
        btn.innerText = '🔍 Verify Image in MongoDB';
    }
});


// Aadhaar + PAN Verification Form Handler
document.getElementById('idVerificationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('idSubmitBtn');
    const resultBox = document.getElementById('idResultBox');
    const resultTitle = document.getElementById('idResultTitle');
    const matchResults = document.getElementById('idMatchResults');
    const extractedData = document.getElementById('idExtractedData');

    btn.disabled = true;
    btn.innerText = 'Processing Aadhaar + PAN...';
    resultBox.style.display = 'none';

    const formData = new FormData(this);

    try {
        const response = await fetch('/verify', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Verification failed');
        }

        resultBox.style.display = 'block';

        if (data.overall_match === true) {
            resultBox.className = 'result-box result-positive';
            resultTitle.innerText = '✓ ALL DETAILS MATCH';
        } else {
            resultBox.className = 'result-box result-negative';
            resultTitle.innerText = '✗ VERIFICATION FAILED';
        }

        let html = '<div class="info-grid">';
        for (const [field, result] of Object.entries(data.fields)) {
            const matched = result.match;
            const symbol = matched ? '✓' : '✗';
            const color = matched ? '#34d399' : '#f87171';

            html += `
                <div class="info-item" style="border-left: 3px solid ${color}">
                    <div class="info-label" style="color:${color}">${symbol} ${field}</div>
                    <div class="info-value">User: ${result.user_value ?? 'Not provided'}</div>
                    <div class="info-value" style="font-size:0.85rem; color:#94a3b8;">Extracted: ${result.extracted_value ?? 'Not detected'}</div>
                </div>
            `;
        }
        html += '</div>';
        matchResults.innerHTML = html;
        extractedData.innerText = JSON.stringify(data.extracted, null, 2);

    } catch (err) {
        resultBox.style.display = 'block';
        resultBox.className = 'result-box result-negative';
        resultTitle.innerText = 'Error';
        matchResults.innerHTML = err.message;
        extractedData.innerText = '';
    } finally {
        btn.disabled = false;
        btn.innerText = '🪪 Verify Aadhaar + PAN Cards';
    }
});

// Run status checks on boot
checkDbStatus();
loadRegisteredImages();
</script>

</body>
</html>
"""


# ============================================================
# API ROUTE: MONGODB STATUS CHECK
# ============================================================

@app.route("/db-status")
def db_status():
    client_obj, db_obj = get_mongo_client()
    if db_obj is not None:
        return jsonify({
            "connected": True,
            "database": "image_verification_db",
            "uri": MONGODB_URI,
            "message": "MongoDB Compass Local Server Connected"
        })
    else:
        return jsonify({
            "connected": False,
            "database": "Local JSON Fallback",
            "message": "MongoDB service offline (Using active fallback database)"
        })


# ============================================================
# API ROUTE: GET ALL MONGODB REGISTERED IMAGES
# ============================================================

@app.route("/mongodb-images", methods=["GET"])
def get_mongodb_images():
    try:
        client_obj, db_obj = get_mongo_client()
        images = []
        
        if db_obj is not None:
            collection = db_obj["registered_images"]
            cursor = collection.find().sort("uploaded_at", -1).limit(50)
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                images.append(doc)
        else:
            images = load_fallback_db()
            images.reverse()

        return jsonify({
            "success": True,
            "count": len(images),
            "images": images
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# GEMINI IMAGE ANALYSIS FUNCTION
# ============================================================

def analyze_image_with_gemini(pil_image):
    if client is None:
        raise Exception("Gemini client is not initialized. Check GEMINI_API_KEY in .env.")

    prompt = """
    You are an advanced AI vision system powered by Google AI Studio.
    Analyze the uploaded image carefully and provide:
    1. A detailed 2-3 sentence visual description of the content, subject, and features.
    2. The primary category of the image.
    3. Any readable text present in the image.
    4. 5-8 key visual tags/keywords representing main objects, subjects, and colors.
    5. Confirm if it is a valid, readable image.
    """

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=[pil_image, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ImageAnalysisData,
            temperature=0.1
        )
    )

    return json.loads(response.text)


# ============================================================
# API ROUTE: CHECK IMAGE DUPLICATE IN MONGODB
# ============================================================

@app.route("/check-image", methods=["POST"])
def check_image_duplicate():
    try:
        image_file = request.files.get("image")
        if not image_file or image_file.filename == "":
            return jsonify({
                "success": False,
                "error": "No image file provided. Please upload an image."
            }), 400

        # Read image bytes
        image_bytes = image_file.read()
        if len(image_bytes) == 0:
            return jsonify({
                "success": False,
                "error": "Uploaded image file is empty."
            }), 400

        # Compute SHA-256 hash of image bytes
        sha256_hash = hashlib.sha256(image_bytes).hexdigest()

        # Open image with PIL for Gemini AI analysis
        try:
            pil_image = Image.open(io.BytesIO(image_bytes))
            pil_image.load()
        except Exception:
            return jsonify({
                "success": False,
                "error": "Invalid or corrupted image format."
            }), 400

        # 1. Analyze image using Google AI Studio API (Gemini)
        gemini_analysis = analyze_image_with_gemini(pil_image)

        # 2. Check MongoDB for existing duplicate image
        client_obj, db_obj = get_mongo_client()
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        if db_obj is not None:
            collection = db_obj["registered_images"]
            
            # Query MongoDB by SHA-256 hash
            existing_doc = collection.find_one({"sha256_hash": sha256_hash})

            if existing_doc:
                existing_doc["_id"] = str(existing_doc["_id"])
                # Do NOT save duplicate images - return duplicate notice
                return jsonify({
                    "success": True,
                    "exists": True,
                    "status": "negative",
                    "message": "✗ Document already exists in database. Duplicate documents are not allowed.",
                    "sha256_hash": sha256_hash,
                    "gemini_analysis": gemini_analysis,
                    "document": existing_doc
                })

            # Image is NOT registered in MongoDB -> Save ONLY this unregistered original image
            image_b64 = base64.b64encode(image_bytes).decode("utf-8")
            mime_type = image_file.content_type or "image/jpeg"
            image_data_url = f"data:{mime_type};base64,{image_b64}"

            new_doc = {
                "filename": image_file.filename,
                "sha256_hash": sha256_hash,
                "image_data": image_data_url,
                "gemini_analysis": gemini_analysis,
                "uploaded_at": now_str,
                "file_size_kb": round(len(image_bytes) / 1024, 2),
                "image_dimensions": f"{pil_image.width}x{pil_image.height}"
            }
            insert_res = collection.insert_one(new_doc)
            new_doc["_id"] = str(insert_res.inserted_id)

            return jsonify({
                "success": True,
                "exists": False,
                "status": "positive",
                "message": "✓ Document is original and verified (Registered in database).",
                "sha256_hash": sha256_hash,
                "gemini_analysis": gemini_analysis,
                "document": new_doc
            })

        else:
            # Fallback local store if MongoDB local daemon is not running
            fallback_db = load_fallback_db()
            existing_item = next((item for item in fallback_db if item.get("sha256_hash") == sha256_hash), None)

            if existing_item:
                # Do NOT save duplicate images
                return jsonify({
                    "success": True,
                    "exists": True,
                    "status": "negative",
                    "message": "✗ Document already exists in database. Duplicate documents are not allowed.",
                    "sha256_hash": sha256_hash,
                    "gemini_analysis": gemini_analysis,
                    "document": existing_item
                })

            # Image is NOT registered in fallback store -> Save ONLY this unregistered original image
            image_b64 = base64.b64encode(image_bytes).decode("utf-8")
            mime_type = image_file.content_type or "image/jpeg"
            image_data_url = f"data:{mime_type};base64,{image_b64}"

            new_item = {
                "_id": f"fb_{len(fallback_db) + 1}",
                "filename": image_file.filename,
                "sha256_hash": sha256_hash,
                "image_data": image_data_url,
                "gemini_analysis": gemini_analysis,
                "uploaded_at": now_str,
                "file_size_kb": round(len(image_bytes) / 1024, 2),
                "image_dimensions": f"{pil_image.width}x{pil_image.height}"
            }
            fallback_db.append(new_item)
            save_fallback_db(fallback_db)

            return jsonify({
                "success": True,
                "exists": False,
                "status": "positive",
                "message": "✓ Document is original and verified (Registered in database).",
                "sha256_hash": sha256_hash,
                "gemini_analysis": gemini_analysis,
                "document": new_item
            })

    except Exception as e:
        print("\nImage Duplicate Check Error:", str(e))
        return jsonify({
            "success": False,
            "error": f"Image verification error: {str(e)}"
        }), 500


# ============================================================
# IDENTITY CARD FIELD HELPERS & ROUTE
# ============================================================

@app.route("/")
def home():
    return render_template_string(HTML_TEMPLATE)


def normalize_name(value):
    if not value:
        return ""
    value = str(value).upper().strip()
    value = re.sub(r"[^A-Z\s]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value

def match_names(user_name, extracted_name):
    u = normalize_name(user_name)
    e = normalize_name(extracted_name)
    if not u or not e:
        return False
    if u == e:
        return True
    
    u_tokens = set(u.split())
    e_tokens = set(e.split())
    
    if u_tokens == e_tokens:
        return True
    if u_tokens.issubset(e_tokens) or e_tokens.issubset(u_tokens):
        return True
        
    # Ignore single-letter initials (e.g. Vikaash V vs Vikaash)
    u_long = {w for w in u_tokens if len(w) > 1}
    e_long = {w for w in e_tokens if len(w) > 1}
    if u_long and e_long and (u_long == e_long or u_long.issubset(e_long) or e_long.issubset(u_long)):
        return True
        
    if u in e or e in u:
        return True
        
    return False

def parse_date_components(date_str):
    if not date_str:
        return None
    cleaned = str(date_str).strip().replace(".", "/").replace("-", "/")
    parts = [p.strip() for p in cleaned.split("/") if p.strip()]
    if len(parts) == 3:
        # If YYYY/MM/DD
        if len(parts[0]) == 4:
            return (parts[0], parts[1].zfill(2), parts[2].zfill(2))
        # If DD/MM/YYYY
        elif len(parts[2]) == 4:
            return (parts[2], parts[1].zfill(2), parts[0].zfill(2))
        elif len(parts[2]) == 2:
            yyyy = ("19" if int(parts[2]) > 30 else "20") + parts[2]
            return (yyyy, parts[1].zfill(2), parts[0].zfill(2))
    elif len(parts) == 1 and len(parts[0]) == 4:
        # Only year
        return (parts[0], None, None)
    return None

def normalize_dob(value):
    comps = parse_date_components(value)
    if comps:
        yyyy, mm, dd = comps
        if mm and dd:
            return f"{dd}/{mm}/{yyyy}"
        return yyyy
    return str(value or "").strip()

def match_dobs(user_dob, extracted_dob):
    if not user_dob or not extracted_dob:
        return True  # Don't fail if DOB wasn't printed on document
    u_comps = parse_date_components(user_dob)
    e_comps = parse_date_components(extracted_dob)
    if not u_comps or not e_comps:
        return normalize_dob(user_dob) == normalize_dob(extracted_dob)
    
    # If one only has year (often on Aadhaar: "Year of Birth: 2004")
    if u_comps[1] is None or e_comps[1] is None:
        return u_comps[0] == e_comps[0]
    
    return u_comps == e_comps

def normalize_aadhaar(value):
    if not value:
        return ""
    return re.sub(r"\D", "", str(value))

def normalize_pan(value):
    if not value:
        return ""
    return re.sub(r"[^A-Za-z0-9]", "", str(value)).upper()

def normalize_gender(value):
    if not value:
        return ""
    val = str(value).upper().strip()
    if "FEM" in val or val == "F":
        return "FEMALE"
    if "MALE" in val or val == "M":
        return "MALE"
    if "TRANS" in val or "OTHER" in val or val == "T":
        return "TRANSGENDER"
    return val

def compare_field(user_value, extracted_value, field_type):
    if field_type == "name":
        matched = match_names(user_value, extracted_value)
    elif field_type == "aadhaar":
        u = normalize_aadhaar(user_value)
        e = normalize_aadhaar(extracted_value)
        matched = bool(u) and bool(e) and (u == e or (len(e) == 4 and u[-4:] == e))
    elif field_type == "pan":
        u = normalize_pan(user_value)
        e = normalize_pan(extracted_value)
        matched = bool(u) and bool(e) and (u == e)
    elif field_type == "dob":
        matched = match_dobs(user_value, extracted_value)
    elif field_type == "gender":
        u = normalize_gender(user_value)
        e = normalize_gender(extracted_value)
        matched = (u == e) if (u and e) else True
    else:
        matched = str(user_value or "").strip() == str(extracted_value or "").strip()

    return {
        "match": bool(matched),
        "user_value": user_value,
        "extracted_value": extracted_value or "Not detected"
    }

def extract_card(image, expected_type):
    if client is None:
        raise Exception("Gemini client is not initialized. Check GEMINI_API_KEY.")

    prompt = f"""
You are an Indian identity document data extraction system.
Analyze the uploaded document carefully.
Expected document type: {expected_type}

RULES:
1. Extract only information actually visible on the card.
2. For Aadhaar: 
   - Extract the 12-digit Aadhaar number as pure digits without spaces, hyphens, or grouping gaps (e.g. return "123456789012" even if printed as "1234 5678 9012").
   - Extract DOB (DD/MM/YYYY or YYYY), Gender, Name.
3. For PAN: 10-char PAN number (AAAAA9999A format), Name, DOB.
4. Set is_valid_id to true if this is a genuine Indian {expected_type} card.
"""

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=[image, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=IdentityCardData,
            temperature=0.1
        )
    )

    return json.loads(response.text)


@app.route("/verify", methods=["POST"])
def verify_documents():
    try:
        user_name = (request.form.get("user_name") or "").strip()
        user_dob = (request.form.get("user_dob") or "").strip()
        user_gender = (request.form.get("user_gender") or "").strip()
        user_aadhaar = (request.form.get("user_aadhaar") or "").strip()
        user_pan = (request.form.get("user_pan") or "").strip()

        missing_fields = []
        if not user_name: missing_fields.append("Name")
        if not user_aadhaar: missing_fields.append("Aadhaar Number")
        if not user_pan: missing_fields.append("PAN Number")

        if missing_fields:
            return jsonify({
                "success": False,
                "error": "The following user fields are required: " + ", ".join(missing_fields)
            }), 400

        aadhaar_file = request.files.get("aadhaar_image")
        pan_file = request.files.get("pan_image")

        if not aadhaar_file or aadhaar_file.filename == "":
            return jsonify({"success": False, "error": "Aadhaar card image is mandatory."}), 400

        if not pan_file or pan_file.filename == "":
            return jsonify({"success": False, "error": "PAN card image is mandatory."}), 400

        try:
            aadhaar_image = Image.open(aadhaar_file.stream)
            aadhaar_image.load()
        except Exception:
            return jsonify({"success": False, "error": "Unable to read Aadhaar image. Please upload a valid JPG or PNG."}), 400

        try:
            pan_image = Image.open(pan_file.stream)
            pan_image.load()
        except Exception:
            return jsonify({"success": False, "error": "Unable to read PAN image. Please upload a valid JPG or PNG."}), 400

        aadhaar_data = extract_card(aadhaar_image, "Aadhaar")
        pan_data = extract_card(pan_image, "PAN")

        # Fallback check: if numbers or names were extracted, mark is_valid_id as True
        if aadhaar_data.get("aadhaar_number") or aadhaar_data.get("name"):
            aadhaar_data["is_valid_id"] = True
        if pan_data.get("pan_number") or pan_data.get("name"):
            pan_data["is_valid_id"] = True

        extracted_name = aadhaar_data.get("name") or pan_data.get("name")
        extracted_dob = aadhaar_data.get("dob") or pan_data.get("dob")
        extracted_gender = aadhaar_data.get("gender")
        extracted_aadhaar = aadhaar_data.get("aadhaar_number")
        extracted_pan = pan_data.get("pan_number")

        name_res = compare_field(user_name, extracted_name, "name")
        dob_res = compare_field(user_dob, extracted_dob, "dob")
        gender_res = compare_field(user_gender, extracted_gender, "gender")
        aadhaar_res = compare_field(user_aadhaar, extracted_aadhaar, "aadhaar")
        pan_res = compare_field(user_pan, extracted_pan, "pan")

        fields = {
            "Name": name_res,
            "Date of Birth": dob_res,
            "Gender": gender_res,
            "Aadhaar Number": aadhaar_res,
            "PAN Number": pan_res
        }

        # Core required match criteria
        core_matched = name_res["match"] and aadhaar_res["match"] and pan_res["match"]
        optional_matched = dob_res["match"] and gender_res["match"]
        overall_match = core_matched and optional_matched

        return jsonify({
            "success": True,
            "overall_match": overall_match,
            "message": "All documents verified successfully." if overall_match else "Some details mismatch with the uploaded ID cards.",
            "fields": fields,
            "extracted_data": {
                "name": extracted_name,
                "dob": extracted_dob,
                "gender": extracted_gender,
                "aadhaar_number": extracted_aadhaar,
                "pan_number": extracted_pan,
                "aadhaar_raw": aadhaar_data,
                "pan_raw": pan_data
            },
            "checks": {
                "name_match": name_res["match"],
                "dob_match": dob_res["match"],
                "gender_match": gender_res["match"],
                "aadhaar_match": aadhaar_res["match"],
                "pan_match": pan_res["match"]
            }
        })

    except Exception as e:
        print("\nVerification Error:", str(e))
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# API ROUTE: SINGLE ID VERIFICATION FOR REGISTRATION
# ============================================================

@app.route("/verify-single-id", methods=["POST"])
def verify_single_id():
    try:
        id_type = request.form.get("id_type", "Aadhaar").strip()  # "Aadhaar" or "PAN"
        user_name = (request.form.get("user_name") or "").strip()
        id_number = (request.form.get("id_number") or "").strip()
        user_dob = (request.form.get("user_dob") or "").strip()
        user_gender = (request.form.get("user_gender") or "").strip()

        if not user_name:
            return jsonify({"success": False, "error": "Full Name is required."}), 400
        if not id_number:
            return jsonify({"success": False, "error": f"{id_type} Number is required."}), 400

        id_file = request.files.get("id_image")
        if not id_file or id_file.filename == "":
            return jsonify({"success": False, "error": f"Please upload a clear image of your {id_type} card."}), 400

        try:
            id_image = Image.open(id_file.stream)
            id_image.load()
        except Exception:
            return jsonify({"success": False, "error": "Unable to read uploaded ID image. Please upload a valid JPG/PNG."}), 400

        # Extract using Gemini AI
        card_data = extract_card(id_image, id_type)

        is_valid = card_data.get("is_valid_id", False)

        extracted_name = card_data.get("name")
        extracted_dob = card_data.get("dob")
        extracted_gender = card_data.get("gender")
        extracted_number = card_data.get("aadhaar_number") if id_type.lower() == "aadhaar" else card_data.get("pan_number")

        # Field comparisons
        fields = {
            "Name": compare_field(user_name, extracted_name, "name"),
            f"{id_type} Number": compare_field(id_number, extracted_number, "aadhaar" if id_type.lower() == "aadhaar" else "pan"),
        }

        if user_dob and extracted_dob:
            fields["Date of Birth"] = compare_field(user_dob, extracted_dob, "dob")

        if user_gender and extracted_gender and id_type.lower() == "aadhaar":
            fields["Gender"] = compare_field(user_gender, extracted_gender, "gender")

        all_matched = all(result["match"] for result in fields.values())
        overall_match = is_valid and all_matched

        if not overall_match:
            # When mismatched: do not store, do not reveal extracted values, do not state which field mismatched
            return jsonify({
                "success": True,
                "overall_match": False,
                "message": "The entered details are mismatched with the uploaded ID proof. Please check your details and try again."
            })

        return jsonify({
            "success": True,
            "overall_match": True,
            "id_type": id_type,
            "message": "ID verified successfully."
        })

    except Exception as e:
        print("\nSingle ID Verification Error:", str(e))
        return jsonify({"success": False, "error": f"ID Verification error: {str(e)}"}), 500


# ============================================================
# LOAN BLUEPRINT REGISTRATION
# ============================================================

from loan_routes import loan_bp
app.register_blueprint(loan_bp)

# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":
    print("========================================")
    print("AI Image & MongoDB Verification Server")
    print("========================================")
    print("Server: http://127.0.0.1:5000")
    print("========================================")

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )