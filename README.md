---
title: QandA RAG System
emoji: 🤖
colorFrom: blue
colorTo: purple
sdk: streamlit
sdk_version: "1.45.1"
app_file: app.py
pinned: false
---

# Customer Support QnA Bot

A **Retrieval-Augmented Generation (RAG)** based Q&A chatbot powered by **Google Gemini** and **LangChain**.

## How to Use

1. Enter one or more website URLs (one per line)
2. Click outside the text area to process the URLs
3. Ask any question about the content on those websites
4. Get AI-powered answers based on the website content

## Setup (Local)

```bash
pip install -r requirements.txt
```

Create a `.env` file with your Google API key:
```
GOOGLE_API_KEY=your_key_here
```

Then run:
```bash
streamlit run app.py
```

## Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_API_KEY` | Your Google Gemini API key from [Google AI Studio](https://aistudio.google.com) |
