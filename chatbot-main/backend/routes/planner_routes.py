"""
StudySync AI - Study Planner API Route (planner_routes.py)

Generates a personalized, AI-driven study schedule based on:
- Number of available study hours
- Subjects to study
- Difficulty level per subject (Easy, Medium, Hard)
- Exam date & preparation period countdown
- Preferred study time (Morning, Afternoon, Evening, Night)

Intelligently partitions sessions into:
- Focus Sessions (~65-75% of total time, weighted by difficulty)
- Short Breaks (~10-15% of total time, restorative resets)
- Review Time (~15-20% of total time, active recall & spaced review)

Zero hardcoded schedules — adapts completely to student inputs.
"""

import sys
import re
import logging
from datetime import datetime, date
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

logger = logging.getLogger("StudySyncAI.PlannerRoutes")

planner_bp = Blueprint("planner_bp", __name__)


# ==============================================================================
# Helper: Session Breakdown Calculator
# ==============================================================================
def compute_session_breakdown(hours: float, num_subjects: int = 1) -> dict:
    """
    Intelligently partitions study session into Focus, Breaks, and Review.
    For example, a 3-hour session (180 mins) is divided into:
    - Focus sessions: ~128 min (~71%)
    - Short breaks: 20 min (~11%)
    - Review time: 32 min (~18%)
    """
    total_mins = max(30, int(hours * 60))

    # Review time: 15-20% dedicated to active recall consolidation
    review_mins = max(15, min(45, int(total_mins * 0.18)))

    # Short breaks: ~10% (5-10 min after focus windows)
    if total_mins <= 60:
        break_mins = 5
    elif total_mins <= 120:
        break_mins = 10
    elif total_mins <= 240:
        break_mins = 20
    else:
        break_mins = 30

    focus_mins = max(20, total_mins - break_mins - review_mins)

    return {
        "total_minutes": total_mins,
        "focus_minutes": focus_mins,
        "break_minutes": break_mins,
        "review_minutes": review_mins,
        "focus_pct": round((focus_mins / total_mins) * 100),
        "break_pct": round((break_mins / total_mins) * 100),
        "review_pct": round((review_mins / total_mins) * 100)
    }


# ==============================================================================
# Study Planner AI Prompt Builder
# ==============================================================================
def _build_planner_prompt(data: dict) -> str:
    study_hours    = str(data.get("study_hours", "3")).strip()
    subjects       = data.get("subjects", [])
    difficulties   = data.get("difficulties", {})
    prep_days      = str(data.get("prep_days", "7")).strip()
    exam_date      = str(data.get("exam_date", "")).strip()
    preferred_time = str(data.get("preferred_time", "morning")).lower().strip()
    goals          = str(data.get("goals", "")).strip()

    subject_lines = []
    for subj in subjects:
        diff = difficulties.get(subj, "medium")
        subject_lines.append(f"  - {subj} (Difficulty: {diff.upper()})")
    subjects_text = "\n".join(subject_lines) if subject_lines else "  - General Study"

    exam_context = f"Exam Date: {exam_date} ({prep_days} days remaining)" if exam_date else f"Preparation Period: {prep_days} days"
    goals_text = f"\nStudent Goals: {goals}" if goals else ""

    start_times = {
        "morning": "08:00 AM",
        "afternoon": "01:00 PM",
        "evening": "06:00 PM",
        "night": "08:00 PM"
    }
    start_time_str = start_times.get(preferred_time, "08:00 AM")

    try:
        hours_val = float(study_hours)
    except ValueError:
        hours_val = 3.0

    breakdown = compute_session_breakdown(hours_val, len(subjects))

    return f"""You are StudySync AI, an expert educational cognitive learning specialist.
Generate an evidence-based, personalized study schedule strictly adapted to this student's inputs.

STUDENT PROFILE:
- Daily Study Time: {study_hours} hours ({breakdown['total_minutes']} total minutes)
- {exam_context}
- Preferred Study Window: {preferred_time.capitalize()} (Start time: {start_time_str})
- Target Subjects & Difficulty Ratings:
{subjects_text}{goals_text}

MANDATORY COGNITIVE PARTITIONING RULES:
For this {study_hours}-hour session, you must intelligently divide the total {breakdown['total_minutes']} minutes into:
1. FOCUS SESSIONS (~{breakdown['focus_minutes']} minutes total):
   - Allocate MORE time to higher-difficulty subjects (Hard > Medium > Easy).
   - Chunk focus sessions into 45-60 minute intervals to prevent cognitive fatigue.
   - Begin with the highest-difficulty subject while mental energy is peak.
2. SHORT BREAKS (~{breakdown['break_minutes']} minutes total):
   - Insert 5-10 minute restorative breaks immediately following focus blocks.
   - Recommend optic flow (looking 20 feet away) and hydration.
3. REVIEW TIME (~{breakdown['review_minutes']} minutes at end of session):
   - Dedicated active recall, flashcard quizzing, and self-testing across all subjects studied.
   - Halt the Ebbinghaus forgetting curve before session concludes.

ADAPTIVE EXAM STRATEGY:
- If exam is <= 7 days away: prioritize high-yield problem solving, mock questions, and error analysis.
- If exam is > 7 days away: balance foundational conceptual understanding with interleaved practice.

FORMAT YOUR RESPONSE EXACTLY IN THIS STRUCTURE:

### 📚 Personalized Study Schedule

**Study Strategy Overview:**
[2-3 sentences explaining the strategy tailored to their subjects, difficulties, and exam timeline]

**Session Time Allocation:**
- 🎯 **Focus Sessions:** ~{breakdown['focus_minutes']} min ({breakdown['focus_pct']}%)
- ☕ **Short Breaks:** ~{breakdown['break_minutes']} min ({breakdown['break_pct']}%)
- 🧠 **Review & Active Recall:** ~{breakdown['review_minutes']} min ({breakdown['review_pct']}%)

---

#### ⏱️ Daily Schedule Breakdown ({start_time_str} Start)

| Time Block | Subject | Activity Type | Duration | Focus & Strategy |
|---|---|---|---|---|
| [Start - End] | [Subject (Difficulty)] | Focus Session | [X] min | [Specific high-yield study task] |
| [Start - End] | — | Short Break | [5-10] min | Brain reset: hydrate & eye rest |
| [Start - End] | [Next Subject] | Focus Session | [X] min | [Practice / problem solving] |
| [Start - End] | All Subjects | Review Time | [X] min | Active recall self-quizzing & consolidation |

---

### 🧠 Subject-Specific Study Techniques
[Provide 2-4 bullet points pairing each subject and difficulty with a science-backed technique like Feynman technique, spaced retrieval, or timed problem solving]

### 💡 Cognitive Wellness Reminders
- [Reminder on sleep and memory consolidation]
- [Reminder on hydration, nutrition, and avoiding cramming]
"""


# ==============================================================================
# Algorithmic Planner Fallback (Accurate offline generation)
# ==============================================================================
def _generate_planner_fallback(data: dict) -> str:
    try:
        study_hours = float(data.get("study_hours", 3))
    except (ValueError, TypeError):
        study_hours = 3.0

    subjects = data.get("subjects", ["General Study"])
    if not subjects:
        subjects = ["General Study"]

    difficulties = data.get("difficulties", {})
    prep_days = int(data.get("prep_days", 7))
    exam_date = data.get("exam_date", "")
    preferred = data.get("preferred_time", "morning").lower()

    breakdown = compute_session_breakdown(study_hours, len(subjects))
    total_mins = breakdown["total_minutes"]
    focus_mins = breakdown["focus_minutes"]
    break_mins = breakdown["break_minutes"]
    review_mins = breakdown["review_minutes"]

    diff_weight = {"hard": 3, "medium": 2, "easy": 1}
    sorted_subjects = sorted(
        subjects,
        key=lambda s: diff_weight.get(str(difficulties.get(s, "medium")).lower(), 2),
        reverse=True
    )

    # Subdivide focus time proportionally to difficulty
    total_weight = sum(diff_weight.get(str(difficulties.get(s, "medium")).lower(), 2) for s in sorted_subjects) or 1
    
    # If 1 subject and focus time is long (> 70 min), split into 2 focus sessions
    focus_blocks = []
    if len(sorted_subjects) == 1 and focus_mins > 70:
        s = sorted_subjects[0]
        diff = difficulties.get(s, "medium").capitalize()
        half_focus = focus_mins // 2
        focus_blocks.append((s, diff, half_focus, "Deep Concept Mastery & Notes"))
        focus_blocks.append((s, diff, focus_mins - half_focus, "Targeted Practice Problems & Application"))
    else:
        for s in sorted_subjects:
            w = diff_weight.get(str(difficulties.get(s, "medium")).lower(), 2)
            mins = max(20, int(focus_mins * (w / total_weight)))
            diff = difficulties.get(s, "medium").capitalize()
            act_type = "Deep Study & Problem Solving" if diff == "Hard" else "Concept Review & Active Notes"
            focus_blocks.append((s, diff, mins, act_type))

    # Adjust sum of focus blocks to exactly match focus_mins
    curr_focus_sum = sum(b[2] for b in focus_blocks)
    if curr_focus_sum != focus_mins and focus_blocks:
        diff_mins = focus_mins - curr_focus_sum
        s, d, m, a = focus_blocks[0]
        focus_blocks[0] = (s, d, max(15, m + diff_mins), a)

    # Preferred start time mapping
    start_hour_map = {"morning": 8, "afternoon": 13, "evening": 18, "night": 20}
    start_minute = start_hour_map.get(preferred, 8) * 60

    def fmt_time(mins_from_midnight):
        h = (mins_from_midnight // 60) % 24
        m = mins_from_midnight % 60
        suffix = "AM" if h < 12 else "PM"
        h12 = h if h <= 12 else h - 12
        if h12 == 0:
            h12 = 12
        return f"{h12}:{m:02d} {suffix}"

    cursor = start_minute
    rows = []

    # Number of breaks between focus blocks
    num_breaks = max(1, len(focus_blocks) - 1)
    single_break_dur = max(5, break_mins // num_breaks)

    for i, (subj, diff, dur, act_focus) in enumerate(focus_blocks):
        start_str = fmt_time(cursor)
        end_str = fmt_time(cursor + dur)
        rows.append(f"| {start_str} – {end_str} | **{subj}** ({diff}) | Focus Session | {dur} min | {act_focus} |")
        cursor += dur

        # Add short break between focus sessions
        if i < len(focus_blocks) - 1:
            b_start = fmt_time(cursor)
            b_end = fmt_time(cursor + single_break_dur)
            rows.append(f"| {b_start} – {b_end} | — | Short Break | {single_break_dur} min | Screen rest, hydration & light walk |")
            cursor += single_break_dur

    # Final Review & Active Recall block
    rev_start = fmt_time(cursor)
    rev_end = fmt_time(cursor + review_mins)
    rows.append(f"| {rev_start} – {rev_end} | **All Subjects** | Review Time | {review_mins} min | Spaced retrieval, self-quizzing & consolidation |")

    table = "\n".join(rows)

    # Subject-specific techniques
    techniques = []
    for s in sorted_subjects[:4]:
        d = str(difficulties.get(s, "medium")).lower()
        if d == "hard":
            techniques.append(f"- **{s} (High Difficulty):** Use spaced repetition flashcards + timed problem sets without consulting notes.")
        elif d == "medium":
            techniques.append(f"- **{s} (Medium Difficulty):** Apply the Feynman technique—explain each core mechanism aloud in plain words.")
        else:
            techniques.append(f"- **{s} (Easy / Foundational):** Rapid active recall quizzes and concept mind-mapping to reinforce key definitions.")

    exam_label = f"Exam on {exam_date} ({prep_days} days remaining)" if exam_date else f"{prep_days}-day preparation plan"

    return f"""### 📚 Personalized Study Schedule

**Study Strategy Overview:**
This personalized schedule is customized for your **{study_hours}-hour** study window with a **{preferred.capitalize()}** preference ({exam_label}). Sessions are structured according to cognitive load theory: peak mental energy is dedicated to higher-difficulty subjects, punctuated by restorative breaks, and locked in with a dedicated review block.

**Session Time Allocation:**
- 🎯 **Focus Sessions:** ~{focus_mins} min ({breakdown['focus_pct']}%)
- ☕ **Short Breaks:** ~{break_mins} min ({breakdown['break_pct']}%)
- 🧠 **Review & Active Recall:** ~{review_mins} min ({breakdown['review_pct']}%)

---

#### ⏱️ Daily Schedule Breakdown ({fmt_time(start_minute)} Start)

| Time Block | Subject | Activity Type | Duration | Focus & Strategy |
|---|---|---|---|---|
{table}

---

### 🧠 Subject-Specific Study Techniques
{chr(10).join(techniques)}
- **All Focus Windows:** Apply deliberate practice—focus on weak sub-topics rather than passive re-reading.

### 💡 Cognitive Wellness Reminders
- **Sleep & Consolidation:** Aim for 7–9 hours of sleep; long-term memory encoding occurs predominantly during slow-wave and REM sleep.
- **Optic Rest:** During short breaks, look at objects at least 20 feet away to release visual strain and reset your autonomic nervous system.
- **Hydration:** Drink at least 250ml of water per study session to maintain neurotransmitter efficiency.
"""


# ==============================================================================
# API Endpoint
# ==============================================================================
@planner_bp.route("/planner/generate", methods=["POST"])
def generate_study_plan():
    """
    Study Planner API Endpoint.

    Accepts:
    {
        "study_hours": 3,
        "subjects": ["Mathematics", "Physics"],
        "difficulties": {"Mathematics": "hard", "Physics": "medium"},
        "prep_days": 15,
        "exam_date": "2026-09-20",
        "preferred_time": "morning",
        "goals": "Score an A"
    }

    Returns JSON with generated schedule markdown, metrics breakdown, and status.
    """
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({"error": "Invalid JSON payload.", "status": "error"}), 400

        study_hours_raw = data.get("study_hours", "3")
        subjects = data.get("subjects", [])

        if not study_hours_raw:
            return jsonify({"error": "study_hours is required.", "status": "error"}), 400
        if not subjects or not isinstance(subjects, list):
            return jsonify({"error": "At least one subject is required.", "status": "error"}), 400

        try:
            h = float(study_hours_raw)
            if h <= 0 or h > 16:
                return jsonify({"error": "study_hours must be between 0.5 and 16.", "status": "error"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "study_hours must be a valid number.", "status": "error"}), 400

        clean_subjects = [str(s).strip() for s in subjects if str(s).strip()][:8]
        if not clean_subjects:
            return jsonify({"error": "Please provide valid subject names.", "status": "error"}), 400

        data["subjects"] = clean_subjects
        data["study_hours"] = h

        # Calculate session breakdown metrics
        breakdown = compute_session_breakdown(h, len(clean_subjects))

        # Build AI prompt for Gemini
        prompt = _build_planner_prompt(data)

        schedule_text = ""
        engine = "fallback"

        # Call Gemini API if client is available
        if gemini_service.client:
            try:
                schedule_text = gemini_service._call_gemini_api(prompt, [])
                if schedule_text:
                    engine = "gemini"
            except Exception as api_err:
                logger.warning(f"Planner Gemini API call failed: {api_err}. Using intelligent fallback.")

        if not schedule_text:
            schedule_text = _generate_planner_fallback(data)
            engine = "algorithmic_fallback"

        return jsonify({
            "schedule": schedule_text,
            "breakdown": breakdown,
            "subjects": clean_subjects,
            "study_hours": str(h),
            "prep_days": str(data.get("prep_days", "7")),
            "exam_date": str(data.get("exam_date", "")),
            "preferred_time": str(data.get("preferred_time", "morning")),
            "engine": engine,
            "status": "success"
        }), 200

    except Exception as e:
        logger.error(f"Planner endpoint error: {e}", exc_info=True)
        return jsonify({"error": "Failed to generate study plan.", "status": "error"}), 500
