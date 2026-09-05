# 🎓 StudySync AI — Intelligent Learning & Memory Assistant

StudySync AI is an educational chatbot and cognitive retention platform built to help students learn deeper, verify academic claims, and study smarter.

---

## 🏗️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Glassmorphic Theme), JavaScript (ES6 Modules)
- **Backend**: Python Flask, Flask-CORS, python-dotenv
- **AI Engine**: Google Gemini API (`google-genai` / `google-generativeai`)

---

## 📁 Project Structure

```text
chat_bot/
├── backend/
│   ├── app.py                      # Flask Application factory and server
│   ├── config.py                   # Environment settings & secrets loader
│   ├── requirements.txt            # Python dependencies
│   ├── .env                        # Local environment secrets
│   ├── .env.example                # Secrets template
│   ├── services/
│   │   ├── gemini_service.py       # Gemini API client & educational prompts
│   │   └── memory_service.py       # Multi-turn conversational memory
│   ├── routes/
│   │   ├── chat_routes.py          # /api/chat & /api/history endpoints
│   │   └── feature_routes.py       # /api/study-plan & /api/study-break endpoints
│   └── utils/
│       └── prompts.py              # System prompts for educational tasks
└── frontend/
    ├── index.html                  # Main UI layout
    ├── css/
    │   ├── style.css               # Design system tokens & layout
    │   ├── chat.css                # Message bubbles, citations, markdown
    │   ├── components.css          # Modals, timer widget, dashboard cards
    │   └── animations.css          # Typing bounce & transitions
    └── js/
        └── app.js                  # Frontend controller & API fetch client
```

---

## 🚀 Quickstart Guide

### 1. Install Backend Dependencies
Open PowerShell or your terminal in the project directory:

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Edit `backend/.env` and ensure your Gemini API Key is set:

```ini
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run the Flask Server
```bash
python app.py
```
The server will start on: `http://127.0.0.1:5000`

### 4. Launch Frontend
Open `frontend/index.html` in any browser, or visit `http://127.0.0.1:5000` directly while Flask is running.
