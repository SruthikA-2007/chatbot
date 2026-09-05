/**
 * StudySync AI - Main Educational Chatbot Application (app.js)
 * 
 * Capabilities:
 * 1. Generates unique conversation_id using JavaScript and stores in sessionStorage.
 * 2. Sends conversation_id with every message to maintain temporary backend context.
 * 3. Preserves conversation_id across page refreshes via sessionStorage.
 * 4. Clears context when closing the browser tab or clicking "New Chat".
 * 5. Explains educational concepts, verifies claims, recommends breaks, and answers follow-ups.
 */

const StudySyncApp = {
  apiBaseUrl: 'http://127.0.0.1:5000/api',
  conversationId: null,
  isGenerating: false,
  STORAGE_KEY: 'studysync_conversation_id',

  // DOM Elements
  elements: {
    chatInput: null,
    sendBtn: null,
    messagesContainer: null,
    messagesList: null,
    welcomeScreen: null,
    clearChatBtn: null,
    newChatBtn: null,
    historyList: null,
    sidebarToggle: null,
    sidebar: null,
    sidebarBackdrop: null,
    toastContainer: null
  },

  // ==========================================================================
  // Initialization
  // ==========================================================================
  init() {
    this.cacheDomElements();
    this.initConversationId();
    this.bindEvents();
    this.loadBackendHistory();
    console.log(`🚀 StudySync AI initialized | Temporary Session ID: ${this.conversationId}`);
  },

  cacheDomElements() {
    this.elements.chatInput = document.getElementById('chatInput');
    this.elements.sendBtn = document.getElementById('sendBtn');
    this.elements.messagesContainer = document.getElementById('chatMessagesContainer');
    this.elements.messagesList = document.getElementById('messagesList');
    this.elements.welcomeScreen = document.getElementById('welcomeScreen');
    this.elements.clearChatBtn = document.getElementById('clearChatBtn');
    this.elements.newChatBtn = document.getElementById('newChatBtn');
    this.elements.historyList = document.getElementById('historyList');
    this.elements.sidebarToggle = document.getElementById('sidebarToggle');
    this.elements.sidebar = document.getElementById('sidebar');
    this.elements.sidebarBackdrop = document.getElementById('sidebarBackdrop');
    this.elements.toastContainer = document.getElementById('toastContainer');
  },

  generateConversationId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  },

  initConversationId() {
    let storedId = null;
    try {
      storedId = sessionStorage.getItem(this.STORAGE_KEY);
    } catch (_) {}

    if (!storedId) {
      storedId = this.generateConversationId();
      try {
        sessionStorage.setItem(this.STORAGE_KEY, storedId);
      } catch (_) {}
    }

    this.conversationId = storedId;
  },

  async loadBackendHistory() {
    if (!this.conversationId) return;

    try {
      const response = await fetch(`${this.apiBaseUrl}/history/${this.conversationId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.display = 'none';
          }
          this.elements.messagesList.innerHTML = '';
          data.messages.forEach(msg => {
            if (msg.role === 'user') {
              this.appendUserMessage(msg.content);
            } else {
              this.appendAIMessage({
                response: msg.content,
                sources: msg.sources || [],
                verification_status: msg.verification_status || ''
              });
            }
          });
          this.scrollToBottom();
        }
      }
    } catch (_) {
      // Backend unavailable or session history empty
    }
  },

  // ==========================================================================
  // Event Bindings
  // ==========================================================================
  bindEvents() {
    // 1. Send button click
    if (this.elements.sendBtn) {
      this.elements.sendBtn.addEventListener('click', () => this.handleSendMessage());
    }

    // 2. Textarea Enter key (Shift+Enter for newline)
    if (this.elements.chatInput) {
      this.elements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });

      // Auto-resize input & toggle button state
      this.elements.chatInput.addEventListener('input', () => {
        const hasText = this.elements.chatInput.value.trim().length > 0;
        this.elements.sendBtn.disabled = !hasText || this.isGenerating;
        this.elements.chatInput.style.height = 'auto';
        this.elements.chatInput.style.height = Math.min(this.elements.chatInput.scrollHeight, 140) + 'px';
      });
    }

    // 3. Suggested Prompt Cards Click
    document.querySelectorAll('.suggested-card').forEach(card => {
      card.addEventListener('click', () => {
        const prompt = card.getAttribute('data-prompt');
        if (prompt && !this.isGenerating) {
          this.elements.chatInput.value = prompt;
          this.elements.sendBtn.disabled = false;
          this.handleSendMessage();
        }
      });
    });

    // 4. Quick Action Feature Pills Click
    document.querySelectorAll('.feature-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const prefix = pill.getAttribute('data-prefix');
        if (prefix && this.elements.chatInput) {
          this.elements.chatInput.value = prefix;
          this.elements.chatInput.focus();
          this.elements.sendBtn.disabled = false;
        }
      });
    });

    // 5. Session Actions (Clear & New Chat)
    if (this.elements.clearChatBtn) {
      this.elements.clearChatBtn.addEventListener('click', () => this.clearCurrentChat());
    }
    if (this.elements.newChatBtn) {
      this.elements.newChatBtn.addEventListener('click', () => this.startNewSession(true));
    }

    // 6. Mobile Sidebar Toggle
    if (this.elements.sidebarToggle && this.elements.sidebar) {
      this.elements.sidebarToggle.addEventListener('click', () => {
        this.elements.sidebar.classList.toggle('open');
        if (this.elements.sidebarBackdrop) {
          this.elements.sidebarBackdrop.classList.toggle('active');
        }
      });
    }

    if (this.elements.sidebarBackdrop) {
      this.elements.sidebarBackdrop.addEventListener('click', () => {
        this.elements.sidebar.classList.remove('open');
        this.elements.sidebarBackdrop.classList.remove('active');
      });
    }
  },

  // ==========================================================================
  // Chat Core Execution
  // ==========================================================================
  async handleSendMessage() {
    const text = this.elements.chatInput.value.trim();
    if (!text || this.isGenerating) return;

    // Reset input box
    this.elements.chatInput.value = '';
    this.elements.chatInput.style.height = 'auto';
    this.elements.sendBtn.disabled = true;

    // Hide welcome screen
    if (this.elements.welcomeScreen) {
      this.elements.welcomeScreen.style.display = 'none';
    }

    // Add user message to UI canvas
    this.appendUserMessage(text);
    this.scrollToBottom();

    // Show animated loading indicator
    this.isGenerating = true;
    const typingIndicator = this.showTypingIndicator();
    this.scrollToBottom();

    try {
      // POST to Flask Backend (/api/chat) with current conversation_id
      const data = await this.postChatMessage(text);
      this.removeTypingIndicator(typingIndicator);

      if (data.conversation_id && data.conversation_id !== this.conversationId) {
        this.conversationId = data.conversation_id;
        try {
          sessionStorage.setItem(this.STORAGE_KEY, this.conversationId);
        } catch (_) {}
      }

      // Add AI response to UI canvas
      this.appendAIMessage(data);
    } catch (error) {
      console.error('Chat API Error:', error);
      this.removeTypingIndicator(typingIndicator);
      this.appendErrorMessage(error.message, text);
    } finally {
      this.isGenerating = false;
      this.elements.sendBtn.disabled = this.elements.chatInput.value.trim().length === 0;
      this.scrollToBottom();
    }
  },

  async postChatMessage(message) {
    const payload = {
      message: message,
      conversation_id: this.conversationId
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errText = `Server error (${response.status})`;
        try {
          const errJson = await response.json();
          if (errJson.error) errText = errJson.error;
        } catch (_) {}
        throw new Error(errText);
      }

      return await response.json();
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        return this.getOfflineEducationalFallback(message);
      }
      throw err;
    }
  },

  // ==========================================================================
  // Session Actions (New Chat & Clear)
  // ==========================================================================
  startNewSession(notify = true) {
    // Generate a fresh temporary conversation_id
    this.conversationId = this.generateConversationId();
    try {
      sessionStorage.setItem(this.STORAGE_KEY, this.conversationId);
    } catch (_) {}

    // Clear chat UI interface
    if (this.elements.messagesList) {
      this.elements.messagesList.innerHTML = '';
      if (this.elements.welcomeScreen) {
        this.elements.messagesList.appendChild(this.elements.welcomeScreen);
        this.elements.welcomeScreen.style.display = 'flex';
      }
    }

    if (this.elements.sidebar) {
      this.elements.sidebar.classList.remove('open');
      if (this.elements.sidebarBackdrop) this.elements.sidebarBackdrop.classList.remove('active');
    }

    if (notify) this.showToast('Started new conversation');
    console.log(`✨ New Chat started | Session: ${this.conversationId}`);
  },

  async clearCurrentChat() {
    if (this.conversationId) {
      try {
        await fetch(`${this.apiBaseUrl}/clear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: this.conversationId })
        });
      } catch (_) {}
    }
    this.startNewSession(false);
    this.showToast('Conversation cleared');
  },

  // ==========================================================================
  // Message Rendering
  // ==========================================================================
  appendUserMessage(text) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper user';
    wrapper.innerHTML = `
      <div class="message-bubble">
        ${this.escapeHtml(text).replace(/\n/g, '<br>')}
      </div>
    `;
    this.elements.messagesList.appendChild(wrapper);
  },

  appendAIMessage(data) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai';

    const rawResponse = data.response || "I have analyzed your educational question.";
    const sources = Array.isArray(data.sources) ? data.sources : [];
    const claimVerdict = data.claim_verdict || '';

    // Sources citations chips (shared between claim card and standard response)
    const sourcesHtml = this._buildSourcesHtml(sources);

    const formattedContent = this.renderMarkdown(rawResponse);

    // ---------- Claim Verification Card ----------
    if (claimVerdict) {
      const verdictConfig = this._getVerdictConfig(claimVerdict);

      wrapper.innerHTML = `
        <div class="ai-avatar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Z"></path>
            <path d="M4 14a8 8 0 0 0 16 0"></path>
            <path d="M12 14v8"></path>
          </svg>
        </div>
        <div class="message-content-wrapper">
          <div class="message-bubble">
            <div class="claim-card">
              <div class="claim-card-header">
                <span class="claim-card-title">🔬 Claim Verification</span>
                <span class="verdict-badge ${verdictConfig.cssClass}">${verdictConfig.icon} ${this.escapeHtml(claimVerdict)}</span>
              </div>
              <div class="markdown-body">${formattedContent}</div>
              ${sourcesHtml}
            </div>
          </div>
          <div class="message-meta">
            <span class="message-time">${this.formatCurrentTime()}</span>
            <div class="message-actions">
              <button class="msg-action-btn copy-btn" title="Copy response">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
                Copy
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      // ---------- Standard AI Response ----------
      let badgeHtml = '';
      if (data.verification_status) {
        const status = String(data.verification_status).toLowerCase();
        if (status === 'verified') {
          badgeHtml = `<span class="verification-badge verified">✓ Verified by Reliable Sources</span>`;
        } else if (status === 'debunked') {
          badgeHtml = `<span class="verification-badge debunked">✕ Claim Scientifically Refuted</span>`;
        } else if (status === 'insufficient') {
          badgeHtml = `<span class="verification-badge nuanced">⚠ Insufficient Evidence</span>`;
        } else {
          badgeHtml = `<span class="verification-badge nuanced">⚠ Nuanced / Context-Dependent</span>`;
        }
      }

      wrapper.innerHTML = `
        <div class="ai-avatar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Z"></path>
            <path d="M4 14a8 8 0 0 0 16 0"></path>
            <path d="M12 14v8"></path>
          </svg>
        </div>
        <div class="message-content-wrapper">
          <div class="message-bubble">
            ${badgeHtml}
            <div class="markdown-body">${formattedContent}</div>
            ${sourcesHtml}
          </div>
          <div class="message-meta">
            <span class="message-time">${this.formatCurrentTime()}</span>
            <div class="message-actions">
              <button class="msg-action-btn copy-btn" title="Copy response">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
                Copy
              </button>
            </div>
          </div>
        </div>
      `;
    }

    const copyBtn = wrapper.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        this.copyToClipboard(rawResponse);
      });
    }

    this.elements.messagesList.appendChild(wrapper);
  },

  /**
   * Returns the CSS class and icon for a claim verdict string.
   */
  _getVerdictConfig(verdict) {
    const v = String(verdict).toLowerCase();
    if (v === 'supported') {
      return { cssClass: 'supported', icon: '✅' };
    } else if (v === 'not supported') {
      return { cssClass: 'not-supported', icon: '❌' };
    } else if (v === 'partially supported') {
      return { cssClass: 'partially-supported', icon: '⚠️' };
    } else if (v === 'insufficient evidence') {
      return { cssClass: 'insufficient-evidence', icon: '❓' };
    }
    return { cssClass: 'insufficient-evidence', icon: '❓' };
  },

  /**
   * Builds the HTML for source citation cards.
   * Supports both structured objects {name, title, relevance} and legacy plain strings.
   */
  _buildSourcesHtml(sources) {
    if (!sources || sources.length === 0) return '';

    const chips = sources.map(s => {
      // Handle both structured objects and legacy plain strings
      const isStructured = typeof s === 'object' && s !== null;
      const name = isStructured ? (s.name || '') : String(s);
      const title = isStructured ? (s.title || '') : '';
      const relevance = isStructured ? (s.relevance || '') : '';

      let cardContent = `
        <div class="source-header">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
          <span class="source-name">${this.escapeHtml(name)}</span>
        </div>`;

      if (title) {
        cardContent += `<span class="source-title">${this.escapeHtml(title)}</span>`;
      }
      if (relevance) {
        cardContent += `<span class="source-relevance">${this.escapeHtml(relevance)}</span>`;
      }

      return `<div class="source-chip">${cardContent}</div>`;
    }).join('');

    return `
      <div class="sources-container">
        <div class="sources-label">Validated References</div>
        <div class="sources-list">${chips}</div>
      </div>
    `;
  },

  appendErrorMessage(errorMessage, originalPrompt) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai';
    wrapper.innerHTML = `
      <div class="ai-avatar" style="background: var(--accent-rose);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="message-content-wrapper">
        <div class="message-bubble" style="border-left: 4px solid var(--accent-rose);">
          <p style="color: #991b1b; font-weight: 600; margin-bottom: 6px;">Connection Alert</p>
          <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 12px;">
            ${this.escapeHtml(errorMessage || "Unable to reach StudySync AI backend.")}
          </p>
          <button class="btn-primary retry-btn" style="padding: 6px 14px; font-size: 0.8rem;">
            Retry Message
          </button>
        </div>
      </div>
    `;

    const retryBtn = wrapper.querySelector('.retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        wrapper.remove();
        this.elements.chatInput.value = originalPrompt;
        this.handleSendMessage();
      });
    }

    this.elements.messagesList.appendChild(wrapper);
  },

  showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message-wrapper ai typing';
    indicator.id = 'activeTypingIndicator';
    indicator.innerHTML = `
      <div class="ai-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Z"></path>
          <path d="M4 14a8 8 0 0 0 16 0"></path>
          <path d="M12 14v8"></path>
        </svg>
      </div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <span class="typing-label">StudySync AI is thinking...</span>
      </div>
    `;
    this.elements.messagesList.appendChild(indicator);
    return indicator;
  },

  removeTypingIndicator(indicator) {
    if (indicator && indicator.parentNode) indicator.remove();
    const el = document.getElementById('activeTypingIndicator');
    if (el) el.remove();
  },

  scrollToBottom() {
    if (this.elements.messagesContainer) {
      requestAnimationFrame(() => {
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
      });
    }
  },

  // ==========================================================================
  // Markdown & Utility Helpers
  // ==========================================================================
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  renderMarkdown(text) {
    if (!text) return '';
    let html = this.escapeHtml(text);

    // Code blocks
    html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$2</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold & Italics
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Unordered lists
    html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // Paragraphs
    const paragraphs = html.split(/\n\n+/);
    html = paragraphs.map(p => {
      p = p.trim();
      if (!p.startsWith('<h') && !p.startsWith('<ul') && !p.startsWith('<pre') && !p.startsWith('<blockquote')) {
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
      }
      return p;
    }).join('');

    return html;
  },

  formatCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  showToast(message, duration = 3000) {
    const container = this.elements.toastContainer;
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <path d="m9 12 2 2 4-4"></path>
      </svg>
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Copied answer to clipboard!');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  },

  getOfflineEducationalFallback(prompt) {
    const p = prompt.toLowerCase();

    if (p.includes('diagnose') || p.includes('symptom') || p.includes('medicine for') || p.includes('medical advice') || p.includes('cure my') || p.includes('prescription')) {
      return {
        response: "I don't know. I am **StudySync AI**, an educational assistant focused on academic concepts, studying strategies, and memory retention. I cannot provide medical or diagnosis advice. Please consult a qualified doctor or healthcare professional.",
        sources: [
          {name: "World Health Organization (WHO)", title: "Health Topics", relevance: "Global public health authority providing reliable medical information and guidelines."}
        ],
        conversation_id: this.conversationId
      };
    }

    if (p.includes('legal advice') || p.includes('sue') || p.includes('court case') || p.includes('lawyer advice') || p.includes('am i liable')) {
      return {
        response: "I don't know. I am **StudySync AI**, an educational chatbot designed to assist with study planning and scientific learning. I cannot provide legal advice or legal counsel. Please consult a licensed attorney.",
        sources: [
          {name: "American Bar Association (ABA)", title: "Public Resources", relevance: "National organization providing guidance on finding legal representation."}
        ],
        conversation_id: this.conversationId
      };
    }

    if (p.includes('10%') || p.includes('brain') || p.includes('verify')) {
      return {
        response: `### Scientific Claim Verification: 10% Brain Usage Myth\n\n**Verdict: Debunked (False)**\n\n> **Scientific Reality:** Brain imaging technologies such as **fMRI** and **PET scans** reveal that almost all regions of the human brain are active throughout the day, even during sleep.\n\n#### Key Scientific Evidence:\n- **Metabolic Cost:** The brain accounts for ~20% of the body's energy consumption despite being ~2% of its mass.\n- **Neuroplasticity:** Unused brain cells undergo synaptic pruning. There are no dormant reserves waiting to be unlocked.\n\n**Recommendation:** Optimize learning via **active recall**, **spaced repetition**, and **sleep** rather than looking for quick-fix myths.`,
        sources: [
          {name: "Nature Reviews Neuroscience", title: "Do We Only Use 10% of Our Brain?", relevance: "Peer-reviewed neuroscience journal debunking the myth with fMRI evidence."},
          {name: "Harvard Medical School", title: "The 10 Percent Brain Myth", relevance: "Academic medical institution explaining full-brain metabolic activity."},
          {name: "Society for Neuroscience", title: "Brain Facts: A Primer on the Brain", relevance: "Leading scientific society educational resource on brain function."}
        ],
        verification_status: "debunked",
        conversation_id: this.conversationId
      };
    }

    if (p.includes('quantum') || p.includes('superposition') || p.includes('explain') || p.includes('simple')) {
      return {
        response: `### Quantum Superposition: The Spinning Coin Analogy 🪙\n\nImagine a normal coin resting flat on a desk:\n- It is definitively either **Heads (1)** OR **Tails (0)**.\n\nNow, give that coin a fast spin on the table:\n- While it is spinning rapidly, is it heads or tails?\n- It is in a **blend of both states simultaneously**.\n\n#### The Science Principle:\n1. **Superposition:** Until you measure a quantum particle, it exists in multiple probable states at once.\n2. **Measurement Collapse:** The instant you slap your hand down on the coin, the spin stops and it collapses into one reality!`,
        sources: [
          {name: "MIT OpenCourseWare", title: "Quantum Physics I (8.04)", relevance: "Free university-level course material from a world-leading research institution."},
          {name: "California Institute of Technology", title: "The Feynman Lectures on Physics, Vol. III", relevance: "Foundational physics textbook by Nobel laureate Richard Feynman."}
        ],
        conversation_id: this.conversationId
      };
    }

    if (p.includes('break') || p.includes('rest') || p.includes('tired')) {
      return {
        response: `### Evidence-Based Study Break Recommendation ☕\n\nBased on **Ultradian Rhythm Cycles** (~90-minute focus waves):\n\n- **Optimal Duration:** 5 to 15 minutes.\n- **Diffuse Mode Activation:** Step completely away from all digital screens.\n- **Optic Flow:** Gaze at distant horizons or objects 20 feet away to relax ciliary eye muscles.\n- **Hydration & Reset:** Drink 250ml water and take 5 deep physiological sigh breaths (2 quick inhales through nose, 1 long exhale through mouth).`,
        sources: [
          {name: "Journal of Applied Psychology", title: "Work Breaks, Performance, and Well-Being", relevance: "Peer-reviewed research on optimal break intervals for sustained cognitive performance."},
          {name: "Stanford University School of Medicine", title: "Huberman Lab: Focus and Concentration", relevance: "Neuroscience-based protocols for managing attention cycles and physiological resets."}
        ],
        conversation_id: this.conversationId
      };
    }

    return {
      response: `### StudySync AI Insights for: "${prompt}"\n\nHere is how to approach this educational topic using cognitive science principles:\n\n1. **Active Retrieval:** Close your notes and write out key concepts from memory before reviewing.\n2. **Feynman Simplification:** Explain the mechanism out loud in your own words to identify gaps in your understanding.\n3. **Spaced Intervals:** Re-test this concept tomorrow, in 3 days, and again in 7 days to halt the forgetting curve.\n\n*Feel free to ask a follow-up question or request practice quiz questions!*`,
      sources: [
        {name: "Cognitive Science Society", title: "Trends in Cognitive Sciences", relevance: "Leading scientific society publishing peer-reviewed research on learning, memory, and cognition."},
        {name: "Cambridge University Press", title: "The Cambridge Handbook of the Learning Sciences", relevance: "Comprehensive academic handbook covering evidence-based learning principles."}
      ],
      conversation_id: this.conversationId
    };
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  StudySyncApp.init();
  StudyPlanner.init();
});


// =============================================================================
// StudySync AI — Study Planner Module
// =============================================================================
const StudyPlanner = {
  apiBaseUrl: 'http://127.0.0.1:5000/api',
  currentStep: 1,
  totalSteps: 3,
  isGenerating: false,

  // Planner state (temporary, request-scoped — no database)
  state: {
    studyHours: 2,
    prepDays: 7,
    examDate: '',
    preferredTime: 'morning',
    subjects: [],       // [{name, difficulty}]
    goals: ''
  },

  // ==========================================================================
  // Init
  // ==========================================================================
  init() {
    this._bindModalEvents();
    this._bindStep1Events();
    this._bindStep2Events();
  },

  // ==========================================================================
  // Modal Open / Close
  // ==========================================================================
  open() {
    this.currentStep = 1;
    this._resetState();
    this._renderStep(1);
    this._updateStepBar(1);
    document.getElementById('plannerOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  close() {
    document.getElementById('plannerOverlay').classList.remove('active');
    document.body.style.overflow = '';
  },

  _bindModalEvents() {
    // Open trigger
    const openBtn = document.getElementById('openPlannerBtn');
    if (openBtn) openBtn.addEventListener('click', () => this.open());

    // Close button
    const closeBtn = document.getElementById('plannerCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // Click outside to close
    const overlay = document.getElementById('plannerOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });
    }

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    // Back button
    const backBtn = document.getElementById('plannerBackBtn');
    if (backBtn) backBtn.addEventListener('click', () => this._goBack());

    // Next / Generate button
    const nextBtn = document.getElementById('plannerNextBtn');
    if (nextBtn) nextBtn.addEventListener('click', () => this._goNext());
  },

  // ==========================================================================
  // Step 1 Events: Hours slider + time-of-day pills
  // ==========================================================================
  _bindStep1Events() {
    const slider = document.getElementById('studyHoursRange');
    const display = document.getElementById('hoursDisplay');

    if (slider) {
      slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        this.state.studyHours = val;
        display.innerHTML = `${val} <span>hour${val !== 1 ? 's' : ''} / day</span>`;
        // Update gradient fill
        const pct = ((val - 0.5) / (10 - 0.5)) * 100;
        slider.style.setProperty('--range-pct', `${pct}%`);
      });
    }

    // Prep days
    const prepInput = document.getElementById('prepDaysInput');
    if (prepInput) {
      prepInput.addEventListener('input', () => {
        this.state.prepDays = parseInt(prepInput.value) || 7;
      });
    }

    // Exam date
    const examInput = document.getElementById('examDateInput');
    if (examInput) {
      examInput.addEventListener('change', () => {
        this.state.examDate = examInput.value;
        if (examInput.value) {
          // Calculate days from today
          const today = new Date();
          const exam = new Date(examInput.value);
          const diffMs = exam - today;
          const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          this.state.prepDays = diffDays;
          if (prepInput) prepInput.value = diffDays;
        }
      });
    }

    // Time-of-day pills
    const timePillsContainer = document.getElementById('timePills');
    if (timePillsContainer) {
      timePillsContainer.querySelectorAll('.time-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          timePillsContainer.querySelectorAll('.time-pill').forEach(p => p.classList.remove('selected'));
          pill.classList.add('selected');
          this.state.preferredTime = pill.getAttribute('data-time');
        });
      });
    }
  },

  // ==========================================================================
  // Step 2 Events: Subject entry
  // ==========================================================================
  _bindStep2Events() {
    const addBtn = document.getElementById('addSubjectBtn');
    const subjectInput = document.getElementById('subjectNameInput');

    if (addBtn) addBtn.addEventListener('click', () => this._addSubject());
    if (subjectInput) {
      subjectInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this._addSubject(); }
      });
    }
  },

  _addSubject() {
    const input = document.getElementById('subjectNameInput');
    const name = input ? input.value.trim() : '';
    if (!name) return;
    if (this.state.subjects.length >= 8) {
      StudySyncApp.showToast('Maximum 8 subjects allowed.');
      return;
    }
    if (this.state.subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      StudySyncApp.showToast('Subject already added.');
      return;
    }
    this.state.subjects.push({ name, difficulty: 'medium' });
    if (input) input.value = '';
    this._renderSubjectsList();
  },

  _removeSubject(name) {
    this.state.subjects = this.state.subjects.filter(s => s.name !== name);
    this._renderSubjectsList();
  },

  _updateSubjectDifficulty(name, difficulty) {
    const subj = this.state.subjects.find(s => s.name === name);
    if (subj) subj.difficulty = difficulty;
  },

  _renderSubjectsList() {
    const list = document.getElementById('subjectsList');
    const empty = document.getElementById('subjectsEmpty');
    if (!list) return;

    // Remove existing subject tags (keep empty placeholder)
    list.querySelectorAll('.subject-tag').forEach(el => el.remove());

    if (this.state.subjects.length === 0) {
      if (empty) empty.style.display = 'block';
    } else {
      if (empty) empty.style.display = 'none';
      this.state.subjects.forEach(subj => {
        const tag = document.createElement('div');
        tag.className = 'subject-tag';
        tag.innerHTML = `
          <span class="subject-tag-name">${this._esc(subj.name)}</span>
          <select class="subject-diff-select ${subj.difficulty}" aria-label="Difficulty for ${this._esc(subj.name)}">
            <option value="easy" ${subj.difficulty === 'easy' ? 'selected' : ''}>🟢 Easy</option>
            <option value="medium" ${subj.difficulty === 'medium' ? 'selected' : ''}>🟡 Medium</option>
            <option value="hard" ${subj.difficulty === 'hard' ? 'selected' : ''}>🔴 Hard</option>
          </select>
          <button class="subject-remove-btn" aria-label="Remove ${this._esc(subj.name)}">✕</button>
        `;

        const select = tag.querySelector('.subject-diff-select');
        select.addEventListener('change', () => {
          this._updateSubjectDifficulty(subj.name, select.value);
          select.className = `subject-diff-select ${select.value}`;
        });

        const removeBtn = tag.querySelector('.subject-remove-btn');
        removeBtn.addEventListener('click', () => this._removeSubject(subj.name));

        list.insertBefore(tag, empty);
      });
    }
  },

  // ==========================================================================
  // Navigation
  // ==========================================================================
  _goNext() {
    if (this.isGenerating) return;

    if (this.currentStep === 1) {
      if (!this._validateStep1()) return;
      this.currentStep = 2;
      this._renderStep(2);
      this._updateStepBar(2);

    } else if (this.currentStep === 2) {
      if (!this._validateStep2()) return;
      this.currentStep = 3;
      this._renderStep(3);
      this._updateStepBar(3);
      this._renderPlanSummary();

    } else if (this.currentStep === 3) {
      // Capture goals
      const goalsInput = document.getElementById('goalsInput');
      this.state.goals = goalsInput ? goalsInput.value.trim() : '';
      // Generate
      this._generateSchedule();
    }
  },

  _goBack() {
    if (this.currentStep <= 1) return;
    this.currentStep--;
    this._renderStep(this.currentStep);
    this._updateStepBar(this.currentStep);
  },

  _renderStep(step) {
    for (let i = 1; i <= this.totalSteps; i++) {
      const el = document.getElementById(`plannerStep${i}`);
      if (el) el.classList.toggle('active', i === step);
    }

    const backBtn = document.getElementById('plannerBackBtn');
    const nextBtn = document.getElementById('plannerNextBtn');

    if (backBtn) backBtn.style.display = step > 1 ? 'block' : 'none';
    if (nextBtn) nextBtn.textContent = step === this.totalSteps ? '✨ Generate Schedule' : 'Next Step →';
  },

  _updateStepBar(activeStep) {
    for (let i = 1; i <= this.totalSteps; i++) {
      const dot = document.getElementById(`stepDot${i}`);
      if (!dot) continue;
      dot.classList.remove('active', 'done');
      if (i < activeStep)  dot.classList.add('done');
      if (i === activeStep) dot.classList.add('active');
    }
    for (let i = 1; i < this.totalSteps; i++) {
      const line = document.getElementById(`stepLine${i}`);
      if (line) line.classList.toggle('done', i < activeStep);
    }
  },

  // ==========================================================================
  // Validation
  // ==========================================================================
  _validateStep1() {
    const hours = this.state.studyHours;
    if (!hours || hours <= 0) {
      StudySyncApp.showToast('Please set your daily study hours.');
      return false;
    }
    return true;
  },

  _validateStep2() {
    if (this.state.subjects.length === 0) {
      StudySyncApp.showToast('Please add at least one subject.');
      return false;
    }
    return true;
  },

  // ==========================================================================
  // Plan Summary (Step 3 preview)
  // ==========================================================================
  _renderPlanSummary() {
    const container = document.getElementById('planSummaryContent');
    if (!container) return;

    const timeLabel = { morning: '🌅 Morning', afternoon: '☀️ Afternoon', evening: '🌇 Evening', night: '🌙 Night' };
    const diffLabel = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard' };
    const periodLabel = this.state.examDate
      ? `Exam on ${this.state.examDate}`
      : `${this.state.prepDays} days preparation`;

    const rows = [
      { label: 'Daily Study Time', value: `${this.state.studyHours} hours` },
      { label: 'Prep Period',      value: periodLabel },
      { label: 'Study Time',       value: timeLabel[this.state.preferredTime] || this.state.preferredTime },
      { label: 'Subjects',         value: this.state.subjects.map(s => `${this._esc(s.name)} (${diffLabel[s.difficulty] || s.difficulty})`).join(', ') }
    ];

    container.innerHTML = rows.map(r => `
      <div style="display:flex;gap:8px;align-items:flex-start;">
        <span style="font-size:0.78rem;font-weight:700;color:var(--text-muted);min-width:110px;flex-shrink:0;">${r.label}</span>
        <span style="font-size:0.82rem;color:var(--text-primary);font-weight:600;line-height:1.4;">${r.value}</span>
      </div>
    `).join('');
  },

  // ==========================================================================
  // Generate Schedule (API Call)
  // ==========================================================================
  async _generateSchedule() {
    if (this.isGenerating) return;
    this.isGenerating = true;

    const nextBtn = document.getElementById('plannerNextBtn');
    const genLabel = document.getElementById('plannerGenerating');

    if (nextBtn)    nextBtn.style.display = 'none';
    if (genLabel)   genLabel.style.display = 'flex';

    const difficultiesMap = {};
    this.state.subjects.forEach(s => { difficultiesMap[s.name] = s.difficulty; });

    const payload = {
      study_hours:    String(this.state.studyHours),
      subjects:       this.state.subjects.map(s => s.name),
      difficulties:   difficultiesMap,
      prep_days:      String(this.state.prepDays),
      exam_date:      this.state.examDate,
      preferred_time: this.state.preferredTime,
      goals:          this.state.goals
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/planner/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errMsg = `Server error (${response.status})`;
        try { const j = await response.json(); if (j.error) errMsg = j.error; } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      this.close();
      this._renderScheduleInChat(data);

    } catch (err) {
      console.error('Planner API error:', err);
      // Render an offline fallback schedule directly
      this.close();
      this._renderOfflineFallback(payload);
    } finally {
      this.isGenerating = false;
      if (nextBtn)  nextBtn.style.display = 'block';
      if (genLabel) genLabel.style.display = 'none';
    }
  },

  // ==========================================================================
  // Render Schedule in Chat Canvas
  // ==========================================================================
  _renderScheduleInChat(data) {
    const messagesList = StudySyncApp.elements.messagesList;
    const welcomeScreen = StudySyncApp.elements.welcomeScreen;

    if (welcomeScreen) welcomeScreen.style.display = 'none';

    const scheduleText = data.schedule || '';
    const subjects    = (data.subjects || []).join(', ');
    const hours       = data.study_hours || '?';
    const days        = data.prep_days || '?';
    const preferred   = data.preferred_time || 'morning';

    const timeLabel = { morning: '🌅 Morning', afternoon: '☀️ Afternoon', evening: '🌇 Evening', night: '🌙 Night' };

    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai';
    wrapper.style.animation = 'messageSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

    const rendered = this._renderScheduleMarkdown(scheduleText);

    wrapper.innerHTML = `
      <div class="ai-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
          <line x1="16" x2="16" y1="2" y2="6"></line>
          <line x1="8" x2="8" y1="2" y2="6"></line>
          <line x1="3" x2="21" y1="10" y2="10"></line>
          <path d="m9 16 2 2 4-4"></path>
        </svg>
      </div>
      <div class="message-content-wrapper" style="max-width:90%;">
        <div class="schedule-result-card">
          <div class="schedule-result-header">
            <div class="schedule-result-title">
              <div class="sched-icon">📅</div>
              <div>
                <h3>Your Personalized Study Schedule</h3>
                <p>AI-generated · ${hours}h/day · ${days} days</p>
              </div>
            </div>
            <div class="schedule-meta-pills">
              <span class="schedule-meta-pill">${timeLabel[preferred] || preferred}</span>
              <span class="schedule-meta-pill">${(data.subjects || []).length} subjects</span>
            </div>
          </div>
          <div class="schedule-result-body">${rendered}</div>
          <div class="schedule-result-actions">
            <button class="sched-action-btn copy-schedule-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
              Copy Schedule
            </button>
            <button class="sched-action-btn new-plan-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>
              New Plan
            </button>
          </div>
        </div>
        <div class="message-meta">
          <span class="message-time">${StudySyncApp.formatCurrentTime()}</span>
        </div>
      </div>
    `;

    // Wire copy button
    const copyBtn = wrapper.querySelector('.copy-schedule-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => StudySyncApp.copyToClipboard(scheduleText));
    }

    // Wire new plan button
    const newPlanBtn = wrapper.querySelector('.new-plan-btn');
    if (newPlanBtn) {
      newPlanBtn.addEventListener('click', () => this.open());
    }

    messagesList.appendChild(wrapper);
    StudySyncApp.scrollToBottom();
    StudySyncApp.showToast('📅 Study schedule generated!');
  },

  _renderOfflineFallback(payload) {
    // Use JS-side fallback logic similar to the backend
    const hours     = parseFloat(payload.study_hours) || 2;
    const subjects  = payload.subjects || ['General Study'];
    const diffs     = payload.difficulties || {};
    const preferred = payload.preferred_time || 'morning';
    const days      = payload.prep_days || '7';

    const diffW = { hard: 3, medium: 2, easy: 1 };
    const sorted = [...subjects].sort((a, b) => (diffW[diffs[b]] || 2) - (diffW[diffs[a]] || 2));
    const totalW = sorted.reduce((s, sub) => s + (diffW[diffs[sub]] || 2), 0) || 1;
    const focusMins = Math.floor(hours * 60 * 0.65);
    const recallMins = Math.floor(hours * 60 * 0.20);

    const startHour = { morning: 8, afternoon: 13, evening: 18, night: 20 }[preferred] || 8;
    let cursor = startHour * 60;

    const fmt = (m) => {
      const h = Math.floor(m / 60) % 24;
      const min = m % 60;
      const sfx = h < 12 ? 'AM' : 'PM';
      let h12 = h <= 12 ? h : h - 12;
      if (h12 === 0) h12 = 12;
      return `${h12}:${String(min).padStart(2, '0')} ${sfx}`;
    };

    let tableRows = '';
    sorted.forEach((sub, i) => {
      const w = diffW[diffs[sub]] || 2;
      const dur = Math.max(20, Math.floor(focusMins * w / totalW));
      const d = (diffs[sub] || 'medium').charAt(0).toUpperCase() + (diffs[sub] || 'medium').slice(1);
      tableRows += `<tr><td>${fmt(cursor)}</td><td><strong>${StudySyncApp.escapeHtml(sub)}</strong> <small style="color:var(--text-muted)">(${d})</small></td><td>Deep Study &amp; Practice</td><td>${dur} min</td></tr>`;
      cursor += dur;
      if (i < sorted.length - 1) {
        tableRows += `<tr style="background:var(--bg-main)"><td>${fmt(cursor)}</td><td style="color:var(--text-muted)">—</td><td style="color:var(--accent-emerald)">Short Break</td><td>10 min</td></tr>`;
        cursor += 10;
      }
    });
    tableRows += `<tr style="background:var(--primary-purple-light)"><td>${fmt(cursor)}</td><td><strong>All Subjects</strong></td><td>Active Recall &amp; Spaced Review</td><td>${recallMins} min</td></tr>`;

    const schedHtml = `
      <h3>📚 Personalized Study Schedule</h3>
      <p><strong>Study Profile:</strong> This plan is tailored to your ${hours}-hour daily window. Higher-difficulty subjects get longer focus blocks, and every session ends with active recall.</p>
      <hr>
      <h4>Daily Session Template (${fmt(startHour * 60)} start)</h4>
      <table>
        <thead><tr><th>Time Block</th><th>Subject</th><th>Activity</th><th>Duration</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <h3>🧠 Key Study Techniques</h3>
      <ul>
        ${sorted.slice(0, 3).map(s => {
          const d = diffs[s] || 'medium';
          if (d === 'hard')   return `<li><strong>${StudySyncApp.escapeHtml(s)}:</strong> Use spaced repetition flashcards + timed practice problems every session.</li>`;
          if (d === 'medium') return `<li><strong>${StudySyncApp.escapeHtml(s)}:</strong> Apply the Feynman technique—teach each concept aloud in your own words.</li>`;
          return `<li><strong>${StudySyncApp.escapeHtml(s)}:</strong> Use active recall quizzes to consolidate material efficiently.</li>`;
        }).join('')}
        <li><strong>All Subjects:</strong> Use the Pomodoro technique (25 min focus + 5 min break) during longer blocks.</li>
      </ul>
      <h3>⚠️ Important Reminders</h3>
      <ul>
        <li>Sleep 7–9 hours nightly — memory consolidation happens during deep sleep.</li>
        <li>Stay hydrated and avoid heavy meals before study sessions.</li>
        <li>Avoid cramming the night before your exam — use that time for light review only.</li>
      </ul>
    `;

    const fakeData = {
      schedule: schedHtml,
      subjects: subjects,
      study_hours: String(hours),
      prep_days: String(days),
      preferred_time: preferred,
      status: 'offline_fallback'
    };

    // Render with pre-rendered HTML
    this._renderScheduleInChatHtml(fakeData, schedHtml);
  },

  _renderScheduleInChatHtml(data, preRenderedHtml) {
    const messagesList = StudySyncApp.elements.messagesList;
    const welcomeScreen = StudySyncApp.elements.welcomeScreen;
    if (welcomeScreen) welcomeScreen.style.display = 'none';

    const hours = data.study_hours;
    const days  = data.prep_days;
    const preferred = data.preferred_time || 'morning';
    const timeLabel = { morning: '🌅 Morning', afternoon: '☀️ Afternoon', evening: '🌇 Evening', night: '🌙 Night' };

    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai';

    wrapper.innerHTML = `
      <div class="ai-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
          <line x1="16" x2="16" y1="2" y2="6"></line>
          <line x1="8" x2="8" y1="2" y2="6"></line>
          <line x1="3" x2="21" y1="10" y2="10"></line>
          <path d="m9 16 2 2 4-4"></path>
        </svg>
      </div>
      <div class="message-content-wrapper" style="max-width:90%;">
        <div class="schedule-result-card">
          <div class="schedule-result-header">
            <div class="schedule-result-title">
              <div class="sched-icon">📅</div>
              <div>
                <h3>Your Personalized Study Schedule</h3>
                <p>Generated offline · ${hours}h/day · ${days} days</p>
              </div>
            </div>
            <div class="schedule-meta-pills">
              <span class="schedule-meta-pill">${timeLabel[preferred] || preferred}</span>
              <span class="schedule-meta-pill">${(data.subjects || []).length} subjects</span>
            </div>
          </div>
          <div class="schedule-result-body">${preRenderedHtml}</div>
          <div class="schedule-result-actions">
            <button class="sched-action-btn new-plan-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>
              New Plan
            </button>
          </div>
        </div>
        <div class="message-meta">
          <span class="message-time">${StudySyncApp.formatCurrentTime()}</span>
        </div>
      </div>
    `;

    wrapper.querySelector('.new-plan-btn').addEventListener('click', () => this.open());
    messagesList.appendChild(wrapper);
    StudySyncApp.scrollToBottom();
    StudySyncApp.showToast('📅 Study schedule generated!');
  },

  // ==========================================================================
  // Markdown → HTML (schedule-specific, handles tables)
  // ==========================================================================
  _renderScheduleMarkdown(text) {
    if (!text) return '';
    let html = StudySyncApp.escapeHtml(text);

    // Tables
    html = html.replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g, (_, header, body) => {
      const headers = header.split('|').map(h => h.trim()).filter(Boolean);
      const ths = headers.map(h => `<th>${h}</th>`).join('');
      const bodyRows = body.trim().split('\n').map(row => {
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
      }).join('');
      return `<table><thead><tr>${ths}</tr></thead><tbody>${bodyRows}</tbody></table>`;
    });

    // Headers
    html = html.replace(/^### (.+)$/gim, '<h3>$1</h3>');
    html = html.replace(/^#### (.+)$/gim, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gim, '<h3>$1</h3>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // HR
    html = html.replace(/^---$/gm, '<hr>');

    // Lists
    html = html.replace(/^[\s]*[-*]\s+(.+)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // Blockquote
    html = html.replace(/^&gt; (.+)$/gim, '<blockquote>$1</blockquote>');

    // Paragraphs
    const parts = html.split(/\n\n+/);
    html = parts.map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<table') || p.startsWith('<hr') || p.startsWith('<blockquote')) return p;
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
  },

  // ==========================================================================
  // Utils
  // ==========================================================================
  _resetState() {
    this.state = { studyHours: 2, prepDays: 7, examDate: '', preferredTime: 'morning', subjects: [], goals: '' };

    // Reset UI
    const slider  = document.getElementById('studyHoursRange');
    const display = document.getElementById('hoursDisplay');
    const prepInp = document.getElementById('prepDaysInput');
    const examInp = document.getElementById('examDateInput');
    const goalInp = document.getElementById('goalsInput');

    if (slider)  { slider.value = 2; slider.style.setProperty('--range-pct', '15%'); }
    if (display) display.innerHTML = '2 <span>hours / day</span>';
    if (prepInp) prepInp.value = 7;
    if (examInp) examInp.value = '';
    if (goalInp) goalInp.value = '';

    // Reset time pill selection
    document.querySelectorAll('.time-pill').forEach(p => {
      p.classList.toggle('selected', p.getAttribute('data-time') === 'morning');
    });

    this._renderSubjectsList();
  },

  _esc(str) {
    return StudySyncApp.escapeHtml(str);
  }
};
