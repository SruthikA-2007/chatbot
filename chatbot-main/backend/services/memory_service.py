"""
StudySync AI - Memory Service Bridge
Provides backward compatibility by forwarding to conversation_service.
"""

from services.conversation_service import conversation_service, ConversationService

# Alias MemoryService to ConversationService
MemoryService = ConversationService
memory_service = conversation_service
