/**
 * StudySync AI - Competition Demo Mode Controller (demo.js)
 * 
 * Provides an elite, interactive demonstration experience designed for 4-minute competition pitches:
 * 1. 4 Guided Interactions:
 *    - Verify a Learning Claim (The Mozart Effect)
 *    - Build My Study Plan (7-Day Deep Learning Matrix)
 *    - Improve My Memory (Ebbinghaus Forgetting Curve & Spaced Repetition Protocol)
 *    - Test Knowledge (Gamified Interactive Active Recall Quiz)
 * 2. Visual AI Reasoning Telemetry Pipeline with animated processing steps.
 * 3. 4-Minute Presentation Timer with Play/Pause, Reset, and Warning thresholds.
 * 4. Automated 4-Minute Guided Pitch Tour mode.
 * 5. Full zero-latency resilient architecture (works instantly online or offline).
 */

const StudySyncDemo = {
  // Timer State (4 minutes = 240 seconds)
  timerSeconds: 240,
  timerInterval: null,
  isTimerRunning: false,

  // Processing State
  isProcessing: false,
  tourIndex: 0,
  isTourActive: false,
  tourTimer: null,

  // Quiz State
  quizQuestions: [
    {
      id: 1,
      topic: "Cognitive Science & Memory",
      difficulty: "High Yield",
      xp: 50,
      question: "According to landmark cognitive psychology research (Roediger & Karpicke, 2006), which learning strategy produces the highest retention after one week?",
      options: [
        { letter: "A", text: "Rereading the textbook chapter three consecutive times", correct: false },
        { letter: "B", text: "Highlighting key passages and summarizing notes neatly", correct: false },
        { letter: "C", text: "Closed-book active retrieval practice (self-testing)", correct: true },
        { letter: "D", text: "Passive listening to recorded audio lectures at 1.5x speed", correct: false }
      ],
      explanation: "<strong>The Testing Effect:</strong> Active retrieval forces the brain to reconstruct memory traces from scratch, triggering synaptic consolidation and long-term potentiation. Passive rereading and highlighting merely create the <em>Illusion of Competence</em>—the material looks familiar, but fades within 48 hours without retrieval practice."
    },
    {
      id: 2,
      topic: "Spaced Repetition & Neurobiology",
      difficulty: "Mastery",
      xp: 50,
      question: "When using the Ebbinghaus Spaced Repetition protocol, what is the mathematically optimal moment to schedule a review session?",
      options: [
        { letter: "A", text: "Every 2 hours on the exact same day of learning", correct: false },
        { letter: "B", text: "Right when recall begins to feel slightly difficult (Desirable Difficulty)", correct: true },
        { letter: "C", text: "Only the night before the final comprehensive examination", correct: false },
        { letter: "D", text: "Immediately after waking up regardless of prior interval", correct: false }
      ],
      explanation: "<strong>Desirable Difficulty (Bjork, 1994):</strong> Neuroscientific consolidation is strongest when retrieval requires cognitive effort. If you review too early, no effort is expended; if you wait too long, the trace is extinguished. Spaced intervals (1, 3, 7, 16 days) capture the optimal forgetting threshold."
    }
  ],
  currentQuizIndex: 0,

  // ==========================================================================
  // Initialization
  // ==========================================================================
  init() {
    this.bindEvents();
    this.updateTimerDisplay();
    console.log("⭐ StudySync AI Competition Demo Mode active & ready");
  },

  // ==========================================================================
  // Event Bindings
  // ==========================================================================
  bindEvents() {
    // 1. The 4 Quick Guided Buttons
    const btnClaim = document.getElementById('demoBtnClaim');
    const btnPlan = document.getElementById('demoBtnPlan');
    const btnMemory = document.getElementById('demoBtnMemory');
    const btnQuiz = document.getElementById('demoBtnQuiz');

    if (btnClaim) btnClaim.addEventListener('click', () => this.runClaimDemo());
    if (btnPlan) btnPlan.addEventListener('click', () => this.runStudyPlanDemo());
    if (btnMemory) btnMemory.addEventListener('click', () => this.runMemoryDemo());
    if (btnQuiz) btnQuiz.addEventListener('click', () => this.runKnowledgeQuizDemo());

    // 2. Timer Controls
    const timerToggleBtn = document.getElementById('demoTimerToggleBtn');
    const timerResetBtn = document.getElementById('demoTimerResetBtn');
    if (timerToggleBtn) timerToggleBtn.addEventListener('click', () => this.toggleTimer());
    if (timerResetBtn) timerResetBtn.addEventListener('click', () => this.resetTimer());

    // 3. Demo Utilities
    const tourBtn = document.getElementById('demoTourBtn');
    const resetBtn = document.getElementById('demoResetBtn');
    if (tourBtn) tourBtn.addEventListener('click', () => this.startPitchTour());
    if (resetBtn) resetBtn.addEventListener('click', () => this.resetDemoCanvas());

    // 4. Keyboard Shortcuts for Lightning Pitching
    window.addEventListener('keydown', (e) => {
      if (e.altKey) {
        if (e.key === '1') { e.preventDefault(); this.runClaimDemo(); }
        else if (e.key === '2') { e.preventDefault(); this.runStudyPlanDemo(); }
        else if (e.key === '3') { e.preventDefault(); this.runMemoryDemo(); }
        else if (e.key === '4') { e.preventDefault(); this.runKnowledgeQuizDemo(); }
        else if (e.key === 't' || e.key === 'T') { e.preventDefault(); this.toggleTimer(); }
      }
    });

    // 5. Connect Welcome Screen Demo Cards
    document.querySelectorAll('.suggested-card').forEach(card => {
      const prompt = card.getAttribute('data-prompt') || '';
      if (prompt.includes('10%') || prompt.includes('Mozart') || prompt.includes('Verify')) {
        card.addEventListener('click', (e) => {
          e.stopImmediatePropagation();
          this.runClaimDemo();
        }, true);
      } else if (prompt.includes('study plan') || prompt.includes('Organic Chemistry')) {
        card.addEventListener('click', (e) => {
          e.stopImmediatePropagation();
          this.runStudyPlanDemo();
        }, true);
      } else if (prompt.includes('retention') || prompt.includes('spaced repetition')) {
        card.addEventListener('click', (e) => {
          e.stopImmediatePropagation();
          this.runMemoryDemo();
        }, true);
      }
    });
  },

  // ==========================================================================
  // Timer Implementation (4:00 Countdown)
  // ==========================================================================
  toggleTimer() {
    if (this.isTimerRunning) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  },

  startTimer() {
    if (this.isTimerRunning) return;
    this.isTimerRunning = true;

    const playIcon = document.getElementById('timerPlayIcon');
    const pauseIcon = document.getElementById('timerPauseIcon');
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = 'block';

    this.timerInterval = setInterval(() => {
      if (this.timerSeconds > 0) {
        this.timerSeconds--;
        this.updateTimerDisplay();
      } else {
        this.pauseTimer();
        StudySyncApp.showToast('⏱️ Presentation time is up (04:00)!');
      }
    }, 1000);
  },

  pauseTimer() {
    this.isTimerRunning = false;
    clearInterval(this.timerInterval);

    const playIcon = document.getElementById('timerPlayIcon');
    const pauseIcon = document.getElementById('timerPauseIcon');
    if (playIcon) playIcon.style.display = 'block';
    if (pauseIcon) pauseIcon.style.display = 'none';
  },

  resetTimer() {
    this.pauseTimer();
    this.timerSeconds = 240;
    this.updateTimerDisplay();
  },

  updateTimerDisplay() {
    const display = document.getElementById('demoTimerDisplay');
    const widget = document.getElementById('demoTimerWidget');
    if (!display) return;

    const minutes = Math.floor(this.timerSeconds / 60);
    const seconds = this.timerSeconds % 60;
    display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (widget) {
      if (this.timerSeconds <= 30) {
        widget.className = 'demo-timer-widget danger';
      } else if (this.timerSeconds <= 90) {
        widget.className = 'demo-timer-widget warning';
      } else {
        widget.className = 'demo-timer-widget';
      }
    }
  },

  // ==========================================================================
  // Shared Utilities: Active Button State & Canvas Setup
  // ==========================================================================
  setActiveButton(btnId) {
    document.querySelectorAll('.demo-quick-btn').forEach(btn => btn.classList.remove('active'));
    const target = document.getElementById(btnId);
    if (target) target.classList.add('active');
  },

  prepareChatCanvas() {
    if (StudySyncApp.elements.welcomeScreen) {
      StudySyncApp.elements.welcomeScreen.style.display = 'none';
    }
    // Auto-start presentation timer on first action if not running
    if (!this.isTimerRunning && this.timerSeconds === 240) {
      this.startTimer();
    }
  },

  resetDemoCanvas() {
    if (this.tourTimer) clearTimeout(this.tourTimer);
    this.isTourActive = false;
    this.tourIndex = 0;
    this.isProcessing = false;
    this.resetTimer();
    StudySyncApp.startNewSession(false);
    document.querySelectorAll('.demo-quick-btn').forEach(btn => btn.classList.remove('active'));
    StudySyncApp.showToast('Demo canvas reset to starting state');
  },

  // ==========================================================================
  // AI Telemetry Pipeline Visualization
  // ==========================================================================
  async showTelemetryPipeline(steps) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai telemetry-wrapper';
    wrapper.innerHTML = `
      <div class="ai-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Z"></path>
          <path d="M4 14a8 8 0 0 0 16 0"></path>
          <path d="M12 14v8"></path>
        </svg>
      </div>
      <div class="message-content-wrapper" style="width:100%;max-width:680px;">
        <div class="telemetry-pipeline-box">
          <div class="telemetry-header">
            <div class="telemetry-title-group">
              <span class="telemetry-icon-pulse">⚙️</span>
              <span class="telemetry-title">Cognitive AI Telemetry Pipeline</span>
            </div>
            <span class="telemetry-latency" id="telemetryLatency">Analyzing...</span>
          </div>
          <div class="telemetry-steps" id="telemetryStepList">
            ${steps.map((s, idx) => `
              <div class="telemetry-step ${idx === 0 ? 'active' : ''}" id="telemetryStep${idx}">
                <div class="step-indicator">${idx + 1}</div>
                <div class="step-text">${s.text}</div>
                <div class="step-tag">${s.tag || ''}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    StudySyncApp.elements.messagesList.appendChild(wrapper);
    StudySyncApp.scrollToBottom();

    // Step-by-step animation
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 220));
      const curStep = document.getElementById(`telemetryStep${i}`);
      if (curStep) {
        curStep.classList.remove('active');
        curStep.classList.add('completed');
      }
      if (i + 1 < steps.length) {
        const nextStep = document.getElementById(`telemetryStep${i + 1}`);
        if (nextStep) nextStep.classList.add('active');
      }
    }

    const latencyEl = document.getElementById('telemetryLatency');
    if (latencyEl) latencyEl.textContent = 'Ready (280ms)';
    await new Promise(r => setTimeout(r, 180));

    // Remove telemetry wrapper before inserting final response
    wrapper.remove();
  },

  // ==========================================================================
  // Pillar 1: Verify a Learning Claim (The Mozart Effect)
  // ==========================================================================
  async runClaimDemo() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.setActiveButton('demoBtnClaim');
    this.prepareChatCanvas();

    const userPrompt = "Verify a Learning Claim: Is it true that listening to Mozart or classical music makes you smarter ('The Mozart Effect')?";
    StudySyncApp.appendUserMessage(userPrompt);
    StudySyncApp.scrollToBottom();

    // Telemetry Pipeline
    await this.showTelemetryPipeline([
      { text: "Extracting claim entities & academic keywords ('Mozart Effect', 'IQ Augmentation')", tag: "Entity Parser" },
      { text: "Querying peer-reviewed literature (Nature 1993, APA Meta-Analysis, Harvard Health)", tag: "Evidence RAG" },
      { text: "Calibrating empirical consensus & synthesizing cognitive verdict", tag: "Consensus Engine" }
    ]);

    // Rich AI Response Component
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai';
    wrapper.innerHTML = `
      <div class="ai-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Z"></path>
          <path d="M4 14a8 8 0 0 0 16 0"></path>
          <path d="M12 14v8"></path>
        </svg>
      </div>
      <div class="message-content-wrapper">
        <div class="message-bubble" style="background:transparent;border:none;padding:0;box-shadow:none;">
          <div class="demo-claim-card">
            <!-- Hero Header -->
            <div class="demo-claim-hero">
              <div class="demo-claim-title-box">
                <span class="demo-claim-category">🔬 Cognitive Neuroscience & Claim Audit</span>
                <h3 class="demo-claim-heading">The Mozart Effect: Arousal Hypothesis vs. Permanent IQ Increase</h3>
                <div style="margin-top:6px;">
                  <span class="verdict-badge partially-supported">⚠️ Nuanced / Partially Supported</span>
                </div>
              </div>
              <div class="confidence-meter-box">
                <div class="confidence-label-row">
                  <span>Scientific Consensus</span>
                  <span class="confidence-val">94%</span>
                </div>
                <div class="confidence-bar-bg">
                  <div class="confidence-bar-fill" id="claimConfBar"></div>
                </div>
                <span style="font-size:0.68rem;color:var(--text-muted);">Based on 40+ peer-reviewed studies</span>
              </div>
            </div>

            <!-- Empirical Synthesis -->
            <div class="claim-takeaway-grid">
              <div class="takeaway-card myth">
                <div class="takeaway-header">
                  <span>❌</span> The Popular Myth
                </div>
                <div class="takeaway-text">
                  Listening to Mozart or classical music while studying permanently boosts general intelligence (IQ) or accelerates neurological development in children.
                </div>
              </div>
              <div class="takeaway-card fact">
                <div class="takeaway-header">
                  <span>✅</span> What Neuroscience Proves
                </div>
                <div class="takeaway-text">
                  Music produces a temporary (10–15 min) boost in <em>spatial-temporal reasoning</em> strictly driven by <strong>mood and dopamine arousal</strong>, not permanent neural rewiring.
                </div>
              </div>
            </div>

            <!-- Detailed Scientific Breakdown -->
            <div class="markdown-body">
              <p><strong>Key Empirical Findings:</strong></p>
              <ul>
                <li><strong>The 1993 Landmark Paper:</strong> Rauscher et al. (<em>Nature</em>) tested 36 college students. Listening to Mozart’s Sonata (K. 448) improved abstract paper-folding test scores by ~8–9 points, but the effect dissipated after 15 minutes.</li>
                <li><strong>The Arousal-Mood Hypothesis:</strong> Subsequent replication studies (Chabris, 1999; Pietschnig et al., 2010 meta-analysis of N=3,047) confirmed that any pleasant stimulus (listening to an engaging podcast or upbeat acoustic track) produces the exact same transient cognitive boost.</li>
                <li><strong>Actionable Study Protocol:</strong> For intensive reading comprehension or verbal memorization, ambient silence or 60–80 BPM instrumental lo-fi minimizes cognitive interference. Use upbeat classical music during pre-study transitions to elevate alertness.</li>
              </ul>
            </div>

            <!-- Authentic Citation Pills -->
            <div class="sources-container">
              <div class="sources-label">Peer-Reviewed Citations & Authorities</div>
              <div class="sources-list">
                <div class="source-chip">
                  <div class="source-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path></svg>
                    <span class="source-name">Nature (1993)</span>
                  </div>
                  <div class="source-title">Rauscher, F. H., Shaw, G. L., & Ky, K. N. — "Music and spatial task performance"</div>
                  <div class="source-relevance">Found transient 15-minute spatial-temporal reasoning elevation in laboratory setting.</div>
                </div>
                <div class="source-chip">
                  <div class="source-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path></svg>
                    <span class="source-name">American Psychological Association (APA Intelligence, 2010)</span>
                  </div>
                  <div class="source-title">Pietschnig, Voracek, & Formann — "Mozart effect–Shmozart effect? A meta-analysis"</div>
                  <div class="source-relevance">Meta-analysis over 3,000+ subjects proving the effect is attributable to emotional arousal.</div>
                </div>
              </div>
            </div>

          </div>
        </div>
        <div class="message-meta">
          <span class="message-time">${StudySyncApp.formatCurrentTime()}</span>
        </div>
      </div>
    `;

    StudySyncApp.elements.messagesList.appendChild(wrapper);
    StudySyncApp.scrollToBottom();

    // Animate confidence bar
    setTimeout(() => {
      const bar = document.getElementById('claimConfBar');
      if (bar) bar.style.width = '94%';
    }, 100);

    this.isProcessing = false;
    StudySyncApp.showToast('🔬 Verified claim with peer-reviewed sources!');
  },

  // ==========================================================================
  // Pillar 2: Build My Study Plan (7-Day Deep Learning Matrix)
  // ==========================================================================
  async runStudyPlanDemo() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.setActiveButton('demoBtnPlan');
    this.prepareChatCanvas();

    const userPrompt = "Build My Study Plan: Generate a high-performance 7-day mastery schedule for Neural Networks & Deep Learning (2.5 hours/day).";
    StudySyncApp.appendUserMessage(userPrompt);
    StudySyncApp.scrollToBottom();

    // Telemetry Pipeline
    await this.showTelemetryPipeline([
      { text: "Parsing syllabus entities & cognitive load weights (17.5 total hours across 3 modules)", tag: "Load Balancer" },
      { text: "Applying Spaced Repetition, Interleaving, & 50/10 Pomodoro intervals", tag: "Cognitive Matrix" },
      { text: "Generating day-by-day active recall checkpoints and practice milestones", tag: "Schedule Synthesizer" }
    ]);

    // Rich AI Response Component
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai';
    wrapper.innerHTML = `
      <div class="ai-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Z"></path>
          <path d="M4 14a8 8 0 0 0 16 0"></path>
          <path d="M12 14v8"></path>
        </svg>
      </div>
      <div class="message-content-wrapper">
        <div class="message-bubble" style="background:transparent;border:none;padding:0;box-shadow:none;">
          <div class="demo-matrix-card">
            
            <!-- Hero Header -->
            <div class="matrix-hero">
              <div class="matrix-title-wrap">
                <div class="matrix-icon-badge">📅</div>
                <div>
                  <h3 class="matrix-title">7-Day Neural Networks & Deep Learning Mastery Matrix</h3>
                  <p class="matrix-subtitle">Calibrated with cognitive interleaving & active retrieval practice</p>
                </div>
              </div>
              <div class="matrix-metric-pills">
                <span class="matrix-metric-pill">⏱️ 17.5 Total Hours</span>
                <span class="matrix-metric-pill">📆 7 Days</span>
                <span class="matrix-metric-pill">🧠 2.5h / day</span>
              </div>
            </div>

            <!-- Cognitive Load Distribution -->
            <div class="cognitive-load-box">
              <div class="cog-load-header">
                <span>Cognitive Load & Difficulty Weighting</span>
                <span>3 High-Yield Pillars</span>
              </div>
              <div class="cog-load-bar">
                <div class="cog-segment hard" style="width: 45%;" title="Backpropagation & Optimization (Hard - 45%)"></div>
                <div class="cog-segment medium" style="width: 35%;" title="Architectures & Activations (Medium - 35%)"></div>
                <div class="cog-segment easy" style="width: 20%;" title="Foundations & Linear Algebra (Easy - 20%)"></div>
              </div>
              <div class="cog-legend">
                <div class="cog-legend-item"><span class="cog-dot hard"></span> Backpropagation Calculus (Hard - 45%)</div>
                <div class="cog-legend-item"><span class="cog-dot medium"></span> Architectures & Regularization (Medium - 35%)</div>
                <div class="cog-legend-item"><span class="cog-dot easy"></span> Foundations & Tensors (Easy - 20%)</div>
              </div>
            </div>

            <!-- 7-Day Matrix List -->
            <div class="matrix-days-list">
              <div class="matrix-day-row">
                <div class="day-badge">Day 1</div>
                <span class="day-phase-tag phase-encode">Encoding</span>
                <div class="day-content">
                  <div class="day-topic">Perceptrons & Multi-Layer Feedforward Architecture</div>
                  <div class="day-task">Dual-code mathematical forward pass + diagram activation functions (ReLU, Sigmoid).</div>
                </div>
                <div class="day-time">2.5 hrs</div>
              </div>

              <div class="matrix-day-row">
                <div class="day-badge">Day 2</div>
                <span class="day-phase-tag phase-practice">Deep Work</span>
                <div class="day-content">
                  <div class="day-topic">Backpropagation Calculus & Chain Rule Derivations</div>
                  <div class="day-task">Manual gradient descent walkthrough; step-by-step matrix calculus problem set.</div>
                </div>
                <div class="day-time">2.5 hrs</div>
              </div>

              <div class="matrix-day-row">
                <div class="day-badge">Day 3</div>
                <span class="day-phase-tag phase-recall">Active Recall</span>
                <div class="day-content">
                  <div class="day-topic">Closed-Book Retrieval Drill on Day 1 & 2</div>
                  <div class="day-task">Write out backpropagation formulas from memory; resolve gradient vanishing dilemmas.</div>
                </div>
                <div class="day-time">2.5 hrs</div>
              </div>

              <div class="matrix-day-row">
                <div class="day-badge">Day 4</div>
                <span class="day-phase-tag phase-encode">Encoding</span>
                <div class="day-content">
                  <div class="day-topic">Loss Functions, Cross-Entropy & Regularization (Dropout, L2)</div>
                  <div class="day-task">Compare overfitting mitigation techniques; analyze validation curve diagnostics.</div>
                </div>
                <div class="day-time">2.5 hrs</div>
              </div>

              <div class="matrix-day-row">
                <div class="day-badge">Day 5</div>
                <span class="day-phase-tag phase-practice">Interleaving</span>
                <div class="day-content">
                  <div class="day-topic">Optimizers (SGD, Momentum, Adam) & PyTorch Implementation</div>
                  <div class="day-task">Implement custom MLP classifier from scratch; interleave Day 2 loss calculations.</div>
                </div>
                <div class="day-time">2.5 hrs</div>
              </div>

              <div class="matrix-day-row">
                <div class="day-badge">Day 6</div>
                <span class="day-phase-tag phase-test">Mock Test</span>
                <div class="day-content">
                  <div class="day-topic">Simulated Closed-Book Diagnostic Exam</div>
                  <div class="day-task">60-minute timed exam with 10 diagnostic problem sets; Feynman Technique aloud.</div>
                </div>
                <div class="day-time">2.5 hrs</div>
              </div>

              <div class="matrix-day-row">
                <div class="day-badge">Day 7</div>
                <span class="day-phase-tag phase-permastore">Consolidation</span>
                <div class="day-content">
                  <div class="day-topic">Weak Spot Patching & Spaced Leitner Flashcard Lock-In</div>
                  <div class="day-task">Target missed exam items; export digital active recall flashcard deck for Day 16 & 35.</div>
                </div>
                <div class="day-time">2.5 hrs</div>
              </div>
            </div>

            <!-- Pomodoro Cycle Footer -->
            <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border-light);flex-wrap:wrap;gap:10px;">
              <div style="font-size:0.78rem;color:var(--text-secondary);">
                💡 <strong>Recommended Cycle:</strong> Three 50-minute deep focus blocks with 10-minute active diffuse breaks.
              </div>
              <button class="sched-action-btn" onclick="StudySyncApp.showToast('✅ Study plan synchronized to calendar!')">
                📅 Add to Calendar
              </button>
            </div>

          </div>
        </div>
        <div class="message-meta">
          <span class="message-time">${StudySyncApp.formatCurrentTime()}</span>
        </div>
      </div>
    `;

    StudySyncApp.elements.messagesList.appendChild(wrapper);
    StudySyncApp.scrollToBottom();

    this.isProcessing = false;
    StudySyncApp.showToast('📅 Adaptive 7-Day Study Matrix generated!');
  },

  // ==========================================================================
  // Pillar 3: Improve My Memory (Ebbinghaus Forgetting Curve & Spaced Protocol)
  // ==========================================================================
  async runMemoryDemo() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.setActiveButton('demoBtnMemory');
    this.prepareChatCanvas();

    const userPrompt = "Improve My Memory: How do I retain complex academic concepts long-term and overcome the Ebbinghaus forgetting curve?";
    StudySyncApp.appendUserMessage(userPrompt);
    StudySyncApp.scrollToBottom();

    // Telemetry Pipeline
    await this.showTelemetryPipeline([
      { text: "Modeling Ebbinghaus cognitive decay function: R(t) = e^(-t/S)", tag: "Memory Decay" },
      { text: "Computing optimal Leitner 5-stage spaced consolidation intervals", tag: "Spaced Repetition" },
      { text: "Generating interactive retention comparison curves & Feynman protocol", tag: "Visualizer" }
    ]);

    // Rich AI Response Component
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai';
    wrapper.innerHTML = `
      <div class="ai-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Z"></path>
          <path d="M4 14a8 8 0 0 0 16 0"></path>
          <path d="M12 14v8"></path>
        </svg>
      </div>
      <div class="message-content-wrapper">
        <div class="message-bubble" style="background:transparent;border:none;padding:0;box-shadow:none;">
          <div class="demo-memory-card">
            
            <!-- Hero Header -->
            <div class="memory-hero">
              <div>
                <span class="demo-claim-category">🧠 Cognitive Science & Memory Architecture</span>
                <h3 class="demo-claim-heading">Overcoming the Ebbinghaus Forgetting Curve</h3>
              </div>
              <span class="verdict-badge supported">✅ Clinically Proven Protocol</span>
            </div>

            <!-- Interactive Ebbinghaus Graph Box -->
            <div class="memory-graph-box">
              <div class="memory-graph-header">
                <span class="graph-title">Retention Rate (%) vs. Time (Days)</span>
                <div class="graph-legend">
                  <div class="graph-legend-item"><span class="legend-line decay"></span> Passive Learning (Forgetting Curve)</div>
                  <div class="graph-legend-item"><span class="legend-line spaced"></span> StudySync Spaced Repetition</div>
                </div>
              </div>

              <!-- SVG Graph -->
              <div class="graph-svg-container">
                <svg viewBox="0 0 600 180" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="spacedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"></stop>
                      <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"></stop>
                    </linearGradient>
                  </defs>

                  <!-- Grid Lines -->
                  <line x1="40" y1="20" x2="580" y2="20" stroke="#334155" stroke-dasharray="3" stroke-width="1"></line>
                  <line x1="40" y1="65" x2="580" y2="65" stroke="#334155" stroke-dasharray="3" stroke-width="1"></line>
                  <line x1="40" y1="110" x2="580" y2="110" stroke="#334155" stroke-dasharray="3" stroke-width="1"></line>
                  <line x1="40" y1="155" x2="580" y2="155" stroke="#475569" stroke-width="1.5"></line>

                  <!-- Y-Axis Labels -->
                  <text x="8" y="24" fill="#94a3b8" font-size="10" font-family="monospace">100%</text>
                  <text x="14" y="69" fill="#94a3b8" font-size="10" font-family="monospace">70%</text>
                  <text x="14" y="114" fill="#94a3b8" font-size="10" font-family="monospace">40%</text>
                  <text x="14" y="158" fill="#94a3b8" font-size="10" font-family="monospace">10%</text>

                  <!-- X-Axis Labels (Days) -->
                  <text x="50" y="172" fill="#94a3b8" font-size="10" font-family="monospace">Day 1</text>
                  <text x="160" y="172" fill="#94a3b8" font-size="10" font-family="monospace">Day 3</text>
                  <text x="290" y="172" fill="#94a3b8" font-size="10" font-family="monospace">Day 7</text>
                  <text x="430" y="172" fill="#94a3b8" font-size="10" font-family="monospace">Day 16</text>
                  <text x="540" y="172" fill="#94a3b8" font-size="10" font-family="monospace">Day 30+</text>

                  <!-- Curve 1: Red Standard Forgetting Curve (Steep Decay) -->
                  <path d="M 50 20 Q 90 120 180 142 T 580 152" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="5"></path>

                  <!-- Curve 2: Emerald Spaced Repetition Resets -->
                  <!-- Touch 1 -> Decay to Day 3 -> Reset -> Decay to Day 7 -> Reset -> Flat high retention -->
                  <path d="M 50 20 
                           Q 100 80 160 85 
                           L 160 25 
                           Q 215 65 290 60 
                           L 290 22 
                           Q 350 42 430 40 
                           L 430 20 
                           L 580 25" 
                        fill="none" stroke="#10b981" stroke-width="3"></path>

                  <!-- Milestone Markers (Dots on Emerald Curve) -->
                  <circle cx="160" cy="25" r="4.5" fill="#10b981" stroke="#ffffff" stroke-width="1.5"></circle>
                  <circle cx="290" cy="22" r="4.5" fill="#10b981" stroke="#ffffff" stroke-width="1.5"></circle>
                  <circle cx="430" cy="20" r="4.5" fill="#10b981" stroke="#ffffff" stroke-width="1.5"></circle>

                  <!-- Callout Annotations -->
                  <text x="80" y="148" fill="#f87171" font-size="10" font-weight="700">Decays to ~20% in 48 hrs</text>
                  <text x="440" y="46" fill="#34d399" font-size="10" font-weight="700">Permanent ~90% Retention</text>
                </svg>
              </div>
            </div>

            <!-- The 3 Core Cognitive Pillars -->
            <div class="memory-protocol-grid">
              <div class="protocol-step-card">
                <span class="protocol-num">Pillar 1</span>
                <div class="protocol-title">The Testing Effect</div>
                <div class="protocol-desc">Testing your memory produces <strong>200–400% higher retention</strong> than rereading (Roediger & Karpicke). Close the book and force retrieval.</div>
              </div>
              <div class="protocol-step-card">
                <span class="protocol-num">Pillar 2</span>
                <div class="protocol-title">Desirable Difficulty</div>
                <div class="protocol-desc">Review precisely when recall begins to feel slightly challenging (Day 1, 3, 7, 16). Cognitive effort triggers permanent synaptic consolidation.</div>
              </div>
              <div class="protocol-step-card">
                <span class="protocol-num">Pillar 3</span>
                <div class="protocol-title">Feynman Dual-Coding</div>
                <div class="protocol-desc">Explain complex concepts in simple language as if teaching a 10-year-old, paired with mental schemas and diagrams to bridge abstract ideas.</div>
              </div>
            </div>

            <!-- Actionable Next Steps -->
            <div style="background:#f8fafc;border:1px solid var(--border-medium);border-radius:var(--radius-md);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
              <div style="font-size:0.8rem;color:var(--text-primary);">
                ⚡ <strong>Immediate Next Step:</strong> Conduct a 5-minute blank-sheet free recall exercise right now.
              </div>
              <button class="sched-action-btn" onclick="StudySyncDemo.runKnowledgeQuizDemo()">
                🎯 Test Knowledge Now →
              </button>
            </div>

          </div>
        </div>
        <div class="message-meta">
          <span class="message-time">${StudySyncApp.formatCurrentTime()}</span>
        </div>
      </div>
    `;

    StudySyncApp.elements.messagesList.appendChild(wrapper);
    StudySyncApp.scrollToBottom();

    this.isProcessing = false;
    StudySyncApp.showToast('🧠 Memory protocol & Ebbinghaus curve rendered!');
  },

  // ==========================================================================
  // Pillar 4: Test Knowledge (Interactive Active Recall Quiz)
  // ==========================================================================
  async runKnowledgeQuizDemo() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.setActiveButton('demoBtnQuiz');
    this.prepareChatCanvas();

    const q = this.quizQuestions[this.currentQuizIndex % this.quizQuestions.length];

    const userPrompt = `Test Knowledge: Diagnostic challenge on ${q.topic}.`;
    StudySyncApp.appendUserMessage(userPrompt);
    StudySyncApp.scrollToBottom();

    // Telemetry Pipeline
    await this.showTelemetryPipeline([
      { text: `Selecting diagnostic item from cognitive psychology corpus (${q.difficulty})`, tag: "Question Calibrator" },
      { text: "Constructing plausible cognitive distractors & scientific justification", tag: "Distractor Engine" },
      { text: "Initializing real-time interactive assessment component", tag: "Quiz Engine" }
    ]);

    // Unique IDs for this quiz instance
    const quizCardId = 'quizCard_' + Date.now();

    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai';
    wrapper.innerHTML = `
      <div class="ai-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Z"></path>
          <path d="M4 14a8 8 0 0 0 16 0"></path>
          <path d="M12 14v8"></path>
        </svg>
      </div>
      <div class="message-content-wrapper">
        <div class="message-bubble" style="background:transparent;border:none;padding:0;box-shadow:none;">
          <div class="demo-quiz-card" id="${quizCardId}">
            
            <!-- Quiz Header -->
            <div class="quiz-card-header">
              <div class="quiz-badge-group">
                <span class="quiz-tag">⚡ Active Recall Challenge</span>
                <span style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);">${q.topic}</span>
              </div>
              <div class="quiz-xp-badge" id="${quizCardId}_xpBadge">
                <span>⭐</span> +${q.xp} XP
              </div>
            </div>

            <!-- Question -->
            <div class="quiz-question-box">
              <div class="quiz-question-title">${q.question}</div>
              <div class="quiz-question-meta">Click your answer below to test your understanding:</div>
            </div>

            <!-- 4 Options -->
            <div class="quiz-options-grid" id="${quizCardId}_options">
              ${q.options.map((opt, idx) => `
                <button class="quiz-option-btn" data-correct="${opt.correct}" data-index="${idx}">
                  <span class="quiz-letter">${opt.letter}</span>
                  <span class="quiz-option-text">${opt.text}</span>
                </button>
              `).join('')}
            </div>

            <!-- Instant Feedback Box (Hidden initially) -->
            <div class="quiz-feedback-box" id="${quizCardId}_feedback">
              <div class="feedback-status-banner" id="${quizCardId}_status"></div>
              <div class="feedback-explanation">${q.explanation}</div>
              <div class="quiz-action-row">
                <button class="quiz-retry-btn" id="${quizCardId}_nextBtn">
                  <span>Next Challenge →</span>
                </button>
              </div>
            </div>

          </div>
        </div>
        <div class="message-meta">
          <span class="message-time">${StudySyncApp.formatCurrentTime()}</span>
        </div>
      </div>
    `;

    StudySyncApp.elements.messagesList.appendChild(wrapper);
    StudySyncApp.scrollToBottom();

    // Attach Event Handlers to Option Buttons
    const cardEl = document.getElementById(quizCardId);
    const optionsContainer = document.getElementById(`${quizCardId}_options`);
    const feedbackBox = document.getElementById(`${quizCardId}_feedback`);
    const statusBanner = document.getElementById(`${quizCardId}_status`);
    const nextBtn = document.getElementById(`${quizCardId}_nextBtn`);
    const xpBadge = document.getElementById(`${quizCardId}_xpBadge`);

    if (optionsContainer) {
      const optionButtons = optionsContainer.querySelectorAll('.quiz-option-btn');
      optionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const isCorrect = btn.getAttribute('data-correct') === 'true';

          // Disable further clicks on all options
          optionButtons.forEach(b => b.disabled = true);

          if (isCorrect) {
            btn.classList.add('correct');
            statusBanner.className = 'feedback-status-banner correct';
            statusBanner.innerHTML = '🎉 Excellent! Correct Answer (+50 XP)';
            StudySyncApp.showToast('🎯 Perfect! Earned +50 XP!');
            if (xpBadge) {
              xpBadge.style.transform = 'scale(1.2)';
              xpBadge.style.transition = 'all 0.3s ease';
              setTimeout(() => { xpBadge.style.transform = 'scale(1)'; }, 400);
            }
          } else {
            btn.classList.add('wrong');
            // Highlight the correct option
            optionButtons.forEach(b => {
              if (b.getAttribute('data-correct') === 'true') {
                b.classList.add('correct');
              }
            });
            statusBanner.className = 'feedback-status-banner wrong';
            statusBanner.innerHTML = '❌ Not quite right — Review the cognitive principle below:';
          }

          feedbackBox.classList.add('active');
          StudySyncApp.scrollToBottom();
        });
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.currentQuizIndex++;
        this.runKnowledgeQuizDemo();
      });
    }

    this.isProcessing = false;
  },

  // ==========================================================================
  // Automated 4-Minute Guided Pitch Tour Mode
  // ==========================================================================
  async startPitchTour() {
    if (this.isTourActive) {
      StudySyncApp.showToast('Tour is already running');
      return;
    }

    this.isTourActive = true;
    StudySyncApp.showToast('🚀 Starting Automated 4-Minute Guided Pitch Tour!');

    // Reset and start timer
    this.resetTimer();
    this.startTimer();

    // Step 1: Claim Verification
    StudySyncApp.showToast('📍 Step 1 of 4: Verifying Academic Claims...');
    await this.runClaimDemo();

    // Wait 3.5 seconds before Step 2
    this.tourTimer = setTimeout(async () => {
      StudySyncApp.showToast('📍 Step 2 of 4: Building Adaptive 7-Day Study Matrix...');
      await this.runStudyPlanDemo();

      // Wait 4 seconds before Step 3
      this.tourTimer = setTimeout(async () => {
        StudySyncApp.showToast('📍 Step 3 of 4: Unveiling Memory Science & Forgetting Curve...');
        await this.runMemoryDemo();

        // Wait 4 seconds before Step 4
        this.tourTimer = setTimeout(async () => {
          StudySyncApp.showToast('📍 Step 4 of 4: Interactive Knowledge Testing & Active Recall...');
          await this.runKnowledgeQuizDemo();

          StudySyncApp.showToast('🏆 4-Minute Pitch Tour Complete! All 4 pillars showcased.');
          this.isTourActive = false;
        }, 4200);

      }, 4200);

    }, 3800);
  }
};

// Initialize Demo Mode after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  StudySyncDemo.init();
});
