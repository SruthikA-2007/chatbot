"""
StudySync AI - Temporary Conversation Memory Service (conversation_service.py)

Handles temporary in-memory conversation history without using any external database.
All conversation history is stored in a Python dictionary during the Flask server session.
If the server restarts, the conversation history is cleared automatically.
"""

import uuid
from typing import Dict, List, Any


class ConversationService:
    """
    Manages temporary in-memory conversation history for StudySync AI.
    
    Structure of conversation_memory:
    conversation_memory = {
        "conversation_id_1": [
            {"role": "user", "content": "message"},
            {"role": "assistant", "content": "response"}
        ]
    }
    """
    def __init__(self, max_messages_per_session: int = 20):
        # In-memory dictionary to store conversation sessions
        self.conversation_memory: Dict[str, List[Dict[str, str]]] = {}
        # Maximum history items to keep per session to avoid token overload
        self.max_messages = max_messages_per_session

    def create_conversation_id(self) -> str:
        """
        Generate a unique conversation_id when a new chat starts.
        Example output: 'conv_a1b2c3d4e5f6'
        """
        return f"conv_{uuid.uuid4().hex[:12]}"

    def exists(self, conversation_id: str) -> bool:
        """
        Check whether a conversation_id already exists in temporary memory.
        """
        return conversation_id in self.conversation_memory

    def ensure_session(self, conversation_id: str) -> None:
        """
        Ensure a conversation session entry exists in temporary memory.
        """
        if conversation_id not in self.conversation_memory:
            self.conversation_memory[conversation_id] = []

    def get_history(self, conversation_id: str) -> List[Dict[str, str]]:
        """
        Retrieve full conversation history for a given conversation_id.
        """
        return self.conversation_memory.get(conversation_id, [])


    def get_recent_messages(self, conversation_id: str, limit: int = 10) -> List[Dict[str, str]]:
        """
        Retrieve recent conversation history limited to the specified count
        to prevent excessive token usage when sending to Gemini API.
        """
        history = self.get_history(conversation_id)
        if len(history) > limit:
            return history[-limit:]
        return history

    def add_message(self, conversation_id: str, role: str, content: str) -> None:
        """
        Store a message (user or assistant) in temporary in-memory dictionary.
        Automatically limits stored messages to max_messages per session.
        """
        if not conversation_id:
            conversation_id = self.create_conversation_id()

        if conversation_id not in self.conversation_memory:
            self.conversation_memory[conversation_id] = []

        self.conversation_memory[conversation_id].append({
            "role": role,
            "content": content
        })

        # Trim oldest messages if exceeding maximum history capacity
        if len(self.conversation_memory[conversation_id]) > self.max_messages:
            self.conversation_memory[conversation_id] = self.conversation_memory[conversation_id][-self.max_messages:]

    def clear_conversation(self, conversation_id: str) -> bool:
        """
        Clear conversation history for a specific conversation session.
        """
        if conversation_id in self.conversation_memory:
            del self.conversation_memory[conversation_id]
            return True
        return False

    def clear_all(self) -> None:
        """
        Clear all conversation histories currently stored in memory.
        """
        self.conversation_memory.clear()


# Global singleton instance for app-wide temporary memory management
conversation_service = ConversationService()
