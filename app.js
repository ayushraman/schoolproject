// ========================================
// Dalimms ChatBot - AI Knowledge Assistant
// Author: Turab Haider
// ========================================

class DalimmsChatBot {
    constructor() {
        // DOM Elements
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.mascotStatus = document.getElementById('mascotStatus');
        this.avatarMouth = document.getElementById('avatarMouth');
        this.audioVisualizer = document.getElementById('audioVisualizer');
        this.summaryDisplay = document.getElementById('summaryDisplay');
        this.relatedTopics = document.getElementById('relatedTopics');
        this.topicList = document.getElementById('topicList');
        this.loadingBar = document.getElementById('loadingBar');
        this.articleTitle = document.getElementById('articleTitle');
        this.articleLink = document.getElementById('articleLink');
        this.neuralCanvas = document.getElementById('neuralCanvas');
        
        // Metrics Elements
        this.queriesCount = document.getElementById('queriesCount');
        this.wordsCount = document.getElementById('wordsCount');
        this.responseTime = document.getElementById('responseTime');
        this.dataStream = document.getElementById('dataStream');
        
        // State
        this.isProcessing = false;
        this.queryHistory = [];
        this.totalQueries = 0;
        this.totalWords = 0;
        
        // Voice Narration
        this.synth = window.speechSynthesis;
        this.currentUtterance = null;
        this.isSpeaking = false;
        this.voiceEnabled = true;
        this.selectedVoice = null;
        this.voiceRate = 1.0;
        this.voicePitch = 1.0;
        
        // Gesture support
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        
        // Initialize
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.startBackgroundAnimations();
        this.initNeuralGraph();
        this.updateClock();
        this.createParticles();
        this.initVoice();
        this.initGestures();
    }
    
    setupEventListeners() {
        // Send button click
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.handleQuery());
        } else {
            console.warn('Send button not found');
        }
        
        // Enter key press
        if (this.userInput) {
            this.userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleQuery();
                }
            });
            
            // Input focus effects
            this.userInput.addEventListener('focus', () => {
                this.setMascotStatus('LISTENING...');
            });
            
            this.userInput.addEventListener('blur', () => {
                if (!this.isProcessing && !this.isSpeaking) {
                    this.setMascotStatus('AWAITING INPUT');
                }
            });
        } else {
            console.warn('User input not found');
        }
        
        // Voice toggle button
        const voiceToggle = document.getElementById('voiceToggle');
        if (voiceToggle) {
            voiceToggle.addEventListener('click', () => this.toggleVoice());
        }
        
        // Stop speech button
        const stopSpeechBtn = document.getElementById('stopSpeech');
        if (stopSpeechBtn) {
            stopSpeechBtn.addEventListener('click', () => this.stopVoice());
        }
    }
    
    // ========================================
    // Query Handling
    // ========================================
    
    async handleQuery() {
        if (!this.userInput) return;
        
        const query = this.userInput.value.trim();
        
        if (!query || this.isProcessing) return;
        
        this.isProcessing = true;
        if (this.sendBtn) this.sendBtn.disabled = true;
        this.userInput.value = '';
        
        // Add user message
        this.addMessage(query, 'user');
        
        // Update UI states
        this.setMascotStatus('SEARCHING...');
        this.showLoading(true);
        
        const startTime = Date.now();
        
        try {
            // Fetch Wikipedia content
            const result = await this.fetchWikipedia(query);
            
            if (result.success) {
                this.setMascotStatus('ANALYZING...');
                await this.sleep(500);
                
                // Generate summary
                const summary = this.summarizeContent(result.content);
                
                // Add bot response with typing animation
                await this.addMessageWithAnimation(summary, 'bot');
                
                // Start voice narration AFTER text is displayed
                if (this.voiceEnabled && summary) {
                    this.speak(summary);
                }
                
                // Update displays
                this.updateSummaryPanel(summary, result.title, result.url);
                this.updateRelatedTopics(result.links);
                this.addToHistory(result.title);
                
                // Update metrics
                const responseTimeMs = Date.now() - startTime;
                this.updateMetrics(summary, responseTimeMs);
                
            } else {
                this.addMessage(`Unable to find information about "${query}". Please try a different topic.`, 'bot');
            }
            
        } catch (error) {
            console.error('Error:', error);
            this.addMessage('An error occurred while fetching data. Please try again.', 'bot');
        }
        
        // Reset states
        this.showLoading(false);
        this.isProcessing = false;
        if (this.sendBtn) this.sendBtn.disabled = false;
        
        // Only reset status if not speaking
        if (!this.isSpeaking) {
            this.stopSpeaking();
            this.setMascotStatus('AWAITING INPUT');
        }
    }
    
    // ========================================
    // Wikipedia API
    // ========================================
    
    async fetchWikipedia(query) {
        // First, search for the article
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
        
        try {
            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();
            
            if (!searchData.query.search.length) {
                return { success: false };
            }
            
            const pageTitle = searchData.query.search[0].title;
            
            // Fetch the page content
            const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=extracts|links&exintro=true&explaintext=true&pllimit=10&format=json&origin=*`;
            
            const contentResponse = await fetch(contentUrl);
            const contentData = await contentResponse.json();
            
            const pages = contentData.query.pages;
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];
            
            if (!page.extract) {
                return { success: false };
            }
            
            // Get related links
            const links = page.links ? page.links.slice(0, 5).map(l => l.title) : [];
            
            return {
                success: true,
                title: page.title,
                content: page.extract,
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
                links: links
            };
            
        } catch (error) {
            console.error('Wikipedia API Error:', error);
            return { success: false };
        }
    }
    
    // ========================================
    // Content Summarization
    // ========================================
    
    summarizeContent(content) {
        // Clean and split into sentences
        const sentences = content
            .replace(/\n/g, ' ')
            .split(/(?<=[.!?])\s+/)
            .filter(s => s.trim().length > 20);
        
        // Take first 3-5 sentences for summary
        const summaryLength = Math.min(5, Math.max(3, sentences.length));
        let summary = sentences.slice(0, summaryLength).join(' ');
        
        // Ensure it doesn't end mid-sentence
        if (summary.length > 500) {
            summary = summary.substring(0, 500);
            const lastPeriod = summary.lastIndexOf('.');
            if (lastPeriod > 300) {
                summary = summary.substring(0, lastPeriod + 1);
            }
        }
        
        return summary || 'No summary available for this topic.';
    }
    
    // ========================================
    // Message Handling
    // ========================================
    
    addMessage(content, type) {
        if (!this.chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const time = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${content}</p>
            </div>
            <span class="message-time">${type === 'user' ? 'You' : 'SP'} • ${time}</span>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    async addMessageWithAnimation(content, type) {
        if (!this.chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const time = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const contentP = document.createElement('p');
        
        messageDiv.innerHTML = `
            <div class="message-content"></div>
            <span class="message-time">SP • ${time}</span>
        `;
        
        messageDiv.querySelector('.message-content').appendChild(contentP);
        this.chatMessages.appendChild(messageDiv);
        
        // Animate text appearance
        await this.typeText(contentP, content);
        this.scrollToBottom();
    }
    
    async typeText(element, text) {
        const chars = text.split('');
        const speed = 15; // ms per character
        
        for (let i = 0; i < chars.length; i++) {
            element.textContent += chars[i];
            
            // Scroll as text appears
            if (i % 10 === 0) {
                this.scrollToBottom();
            }
            
            await this.sleep(speed);
        }
    }
    
    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
    
    // ========================================
    // UI Updates
    // ========================================
    
    setMascotStatus(status) {
        if (!this.mascotStatus) return;
        const statusText = this.mascotStatus.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = status;
        }
    }
    
    startSpeaking() {
        if (this.avatarMouth) this.avatarMouth.classList.add('speaking');
        if (this.audioVisualizer) this.audioVisualizer.classList.add('active');
    }
    
    stopSpeaking() {
        if (this.avatarMouth) this.avatarMouth.classList.remove('speaking');
        if (this.audioVisualizer) this.audioVisualizer.classList.remove('active');
    }
    
    showLoading(show) {
        if (!this.loadingBar) return;
        
        if (show) {
            this.loadingBar.classList.add('active');
            this.animateLoadingBar();
        } else {
            this.loadingBar.classList.remove('active');
            const progress = this.loadingBar.querySelector('.loading-progress');
            if (progress) progress.style.width = '0%';
        }
    }
    
    animateLoadingBar() {
        if (!this.loadingBar) return;
        
        const progress = this.loadingBar.querySelector('.loading-progress');
        if (!progress) return;
        
        let width = 0;
        
        const interval = setInterval(() => {
            if (!this.loadingBar.classList.contains('active')) {
                clearInterval(interval);
                return;
            }
            
            width += Math.random() * 15;
            if (width > 90) width = 90;
            progress.style.width = `${width}%`;
        }, 200);
    }
    
    updateSummaryPanel(summary, title, url) {
        if (this.summaryDisplay) {
            this.summaryDisplay.innerHTML = `<p class="summary-text">${summary}</p>`;
        }
        if (this.articleTitle) {
            this.articleTitle.textContent = title;
        }
        if (this.articleLink) {
            this.articleLink.href = url;
        }
    }
    
    updateRelatedTopics(links) {
        if (!this.relatedTopics) return;
        
        if (!links || links.length === 0) {
            this.relatedTopics.innerHTML = '<div class="topic-tag">No related topics</div>';
            return;
        }
        
        this.relatedTopics.innerHTML = links.map(link => 
            `<div class="topic-tag" data-topic="${link}">${link}</div>`
        ).join('');
        
        // Add click handlers
        this.relatedTopics.querySelectorAll('.topic-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                if (this.userInput) {
                    this.userInput.value = tag.dataset.topic;
                    this.handleQuery();
                }
            });
        });
    }
    
    addToHistory(title) {
        this.queryHistory.unshift(title);
        if (this.queryHistory.length > 5) {
            this.queryHistory.pop();
        }
        
        if (!this.topicList) return;
        
        this.topicList.innerHTML = this.queryHistory.map(topic =>
            `<li class="topic-item" data-topic="${topic}">${topic}</li>`
        ).join('');
        
        // Add click handlers
        this.topicList.querySelectorAll('.topic-item').forEach(item => {
            item.addEventListener('click', () => {
                if (this.userInput) {
                    this.userInput.value = item.dataset.topic;
                    this.handleQuery();
                }
            });
        });
    }
    
    updateMetrics(summary, responseTime) {
        this.totalQueries++;
        this.totalWords += summary.split(/\s+/).length;
        
        if (this.queriesCount) this.queriesCount.textContent = this.totalQueries;
        if (this.wordsCount) this.wordsCount.textContent = this.totalWords;
        if (this.responseTime) this.responseTime.textContent = `${responseTime}ms`;
    }
    
    // ========================================
    // Background Animations
    // ========================================
    
    startBackgroundAnimations() {
        // Update clock every second
        setInterval(() => this.updateClock(), 1000);
        
        // Update date
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            dateElement.textContent = new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }
    
    updateClock() {
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        if (this.dataStream) this.dataStream.textContent = time;
    }
    
    createParticles() {
        const particlesContainer = document.getElementById('particles');
        if (!particlesContainer) return;
        
        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 10}s`;
            particle.style.animationDuration = `${5 + Math.random() * 10}s`;
            particlesContainer.appendChild(particle);
        }
    }
    
    // ========================================
    // Neural Graph Animation
    // ========================================
    
    initNeuralGraph() {
        const canvas = this.neuralCanvas;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Set canvas size
        const resize = () => {
            canvas.width = canvas.offsetWidth * 2;
            canvas.height = canvas.offsetHeight * 2;
            ctx.scale(2, 2);
        };
        
        resize();
        window.addEventListener('resize', resize);
        
        // Neural network nodes
        const nodes = [];
        const nodeCount = 15;
        
        for (let i = 0; i < nodeCount; i++) {
            nodes.push({
                x: Math.random() * canvas.offsetWidth,
                y: Math.random() * canvas.offsetHeight,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: 2 + Math.random() * 2
            });
        }
        
        const animate = () => {
            ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
            
            // Update and draw nodes
            nodes.forEach((node, i) => {
                // Move
                node.x += node.vx;
                node.y += node.vy;
                
                // Bounce off edges
                if (node.x < 0 || node.x > canvas.offsetWidth) node.vx *= -1;
                if (node.y < 0 || node.y > canvas.offsetHeight) node.vy *= -1;
                
                // Draw connections
                nodes.forEach((other, j) => {
                    if (i === j) return;
                    const dist = Math.hypot(node.x - other.x, node.y - other.y);
                    if (dist < 60) {
                        ctx.beginPath();
                        ctx.moveTo(node.x, node.y);
                        ctx.lineTo(other.x, other.y);
                        ctx.strokeStyle = `rgba(0, 240, 255, ${1 - dist / 60})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                });
                
                // Draw node
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fillStyle = '#00f0ff';
                ctx.fill();
            });
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    // ========================================
    // Voice Narration
    // ========================================
    
    initVoice() {
        // Check if speech synthesis is supported
        if (!('speechSynthesis' in window)) {
            console.warn('Speech synthesis not supported');
            this.voiceEnabled = false;
            this.updateVoiceButtonState();
            return;
        }
        
        // Wait for voices to load
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => this.loadVoices();
        }
        
        // Try loading voices immediately
        this.loadVoices();
        
        // Retry loading voices after a delay (some browsers load voices async)
        setTimeout(() => {
            if (!this.selectedVoice) {
                this.loadVoices();
            }
        }, 100);
        
        setTimeout(() => {
            if (!this.selectedVoice) {
                this.loadVoices();
            }
        }, 1000);
        
        // Update voice button state
        this.updateVoiceButtonState();
    }
    
    loadVoices() {
        const voices = this.synth.getVoices();
        
        if (voices.length === 0) {
            console.log('No voices available yet');
            return;
        }
        
        console.log('Available voices:', voices.length);
        
        // Prefer futuristic-sounding voices
        const preferredVoices = [
            'Google UK English Female',
            'Google UK English Male', 
            'Google US English',
            'Microsoft Zira',
            'Microsoft David',
            'Samantha',
            'Alex',
            'Karen',
            'Daniel'
        ];
        
        // Try to find a preferred voice
        for (const preferred of preferredVoices) {
            const voice = voices.find(v => v.name.includes(preferred));
            if (voice) {
                this.selectedVoice = voice;
                console.log('Selected voice:', voice.name);
                break;
            }
        }
        
        // Fallback to first English voice
        if (!this.selectedVoice) {
            this.selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
            console.log('Fallback voice:', this.selectedVoice?.name);
        }
    }
    
    speak(text) {
        // Check if speech synthesis is available
        if (!this.synth) {
            console.warn('Speech synthesis not available');
            return;
        }
        
        // Cancel any ongoing speech
        this.synth.cancel();
        
        if (!text || !this.voiceEnabled) {
            console.log('Speech skipped:', !text ? 'no text' : 'voice disabled');
            return;
        }
        
        // Clean the text for better speech
        const cleanText = text
            .replace(/\[.*?\]/g, '') // Remove wiki-style references
            .replace(/https?:\/\/\S+/g, '') // Remove URLs
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        
        if (!cleanText) {
            console.log('No text to speak after cleaning');
            return;
        }
        
        console.log('Starting speech synthesis, text length:', cleanText.length);
        
        // Try to load voices if not already loaded
        if (!this.selectedVoice) {
            this.loadVoices();
        }
        
        // Create utterance
        this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
        
        // Configure voice settings
        if (this.selectedVoice) {
            this.currentUtterance.voice = this.selectedVoice;
        }
        this.currentUtterance.rate = this.voiceRate;
        this.currentUtterance.pitch = this.voicePitch;
        this.currentUtterance.volume = 1.0;
        
        // Event handlers
        this.currentUtterance.onstart = () => {
            console.log('Speech started');
            this.isSpeaking = true;
            this.startSpeaking();
            this.setMascotStatus('SPEAKING...');
            this.updateVoiceButtonState();
        };
        
        this.currentUtterance.onend = () => {
            console.log('Speech ended');
            this.isSpeaking = false;
            this.stopSpeaking();
            if (!this.isProcessing) {
                this.setMascotStatus('AWAITING INPUT');
            }
            this.updateVoiceButtonState();
        };
        
        this.currentUtterance.onerror = (event) => {
            console.error('Speech synthesis error:', event.error);
            this.isSpeaking = false;
            this.stopSpeaking();
            this.setMascotStatus('AWAITING INPUT');
            this.updateVoiceButtonState();
        };
        
        // Workaround for Chrome bug where speech stops after ~15 seconds
        this.currentUtterance.onpause = () => {
            if (this.isSpeaking) {
                this.synth.resume();
            }
        };
        
        // Start speaking
        this.synth.speak(this.currentUtterance);
        
        // Chrome workaround: keep speech alive
        this.keepSpeechAlive();
    }
    
    keepSpeechAlive() {
        // Chrome has a bug where speech synthesis stops after ~15 seconds
        // This workaround pauses and resumes to keep it going
        if (this.isSpeaking && this.synth.speaking) {
            this.synth.pause();
            this.synth.resume();
            setTimeout(() => this.keepSpeechAlive(), 10000);
        }
    }
    
    stopVoice() {
        this.synth.cancel();
        this.isSpeaking = false;
        this.stopSpeaking();
        this.setMascotStatus('AWAITING INPUT');
        this.updateVoiceButtonState();
    }
    
    toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;
        
        if (!this.voiceEnabled && this.isSpeaking) {
            this.stopVoice();
        }
        
        this.updateVoiceButtonState();
        
        // Show feedback
        const status = this.voiceEnabled ? 'VOICE ENABLED' : 'VOICE DISABLED';
        this.setMascotStatus(status);
        setTimeout(() => {
            if (!this.isProcessing && !this.isSpeaking) {
                this.setMascotStatus('AWAITING INPUT');
            }
        }, 1500);
    }
    
    updateVoiceButtonState() {
        const voiceToggle = document.getElementById('voiceToggle');
        const stopSpeechBtn = document.getElementById('stopSpeech');
        
        if (voiceToggle) {
            voiceToggle.classList.toggle('active', this.voiceEnabled);
            const voiceIcon = voiceToggle.querySelector('.voice-icon');
            const voiceLabel = voiceToggle.querySelector('.voice-label');
            if (voiceIcon) voiceIcon.textContent = this.voiceEnabled ? '🔊' : '🔇';
            if (voiceLabel) voiceLabel.textContent = this.voiceEnabled ? 'ON' : 'OFF';
        }
        
        if (stopSpeechBtn) {
            stopSpeechBtn.style.display = this.isSpeaking ? 'flex' : 'none';
        }
    }
    
    setVoiceRate(rate) {
        this.voiceRate = Math.max(0.5, Math.min(2, rate));
    }
    
    setVoicePitch(pitch) {
        this.voicePitch = Math.max(0.5, Math.min(2, pitch));
    }
    
    // ========================================
    // Gesture Support
    // ========================================
    
    initGestures() {
        const chatSection = document.querySelector('.chat-section');
        const mascotFrame = document.querySelector('.mascot-frame');
        
        if (!chatSection) return;
        
        // Touch events for swipe gestures
        chatSection.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });
        
        chatSection.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.touchEndY = e.changedTouches[0].screenY;
            this.handleGesture();
        }, { passive: true });
        
        // Double tap on mascot to toggle voice
        if (mascotFrame) {
            let lastTap = 0;
            mascotFrame.addEventListener('touchend', (e) => {
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                if (tapLength < 300 && tapLength > 0) {
                    e.preventDefault();
                    this.toggleVoice();
                    this.showGestureFeedback('Voice ' + (this.voiceEnabled ? 'ON' : 'OFF'));
                }
                lastTap = currentTime;
            });
            
            // Double click for desktop
            mascotFrame.addEventListener('dblclick', () => {
                this.toggleVoice();
                this.showGestureFeedback('Voice ' + (this.voiceEnabled ? 'ON' : 'OFF'));
            });
        }
        
        // Long press on mascot to stop speaking
        if (mascotFrame) {
            let pressTimer;
            mascotFrame.addEventListener('touchstart', () => {
                pressTimer = setTimeout(() => {
                    if (this.isSpeaking) {
                        this.stopVoice();
                        this.showGestureFeedback('Speech Stopped');
                    }
                }, 800);
            }, { passive: true });
            
            mascotFrame.addEventListener('touchend', () => {
                clearTimeout(pressTimer);
            }, { passive: true });
            
            mascotFrame.addEventListener('touchmove', () => {
                clearTimeout(pressTimer);
            }, { passive: true });
        }
    }
    
    handleGesture() {
        const deltaX = this.touchEndX - this.touchStartX;
        const deltaY = this.touchEndY - this.touchStartY;
        const minSwipeDistance = 50;
        
        // Horizontal swipe detection
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX > 0) {
                // Swipe right - could be used for navigation
                this.onSwipeRight();
            } else {
                // Swipe left - could be used for navigation
                this.onSwipeLeft();
            }
        }
        
        // Vertical swipe detection
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > minSwipeDistance) {
            if (deltaY > 0) {
                // Swipe down - stop speech
                if (this.isSpeaking) {
                    this.stopVoice();
                    this.showGestureFeedback('Speech Stopped');
                }
            } else {
                // Swipe up - focus input
                this.userInput.focus();
                this.showGestureFeedback('Ready to type');
            }
        }
    }
    
    onSwipeRight() {
        // Toggle voice on swipe right
        if (!this.isProcessing) {
            this.toggleVoice();
        }
    }
    
    onSwipeLeft() {
        // Clear chat or go back (placeholder for future functionality)
        if (this.isSpeaking) {
            this.stopVoice();
            this.showGestureFeedback('Speech Stopped');
        }
    }
    
    showGestureFeedback(message) {
        // Create feedback element
        let feedback = document.getElementById('gestureFeedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.id = 'gestureFeedback';
            feedback.className = 'gesture-feedback';
            document.body.appendChild(feedback);
        }
        
        feedback.textContent = message;
        feedback.classList.add('visible');
        
        setTimeout(() => {
            feedback.classList.remove('visible');
        }, 1500);
    }
    
    // ========================================
    // Utilities
    // ========================================
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.dalimmsChatBot = new DalimmsChatBot();
});
