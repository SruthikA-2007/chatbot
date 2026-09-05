"""
StudySync AI - Conversation Service Module Alias
Re-exports ConversationService and conversation_service from services.conversation_service
"""

try:
    from services.conversation_service import ConversationService, conversation_service
except ImportError:
    from backend.services.conversation_service import ConversationService, conversation_service

__all__ = ["ConversationService", "conversation_service"]
