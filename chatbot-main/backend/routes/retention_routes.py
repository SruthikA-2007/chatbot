"""
StudySync AI - Retention Booster API Route (retention_routes.py)

Generates an adaptive, evidence-based spaced repetition retention plan based on:
- What they studied (topic/content)
- Topic difficulty (Easy, Medium, Hard, Very Hard)
- When they studied it (date / timestamp)
- Optional confidence level & notes

Outputs:
- Active recall questions (with self-test answers/hints)
- Revision calendar dates (calculated from the study date)
- Adaptive Spaced Repetition Schedule (custom intervals based on cognitive decay)
- Practice testing ideas
- Weak area review & high-yield pitfalls
- Structured timeline (Day 1: Learn, Day 2: Quick Recall, Day 4: Revision, etc.)
"""

import sys
import re
import json
import logging
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from pathlib import Path

current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from services.gemini_service import gemini_service
except ImportError:
    from gemini_service import gemini_service

logger = logging.getLogger("StudySyncAI.RetentionRoutes")

retention_bp = Blueprint("retention_bp", __name__)


# ==============================================================================
# Adaptive Spacing Logic
# ==============================================================================
ADAPTIVE_INTERVAL_TEMPLATES = {
    "easy": [
        {"day": 1, "label": "Learn", "action": "Deep conceptual study and key definitions summary", "technique": "Initial Encoding"},
        {"day": 3, "label": "Quick Recall", "action": "5-minute closed-book quiz on core terms and facts", "technique": "Active Retrieval"},
        {"day": 7, "label": "Practice", "action": "Solve 3-5 application problems or explain key concepts aloud", "technique": "Deliberate Practice"},
        {"day": 16, "label": "Revision", "action": "Review summary flashcards & resolve minor edge questions", "technique": "Spaced Consolidation"},
        {"day": 35, "label": "Long-Term Review", "action": "Comprehensive cumulative self-test to lock into permanent memory", "technique": "Permastore Retrieval"}
    ],
    "medium": [
        {"day": 1, "label": "Learn", "action": "Core concepts, structured notes & initial worked examples", "technique": "Encoding & Dual Coding"},
        {"day": 2, "label": "Quick Recall", "action": "Active retrieval without looking at notes; brain-dump key points", "technique": "Rapid Retrieval"},
        {"day": 4, "label": "Revision", "action": "Targeted review of forgotten details & flashcard testing", "technique": "Interleaved Review"},
        {"day": 7, "label": "Practice", "action": "Timed practice questions & solve challenging variations", "technique": "Deliberate Application"},
        {"day": 14, "label": "Review", "action": "Weak area reinforcement & concept mapping synthesis", "technique": "Conceptual Integration"},
        {"day": 28, "label": "Consolidation", "action": "Full simulated exam questions and long-term mastery check", "technique": "Permanent Consolidation"}
    ],
    "hard": [
        {"day": 1, "label": "Learn", "action": "Deep foundational breakdown & step-by-step problem walkthroughs", "technique": "Deep Scaffolded Learning"},
        {"day": 2, "label": "Quick Recall", "action": "Active recall test on state formulas, core laws & definitions", "technique": "Early Curve Halt"},
        {"day": 4, "label": "Revision", "action": "Redo failed problems from scratch without checking hints", "technique": "Error Analysis"},
        {"day": 6, "label": "Targeted Practice", "action": "Mix medium and hard problem variations under light time pressure", "technique": "Interleaved Problem Sets"},
        {"day": 10, "label": "Practice Test", "action": "Closed-book mock exam set simulating test conditions", "technique": "High-Fidelity Testing"},
        {"day": 18, "label": "Mastery Blitz", "action": "Teach the hardest concept to someone else (Feynman Technique) & patch weak spots", "technique": "Feynman Mastery"}
    ],
    "very hard": [
        {"day": 1, "label": "Learn", "action": "Intensive conceptual deconstruction, prerequisite review & diagramming", "technique": "Cognitive Chunking"},
        {"day": 2, "label": "Quick Recall", "action": "Formula & mechanism retrieval; identify immediate memory gaps", "technique": "High-Frequency Retrieval"},
        {"day": 3, "label": "Feynman Review", "action": "Simplify and explain the core mechanism in simple plain language", "technique": "Feynman Method"},
        {"day": 5, "label": "Revision", "action": "Re-derive proofs/equations or rebuild solutions from blank slate", "technique": "Blank-Slate Reconstruction"},
        {"day": 8, "label": "Practice Testing", "action": "Hardest level exam questions under strict time constraints", "technique": "Stress Testing"},
        {"day": 13, "label": "Consolidation", "action": "Error log synthesis: catalog every past mistake and create anti-traps", "technique": "Error-Driven Mastery"},
        {"day": 21, "label": "Mastery Check", "action": "Cumulative mastery challenge and speed test", "technique": "Overlearning & Peak Fluency"}
    ]
}


def compute_adaptive_retention_schedule(topic: str, difficulty: str, studied_date_str: str, confidence: str = "medium") -> dict:
    """
    Computes dynamic spaced repetition schedule based on difficulty, study date,
    and elapsed time.
    """
    diff_key = str(difficulty).lower().strip()
    if diff_key not in ADAPTIVE_INTERVAL_TEMPLATES:
        if "very" in diff_key or "extreme" in diff_key:
            diff_key = "very hard"
        elif "hard" in diff_key:
            diff_key = "hard"
        elif "easy" in diff_key:
            diff_key = "easy"
        else:
            diff_key = "medium"

    template = ADAPTIVE_INTERVAL_TEMPLATES[diff_key]

    # Parse studied_date
    study_dt = None
    try:
        if studied_date_str:
            clean_date = studied_date_str.split("T")[0].strip()
            study_dt = datetime.strptime(clean_date, "%Y-%m-%d").date()
    except Exception:
        pass

    if not study_dt:
        study_dt = date.today()

    today = date.today()
    days_elapsed = (today - study_dt).days

    schedule = []
    simple_timeline = []
    revision_dates = []

    for item in template:
        day_offset = item["day"]
        milestone_date = study_dt + timedelta(days=day_offset - 1)
        iso_date = milestone_date.strftime("%Y-%m-%d")
        formatted_date = milestone_date.strftime("%a, %b %d, %Y")
        
        # Simple timeline format: "Day X: Label"
        simple_label = f"Day {day_offset}: {item['label']}"
        simple_timeline.append(simple_label)

        # Determine relative status
        days_from_today = (milestone_date - today).days
        if days_from_today < 0:
            status = "completed"
            relative_str = f"{abs(days_from_today)}d ago"
        elif days_from_today == 0:
            status = "due_today"
            relative_str = "Due Today"
        elif days_from_today == 1:
            status = "upcoming"
            relative_str = "Tomorrow"
        else:
            status = "upcoming"
            relative_str = f"In {days_from_today} days"

        schedule_item = {
            "day": day_offset,
            "label": item["label"],
            "date": iso_date,
            "date_formatted": formatted_date,
            "relative": relative_str,
            "action": item["action"],
            "technique": item["technique"],
            "status": status,
            "days_from_today": days_from_today
        }
        schedule.append(schedule_item)

        # Collect revision dates (skip day 1 if it's the initial learn session)
        if day_offset > 1:
            revision_dates.append({
                "stage": item["label"],
                "day": day_offset,
                "date": iso_date,
                "date_formatted": formatted_date,
                "relative": relative_str,
                "status": status
            })

    # Find the nearest active milestone
    current_milestone = None
    for item in schedule:
        if item["status"] == "due_today":
            current_milestone = item
            break
    if not current_milestone:
        upcoming_items = [i for i in schedule if i["status"] == "upcoming"]
        if upcoming_items:
            current_milestone = upcoming_items[0]
        elif schedule:
            current_milestone = schedule[-1]

    return {
        "difficulty": diff_key.capitalize(),
        "studied_date": study_dt.strftime("%Y-%m-%d"),
        "studied_date_formatted": study_dt.strftime("%A, %B %d, %Y"),
        "days_elapsed": max(0, days_elapsed),
        "timeline_simple": simple_timeline,
        "schedule": schedule,
        "revision_dates": revision_dates,
        "current_milestone": current_milestone
    }


# ==============================================================================
# AI Prompt Builder for Retention Booster
# ==============================================================================
def _build_retention_prompt(topic: str, difficulty: str, studied_date_str: str, schedule_meta: dict, notes: str = "") -> str:
    simple_tl_str = "\n".join([f"- {t}" for t in schedule_meta["timeline_simple"]])
    schedule_table_rows = []
    for s in schedule_meta["schedule"]:
        schedule_table_rows.append(f"| Day {s['day']} ({s['date_formatted']}) | {s['label']} | {s['action']} | {s['status'].replace('_', ' ').title()} |")
    schedule_table = "\n".join(schedule_table_rows)

    return f"""You are StudySync AI, an elite educational psychologist and cognitive learning scientist specializing in retention optimization, spaced retrieval practice, and overcoming the Ebbinghaus forgetting curve.

STUDENT'S STUDY LOG:
- Topic Studied: "{topic}"
- Topic Difficulty: {difficulty}
- Studied On: {schedule_meta['studied_date_formatted']} ({schedule_meta['days_elapsed']} days ago)
- Student Notes / Context: {notes if notes else "No additional notes provided"}

CALCULATED ADAPTIVE SCHEDULE:
The spaced repetition curve has been dynamically computed for this {difficulty} topic:
{simple_tl_str}

YOUR TASK:
Generate a high-yield, comprehensive Retention Booster package customized specifically to "{topic}".
Respond in JSON format using the exact JSON schema provided below.

JSON SCHEMA REQUIREMENT:
{{
  "active_recall_questions": [
    {{
      "id": 1,
      "question": "A probing, non-trivial active recall question that tests deep understanding rather than superficial memorization",
      "answer_hint": "A crisp, authoritative answer and conceptual explanation that the student can reveal to grade themselves",
      "concept": "Sub-concept or mechanism name",
      "difficulty": "Easy | Medium | Hard"
    }},
    {{
      "id": 2,
      "question": "...",
      "answer_hint": "...",
      "concept": "...",
      "difficulty": "..."
    }},
    {{
      "id": 3,
      "question": "...",
      "answer_hint": "...",
      "concept": "...",
      "difficulty": "..."
    }},
    {{
      "id": 4,
      "question": "...",
      "answer_hint": "...",
      "concept": "...",
      "difficulty": "..."
    }},
    {{
      "id": 5,
      "question": "...",
      "answer_hint": "...",
      "concept": "...",
      "difficulty": "..."
    }}
  ],
  "practice_testing_ideas": [
    {{
      "title": "Strategy Title (e.g. Blank-Page Brain Dump)",
      "technique": "Name of cognitive technique",
      "description": "Concrete step-by-step instructions on how the student can test themselves on '{topic}' without passively re-reading."
    }},
    {{
      "title": "Strategy Title (e.g. Feynman Peer Teaching)",
      "technique": "Name of cognitive technique",
      "description": "..."
    }},
    {{
      "title": "Strategy Title (e.g. Interleaved Problem Challenge)",
      "technique": "Name of cognitive technique",
      "description": "..."
    }}
  ],
  "weak_area_review": {{
    "summary": "Concise summary of the cognitive hurdles and common misconceptions in '{topic}'.",
    "pitfalls": [
      "Common pitfall 1 students stumble on",
      "Common pitfall 2 / tricky edge case",
      "Common pitfall 3 / high-yield trap"
    ],
    "review_checklist": [
      "Actionable self-audit item 1",
      "Actionable self-audit item 2",
      "Actionable self-audit item 3"
    ]
  }},
  "strategy_summary": "A 2-3 sentence motivating explanation of why this adaptive spacing curve protects their retention for {topic}."
}}

RULES:
1. Active recall questions must be realistic and scientifically targeted to "{topic}". Include at least 4 questions (up to 6).
2. Practice testing ideas must be practical and engaging, avoiding generic filler.
3. Weak area review must pinpoint real common traps and misconceptions for "{topic}".
4. Output strictly valid JSON. Do not wrap in markdown code blocks or extra text if possible, or use standard ```json.
"""


# ==============================================================================
# Algorithmic Retention Booster Fallback (High Quality Offline Generator)
# ==============================================================================
def _generate_retention_fallback(topic: str, difficulty: str, schedule_meta: dict, notes: str = "") -> dict:
    """
    Generates domain-adapted fallback active recall questions, testing ideas,
    and weak area review when Gemini API is offline.
    """
    diff_str = schedule_meta["difficulty"]
    diff_lower = diff_str.lower()
    days_elapsed = schedule_meta["days_elapsed"]

    # Topic name sanitation
    clean_topic = topic.strip() or "Core Subject Concepts"

    # Contextual active recall questions tailored to topic
    questions = [
        {
            "id": 1,
            "question": f"What is the fundamental definition and primary purpose of {clean_topic}?",
            "answer_hint": f"The core foundation of {clean_topic} centers on its primary axioms, mechanisms, and the specific problems it is designed to solve in its domain.",
            "concept": "Foundational Principles",
            "difficulty": "Easy" if "easy" in diff_lower else "Medium"
        },
        {
            "id": 2,
            "question": f"What are the 3 most critical components, steps, or properties that govern {clean_topic}?",
            "answer_hint": f"Key pillars: 1) Underlying state/structure, 2) The operational rules or formulas governing transitions, and 3) The terminal conditions or constraints.",
            "concept": "Core Architecture",
            "difficulty": "Medium"
        },
        {
            "id": 3,
            "question": f"How does {clean_topic} behave under boundary, extreme, or edge-case conditions?",
            "answer_hint": f"Boundary behaviors usually reveal hidden assumptions: observe what occurs when inputs are null/zero, infinite, or at opposing extremes.",
            "concept": "Edge Cases & Boundaries",
            "difficulty": "Hard"
        },
        {
            "id": 4,
            "question": f"If an error or breakdown occurs when working with {clean_topic}, what is the first diagnostic step you would take?",
            "answer_hint": f"Trace the dependency pipeline step-by-step from inputs to outputs, checking state validity and validating assumptions at each step.",
            "concept": "Error Diagnosis & Debugging",
            "difficulty": "Hard" if "hard" in diff_lower else "Medium"
        },
        {
            "id": 5,
            "question": f"Compare and contrast {clean_topic} with an alternative or opposing methodology in this field.",
            "answer_hint": f"Contrast the trade-offs: consider time vs. space complexity, cognitive overhead, implementation effort, and scalability under varying constraints.",
            "concept": "Comparative Analysis & Trade-offs",
            "difficulty": "Very Hard" if "very hard" in diff_lower else "Hard"
        }
    ]

    # Practice testing ideas
    practice_ideas = [
        {
            "title": "Blank-Page Brain Dump (Spaced Retrieval)",
            "technique": "Free Recall",
            "description": f"Close all textbooks and notes. Set a 7-minute timer and write down everything you remember about {clean_topic}: definitions, diagrams, formulas, and connections. Compare with your notes afterwards to highlight blind spots."
        },
        {
            "title": "The Feynman 10-Year-Old Explanation",
            "technique": "Feynman Technique",
            "description": f"Explain the central thesis of {clean_topic} using only simple analogies and no technical jargon. Whenever you feel compelled to use complicated terms, simplify until a 10-year-old would understand."
        },
        {
            "title": "Reverse-Engineered Problem Construction",
            "technique": "Problem Generation",
            "description": f"Draft 2 difficult test questions about {clean_topic} that would stump a classmate. Formulate complete step-by-step answer keys and explain why wrong answers would be chosen."
        },
        {
            "title": "Flash-Card Rapid Fire Drill",
            "technique": "Leitner Repetition",
            "description": f"Quiz yourself on the active recall questions above. Separate answers you got right immediately from those that required hesitation, scheduling the latter for re-testing within 24 hours."
        }
    ]

    # Weak area review
    weak_area_review = {
        "summary": f"Retention analysis reveals that {clean_topic} ({diff_str}) typically suffers cognitive decay primarily in structural nuance, edge cases, and transition logic.",
        "pitfalls": [
            f"Passive familiarity bias: confusing the ability to recognize {clean_topic} when reading with the ability to reconstruct it from memory.",
            "Neglecting boundary conditions, edge cases, or exception handling under examination pressure.",
            "Superficial formula memorization without understanding the underlying conceptual derivation."
        ],
        "review_checklist": [
            f"Can you draw or diagram the entire framework of {clean_topic} from scratch without assistance?",
            "Can you identify when this concept is applicable versus when an alternative approach is superior?",
            "Have you successfully solved at least 3 unseen problems without looking at hints or solution manuals?"
        ]
    }

    strategy_summary = (
        f"Based on your {diff_str} rating and {days_elapsed} elapsed days since study, "
        f"this adaptive schedule optimizes retrieval intervals so each revision occurs right at the "
        f"optimal threshold before memory decays below actionable recall."
    )

    return {
        "active_recall_questions": questions,
        "practice_testing_ideas": practice_ideas,
        "weak_area_review": weak_area_review,
        "strategy_summary": strategy_summary
    }


# ==============================================================================
# Helper to Build Comprehensive Markdown Output
# ==============================================================================
def _build_markdown_summary(topic: str, difficulty: str, schedule_meta: dict, ai_data: dict) -> str:
    """Formats the retention booster package into a beautiful, readable Markdown summary."""
    timeline_simple_lines = "\n".join([f"- **{t}**" for t in schedule_meta["timeline_simple"]])

    # Schedule table
    rows = []
    for s in schedule_meta["schedule"]:
        status_badge = "✅ Done" if s["status"] == "completed" else ("🔥 **DUE TODAY**" if s["status"] == "due_today" else f"⏳ {s['relative']}")
        rows.append(f"| Day {s['day']} | **{s['label']}** | `{s['date']}` | {s['action']} | {status_badge} |")
    table_str = "\n".join(rows)

    # Active recall questions
    q_lines = []
    for q in ai_data.get("active_recall_questions", []):
        q_lines.append(
            f"**Q{q['id']} ({q.get('difficulty', 'Medium')} - {q.get('concept', 'Core')}):** {q['question']}\n"
            f"> 💡 *Hint / Self-Check:* {q['answer_hint']}\n"
        )
    questions_str = "\n".join(q_lines)

    # Practice ideas
    idea_lines = []
    for idea in ai_data.get("practice_testing_ideas", []):
        idea_lines.append(f"- **{idea['title']}** (*{idea['technique']}*): {idea['description']}")
    ideas_str = "\n".join(idea_lines)

    # Weak areas
    war = ai_data.get("weak_area_review", {})
    pitfalls = "\n".join([f"- ⚠️ {p}" for p in war.get("pitfalls", [])])
    checklist = "\n".join([f"- [ ] {c}" for c in war.get("review_checklist", [])])

    return f"""### 🚀 Retention Booster: {topic}
**Difficulty:** {difficulty} | **Studied On:** {schedule_meta['studied_date_formatted']} ({schedule_meta['days_elapsed']} days ago)

{ai_data.get('strategy_summary', '')}

---

#### 📅 Adaptive Spaced Repetition Timeline
{timeline_simple_lines}

---

#### 🗓️ Revision Dates & Action Plan
| Milestone | Phase | Calendar Date | Recommended Action | Status |
|---|---|---|---|---|
{table_str}

---

#### 🧠 Active Recall Self-Test Questions
{questions_str}

---

#### 🎯 Practice Testing Strategies
{ideas_str}

---

#### 🔍 Weak Area Review & Pitfall Defense
{war.get('summary', '')}

**Common Traps to Avoid:**
{pitfalls}

**Mastery Self-Audit Checklist:**
{checklist}
"""


# ==============================================================================
# API Endpoint
# ==============================================================================
@retention_bp.route("/retention/boost", methods=["POST"])
def boost_retention():
    """
    Retention Booster API Endpoint.

    Accepts JSON:
    {
        "topic": "Dynamic Programming & Memoization",
        "difficulty": "Hard",             // "Easy", "Medium", "Hard", "Very Hard"
        "studied_date": "2026-09-05",      // Date string or ISO format
        "confidence": "Medium",           // Optional: "Low", "Medium", "High"
        "notes": "Struggled with state recurrence formulas" // Optional
    }

    Returns JSON containing:
    - Adaptive timeline (simple format and calendar breakdown)
    - Active recall questions
    - Revision dates
    - Practice testing ideas
    - Weak area review
    - Markdown formatted text
    """
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({"error": "Invalid JSON payload.", "status": "error"}), 400

        topic = str(data.get("topic", "")).strip()
        difficulty = str(data.get("difficulty", "Medium")).strip()
        studied_date_raw = str(data.get("studied_date", "")).strip()
        confidence = str(data.get("confidence", "Medium")).strip()
        notes = str(data.get("notes", "")).strip()

        if not topic:
            return jsonify({"error": "Please provide what you studied ('topic').", "status": "error"}), 400

        # Validate difficulty
        valid_difficulties = ["easy", "medium", "hard", "very hard"]
        if difficulty.lower() not in valid_difficulties:
            # Map friendly variations
            if "very" in difficulty.lower() or "extreme" in difficulty.lower():
                difficulty = "Very Hard"
            elif "hard" in difficulty.lower():
                difficulty = "Hard"
            elif "easy" in difficulty.lower():
                difficulty = "Easy"
            else:
                difficulty = "Medium"
        else:
            difficulty = difficulty.title()

        # Compute adaptive schedule and timeline
        schedule_meta = compute_adaptive_retention_schedule(
            topic=topic,
            difficulty=difficulty,
            studied_date_str=studied_date_raw,
            confidence=confidence
        )

        # Call Gemini or generate algorithmic fallback
        engine = "algorithmic_fallback"
        ai_data = None

        if gemini_service.client:
            prompt = _build_retention_prompt(topic, difficulty, studied_date_raw, schedule_meta, notes)
            try:
                raw_response = gemini_service._call_gemini_api(prompt, [])
                if raw_response:
                    # Clean markdown fence if present
                    clean_json = raw_response.strip()
                    if "```json" in clean_json:
                        clean_json = clean_json.split("```json")[1].split("```")[0].strip()
                    elif "```" in clean_json:
                        clean_json = clean_json.split("```")[1].split("```")[0].strip()
                    
                    try:
                        ai_data = json.loads(clean_json)
                        engine = "gemini"
                    except json.JSONDecodeError:
                        logger.warning("Gemini did not return pure JSON. Falling back to algorithmic generator.")
            except Exception as api_err:
                logger.warning(f"Gemini API call failed in Retention Booster: {api_err}. Using fallback.")

        if not ai_data or not isinstance(ai_data, dict) or "active_recall_questions" not in ai_data:
            ai_data = _generate_retention_fallback(topic, difficulty, schedule_meta, notes)
            engine = "algorithmic_fallback"

        # Generate markdown summary
        markdown_summary = _build_markdown_summary(topic, difficulty, schedule_meta, ai_data)

        response_payload = {
            "status": "success",
            "topic": topic,
            "difficulty": schedule_meta["difficulty"],
            "studied_date": schedule_meta["studied_date"],
            "studied_date_formatted": schedule_meta["studied_date_formatted"],
            "days_elapsed": schedule_meta["days_elapsed"],
            "confidence": confidence,
            "timeline_simple": schedule_meta["timeline_simple"],
            "schedule": schedule_meta["schedule"],
            "revision_dates": schedule_meta["revision_dates"],
            "current_milestone": schedule_meta["current_milestone"],
            "active_recall_questions": ai_data.get("active_recall_questions", []),
            "practice_testing_ideas": ai_data.get("practice_testing_ideas", []),
            "weak_area_review": ai_data.get("weak_area_review", {}),
            "strategy_summary": ai_data.get("strategy_summary", ""),
            "markdown_summary": markdown_summary,
            "engine": engine
        }

        return jsonify(response_payload), 200

    except Exception as e:
        logger.error(f"Retention Booster endpoint error: {e}", exc_info=True)
        return jsonify({"error": "Failed to generate retention booster schedule.", "status": "error"}), 500
