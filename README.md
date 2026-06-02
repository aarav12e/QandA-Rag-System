# WebChat AI — Chrome Extension 🤖

> Chat with **any webpage** using Google Gemini AI.  
> Open the extension, it auto-loads the current page, and you can ask questions about its content instantly.

---

## 🏗️ Project Structure

```
Website Qand A/
├── backend/                    ← Python FastAPI (deployed to Render)
│   ├── main.py                 ← API server (routes)
│   ├── rag_service.py          ← RAG pipeline (scrape → embed → answer)
│   ├── requirements.txt
│   ├── Procfile                ← Render start command
│   └── .env.example
│
└── chrome-extension/           ← Chrome Extension (loaded in browser)
    ├── manifest.json
    ├── background.js
    ├── sidepanel.html
    ├── sidepanel.js
    ├── style.css
    └── icons/
        └── icon128.png
```

---

## 🚀 Step 1 — Deploy the Backend to Render

### 1. Push `backend/` to GitHub

Create a **new GitHub repository** (e.g., `webchat-ai-backend`) and push only the `backend/` folder contents to it:

```bash
cd "Website Qand A/backend"
git init
git add .
git commit -m "Initial backend"
git remote add origin https://github.com/YOUR_USERNAME/webchat-ai-backend.git
git push -u origin main
```

### 2. Create a Web Service on Render

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo (`webchat-ai-backend`)
3. Configure:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Runtime:** Python 3.11+
4. Add **Environment Variable:**
   - Key: `GOOGLE_API_KEY`
   - Value: your Gemini API key
5. Click **Deploy** → Wait ~2 minutes

### 3. Copy Your Render URL

After deployment, you'll get a URL like:
```
https://webchat-ai-backend.onrender.com
```

> ⚠️ **Free tier note:** Render free services sleep after 15 minutes of inactivity. The first request after sleeping takes ~30 seconds to wake up. This is normal!

---

## 🔧 Step 2 — Update the Extension Config

Open `chrome-extension/sidepanel.js` and replace line 8:

```javascript
// BEFORE
const BACKEND_URL = 'https://YOUR-APP-NAME.onrender.com';

// AFTER (use your actual Render URL)
const BACKEND_URL = 'https://webchat-ai-backend.onrender.com';
```

---

## 🧩 Step 3 — Install the Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Toggle **Developer mode** ON (top-right corner)
3. Click **"Load unpacked"**
4. Select the `chrome-extension/` folder from this project
5. ✅ The **WebChat AI** icon appears in your Chrome toolbar!

---

## 💡 How to Use

1. Navigate to **any webpage** (e.g., a product page, docs, blog)
2. Click the **WebChat AI** icon in Chrome → Side panel opens
3. The current page URL is **auto-filled**
4. Click **"Load & Analyze Page"** → Wait for AI to process
5. Ask questions! The AI answers based on the page content

---

## 🌐 Publishing to Chrome Web Store (Optional)

> 💰 **One-time cost: $5** developer registration fee

If you decide to publish:

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay the $5 one-time registration fee
3. Zip the `chrome-extension/` folder
4. Click **"New Item"** → upload the ZIP
5. Fill in description, screenshots, and submit for review
6. Google reviews in **1–3 business days** → Goes live!

For **personal use only**, you don't need to publish — just "Load unpacked" in Developer Mode.

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/load-urls` | Scrape URLs & build vector DB |
| POST | `/chat` | Ask a question, get AI answer |
| DELETE | `/session/{id}` | Clear session memory |
| GET | `/health` | Check active sessions |

---

## 🛠️ Local Development

To run the backend locally (without Render):

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY
uvicorn main:app --reload --port 8000
```

Then in `sidepanel.js`, set:
```javascript
const BACKEND_URL = 'http://localhost:8000';
```

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension UI | HTML + CSS + Vanilla JS (Manifest V3) |
| Backend API | Python FastAPI + Uvicorn |
| RAG Pipeline | LangChain + Google Gemini Embeddings |
| Vector Store | LangChain InMemoryVectorStore |
| LLM | Gemini 2.5 Flash |
| Hosting | Render.com |
