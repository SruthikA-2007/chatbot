import sys
from pathlib import Path
from flask import Blueprint, request, jsonify

# Add backend directory to sys.path
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from services.gemini_service import gemini_service
    from services.conversation_service import conversation_service
except ImportError:
    from gemini_service import gemini_service
    from conversation_service import conversation_service

chat_bp = Blueprint("chat_bp", __name__)

@chat_bp.route("/chat", methods=["POST"])
def chat():
    """
    Main Chat API Endpoint.

    Request Format:
    {
        "message": "user message",
        "conversation_id": "unique conversation id"
    }

    Workflow:
    1. Receive the user's message.
    2. Check whether the conversation_id already exists.
    3. If it does not exist, create a new temporary conversation.
    4. Store the user's message in conversation memory.
    5. Retrieve previous conversation history.
    6. Send the conversation history and latest message to Gemini.
    7. Receive the AI response.
    8. Store the AI response in temporary conversation memory.
    9. Return the response to the frontend.

    Response Format:
    {
        "response": "AI generated response",
        "conversation_id": "conversation id"
    }
    """
    try:
        data = request.get_json(force=True, silent=True)

        if not data:
            return jsonify({
                "error": "Invalid request payload. Valid JSON required.",
                "response": "Please provide a valid JSON payload containing 'message' and 'conversation_id'.",
                "conversation_id": ""
            }), 400

        # Step 1: Receive the user's message and conversation_id
        user_message = str(data.get("message", "")).strip()
        conversation_id = str(data.get("conversation_id", "")).strip()

        if not user_message:
            return jsonify({
                "error": "The 'message' field cannot be empty.",
                "response": "Please enter a question or study prompt to continue.",
                "conversation_id": conversation_id
            }), 400

        # Step 2 & 3: Check whether conversation_id already exists; if not, create a new temporary conversation
        if not conversation_id or not conversation_service.exists(conversation_id):
            if not conversation_id:
                conversation_id = conversation_service.create_conversation_id()
            conversation_service.ensure_session(conversation_id)

        # Step 5: Retrieve previous conversation history (before adding the current user message)
        previous_history = conversation_service.get_recent_messages(conversation_id, limit=10)

        # Step 4: Store the user's message in temporary conversation memory
        conversation_service.add_message(conversation_id, "user", user_message)

        # Step 6 & 7: Send the conversation history and latest message to Gemini & receive AI response
        result = gemini_service.generate_chat_response(user_message, conversation_id)
        ai_response = result.get("response", "")

        # Step 8: Store the AI response in temporary conversation memory (handled in generate_chat_response or ensuring record)
        # Verify AI response recorded in temporary memory
        history = conversation_service.get_history(conversation_id)
        if not history or history[-1]["role"] != "assistant":
            conversation_service.add_message(conversation_id, "assistant", ai_response)

        # Step 9: Return response to the frontend
        return jsonify({
            "response": ai_response,
            "conversation_id": conversation_id,
            "sources": result.get("sources", []),
            "verification_status": result.get("verification_status", ""),
            "claim_verdict": result.get("claim_verdict", "")
        }), 200


    except Exception as e:
        print(f"❌ Error in /api/chat endpoint: {str(e)}")
        return jsonify({
            "error": "Internal server error while processing chat.",
            "response": "Sorry, an unexpected server error occurred. Please try again.",
            "conversation_id": conversation_id if 'conversation_id' in locals() and conversation_id else ""
        }), 500


@chat_bp.route("/history/<conversation_id>", methods=["GET"])
def get_history(conversation_id):
    """Retrieve message history for a specific conversation session."""
    try:
        history = conversation_service.get_history(conversation_id)
        return jsonify({
            "conversation_id": conversation_id,
            "messages": history
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@chat_bp.route("/clear", methods=["POST"])
def clear_chat():
    """Clear temporary memory for a conversation session."""
    try:
        data = request.get_json(force=True, silent=True) or {}
        conversation_id = data.get("conversation_id", "")
        if conversation_id:
            conversation_service.clear_conversation(conversation_id)
        return jsonify({"message": "Conversation history cleared successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

