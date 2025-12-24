class DalimmsChatBot {
    constructor() {
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
        
        this.queriesCount = document.getElementById('queriesCount');
        this.wordsCount = document.getElementById('wordsCount');
        this.responseTime = document.getElementById('responseTime');
        this.dataStream = document.getElementById('dataStream');
        
        this.isProcessing = false;
        this.queryHistory = [];
        this.totalQueries = 0;
        this.totalWords = 0;
        
        this.synth = window.speechSynthesis;
        this.currentUtterance = null;
        this.isSpeaking = false;
        this.voiceEnabled = true;
        this.selectedVoice = null;
        this.voiceRate = 1.0;
        this.voicePitch = 1.0;
        
        this.recognition = null;
        this.isListening = false;
        this.micBtn = document.getElementById('micBtn');
        
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.startBackgroundAnimations();
        this.initNeuralGraph();
        this.updateClock();
        this.createParticles();
        this.initVoice();
        this.initVoiceInput();
        this.initGestures();
    }
    
    setupEventListeners() {
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.handleQuery());
        }
        
        if (this.userInput) {
            this.userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleQuery();
                }
            });
            
            this.userInput.addEventListener('focus', () => {
                this.setMascotStatus('LISTENING...');
            });
            
            this.userInput.addEventListener('blur', () => {
                if (!this.isProcessing && !this.isSpeaking) {
                    this.setMascotStatus('AWAITING INPUT');
                }
            });
        }
        
        const voiceToggle = document.getElementById('voiceToggle');
        if (voiceToggle) {
            voiceToggle.addEventListener('click', () => this.toggleVoice());
        }
        
        const stopSpeechBtn = document.getElementById('stopSpeech');
        if (stopSpeechBtn) {
            stopSpeechBtn.addEventListener('click', () => this.stopVoice());
        }
    }
    
    async handleQuery() {
        if (!this.userInput) return;
        
        const query = this.userInput.value.trim();
        
        if (!query || this.isProcessing) return;
        
        this.isProcessing = true;
        if (this.sendBtn) this.sendBtn.disabled = true;
        this.userInput.value = '';
        
        this.addMessage(query, 'user');
        
        this.setMascotStatus('SEARCHING...');
        this.showLoading(true);
        
        const startTime = Date.now();
        
        try {
            const result = await this.fetchWikipedia(query);
            
            if (result.success) {
                this.setMascotStatus('ANALYZING...');
                await this.sleep(500);
                
                const summary = this.summarizeContent(result.content);
                
                if (this.voiceEnabled && summary) {
                    this.speak(summary);
                }
                
                await this.addMessageWithAnimation(summary, 'bot');
                
                this.updateSummaryPanel(summary, result.title, result.url);
                this.updateRelatedTopics(result.links);
                this.addToHistory(result.title);
                
                const responseTimeMs = Date.now() - startTime;
                this.updateMetrics(summary, responseTimeMs);
                
            } else {
                this.addMessage(`Unable to find information about "${query}". Please try a different topic.`, 'bot');
            }
            
        } catch (error) {
            console.error('Error:', error);
            this.addMessage('An error occurred while fetching data. Please try again.', 'bot');
        }
        
        this.showLoading(false);
        this.isProcessing = false;
        if (this.sendBtn) this.sendBtn.disabled = false;
        
        if (!this.isSpeaking) {
            this.stopSpeaking();
            this.setMascotStatus('AWAITING INPUT');
        }
    }
    
    async fetchWikipedia(query) {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
        
        try {
            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();
            
            if (!searchData.query.search.length) {
                return { success: false };
            }
            
            const pageTitle = searchData.query.search[0].title;
            
            const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=extracts|links&exintro=true&explaintext=true&pllimit=10&format=json&origin=*`;
            
            const contentResponse = await fetch(contentUrl);
            const contentData = await contentResponse.json();
            
            const pages = contentData.query.pages;
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];
            
            if (!page.extract) {
                return { success: false };
            }
            
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
    
    summarizeContent(content) {
        const sentences = content
            .replace(/\n/g, ' ')
            .split(/(?<=[.!?])\s+/)
            .filter(s => s.trim().length > 20);
        
        const summaryLength = Math.min(5, Math.max(3, sentences.length));
        let summary = sentences.slice(0, summaryLength).join(' ');
        
        if (summary.length > 500) {
            summary = summary.substring(0, 500);
            const lastPeriod = summary.lastIndexOf('.');
            if (lastPeriod > 300) {
                summary = summary.substring(0, lastPeriod + 1);
            }
        }
        
        return summary || 'No summary available for this topic.';
    }
    
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
        
        await this.typeText(contentP, content);
        this.scrollToBottom();
    }
    
    async typeText(element, text) {
        const chars = text.split('');
        const speed = 15;
        
        for (let i = 0; i < chars.length; i++) {
            element.textContent += chars[i];
            
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
    
    startBackgroundAnimations() {
        setInterval(() => this.updateClock(), 1000);
        
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
    
    initNeuralGraph() {
        const canvas = this.neuralCanvas;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const resize = () => {
            canvas.width = canvas.offsetWidth * 2;
            canvas.height = canvas.offsetHeight * 2;
            ctx.scale(2, 2);
        };
        
        resize();
        window.addEventListener('resize', resize);
        
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
            
            nodes.forEach((node, i) => {
                node.x += node.vx;
                node.y += node.vy;
                
                if (node.x < 0 || node.x > canvas.offsetWidth) node.vx *= -1;
                if (node.y < 0 || node.y > canvas.offsetHeight) node.vy *= -1;
                
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
                
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fillStyle = '#00f0ff';
                ctx.fill();
            });
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    initVoice() {
        if (!('speechSynthesis' in window)) {
            this.voiceEnabled = false;
            this.updateVoiceButtonState();
            return;
        }
        
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => this.loadVoices();
        }
        
        this.loadVoices();
        
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
        
        this.updateVoiceButtonState();
    }
    
    loadVoices() {
        const voices = this.synth.getVoices();
        
        if (voices.length === 0) {
            return;
        }
        
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
        
        for (const preferred of preferredVoices) {
            const voice = voices.find(v => v.name.includes(preferred));
            if (voice) {
                this.selectedVoice = voice;
                break;
            }
        }
        
        if (!this.selectedVoice) {
            this.selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
        }
    }
    
    speak(text) {
        if (!this.synth) {
            return;
        }
        
        this.synth.cancel();
        
        if (!text || !this.voiceEnabled) {
            return;
        }
        
        const cleanText = text
            .replace(/\[.*?\]/g, '')
            .replace(/https?:\/\/\S+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        if (!cleanText) {
            return;
        }
        
        if (!this.selectedVoice) {
            this.loadVoices();
        }
        
        this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
        
        if (this.selectedVoice) {
            this.currentUtterance.voice = this.selectedVoice;
        }
        this.currentUtterance.rate = this.voiceRate;
        this.currentUtterance.pitch = this.voicePitch;
        this.currentUtterance.volume = 1.0;
        
        this.currentUtterance.onstart = () => {
            this.isSpeaking = true;
            this.startSpeaking();
            this.setMascotStatus('SPEAKING...');
            this.updateVoiceButtonState();
        };
        
        this.currentUtterance.onend = () => {
            this.isSpeaking = false;
            this.stopSpeaking();
            if (!this.isProcessing) {
                this.setMascotStatus('AWAITING INPUT');
            }
            this.updateVoiceButtonState();
        };
        
        this.currentUtterance.onerror = (event) => {
            this.isSpeaking = false;
            this.stopSpeaking();
            this.setMascotStatus('AWAITING INPUT');
            this.updateVoiceButtonState();
        };
        
        this.currentUtterance.onpause = () => {
            if (this.isSpeaking) {
                this.synth.resume();
            }
        };
        
        this.synth.speak(this.currentUtterance);
        
        this.keepSpeechAlive();
    }
    
    keepSpeechAlive() {
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

    initVoiceInput() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            if (this.micBtn) {
                this.micBtn.style.display = 'none';
            }
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (this.userInput) {
                if (finalTranscript) {
                    this.userInput.value = finalTranscript;
                    this.setMascotStatus('PROCESSING VOICE...');
                } else if (interimTranscript) {
                    this.userInput.value = interimTranscript;
                    this.userInput.placeholder = 'Listening...';
                }
            }
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (this.micBtn) {
                this.micBtn.classList.remove('listening');
            }
            this.setMascotStatus('AWAITING INPUT');
            
            if (this.userInput) {
                this.userInput.placeholder = 'Ask me anything about any topic...';
            }

            if (this.userInput && this.userInput.value.trim()) {
                setTimeout(() => this.handleQuery(), 300);
            }
        };

        this.recognition.onerror = (event) => {
            this.isListening = false;
            if (this.micBtn) {
                this.micBtn.classList.remove('listening');
            }
            
            let errorMsg = 'Voice input error';
            switch (event.error) {
                case 'not-allowed':
                    errorMsg = 'Microphone access denied';
                    break;
                case 'no-speech':
                    errorMsg = 'No speech detected';
                    break;
                case 'network':
                    errorMsg = 'Network error';
                    break;
            }
            this.setMascotStatus(errorMsg.toUpperCase());
            
            setTimeout(() => {
                this.setMascotStatus('AWAITING INPUT');
            }, 2000);
        };

        if (this.micBtn) {
            this.micBtn.addEventListener('click', () => this.toggleVoiceInput());
        }
    }

    toggleVoiceInput() {
        if (!this.recognition) {
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
            this.isListening = false;
            if (this.micBtn) {
                this.micBtn.classList.remove('listening');
            }
            this.setMascotStatus('AWAITING INPUT');
        } else {
            try {
                if (this.synth && this.isSpeaking) {
                    this.synth.cancel();
                }
                
                this.recognition.start();
                this.isListening = true;
                if (this.micBtn) {
                    this.micBtn.classList.add('listening');
                }
                this.setMascotStatus('LISTENING...');
                
                if (this.userInput) {
                    this.userInput.value = '';
                    this.userInput.placeholder = 'Speak now...';
                }
            } catch (error) {
                console.error('Error starting speech recognition:', error);
            }
        }
    }

    initGestures() {
        const chatSection = document.querySelector('.chat-section');
        const mascotFrame = document.querySelector('.mascot-frame');
        
        if (!chatSection) return;
        
        chatSection.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });
        
        chatSection.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.touchEndY = e.changedTouches[0].screenY;
            this.handleGesture();
        }, { passive: true });
        
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
            
            mascotFrame.addEventListener('dblclick', () => {
                this.toggleVoice();
                this.showGestureFeedback('Voice ' + (this.voiceEnabled ? 'ON' : 'OFF'));
            });
        }
        
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
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX > 0) {
                this.onSwipeRight();
            } else {
                this.onSwipeLeft();
            }
        }
        
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > minSwipeDistance) {
            if (deltaY > 0) {
                if (this.isSpeaking) {
                    this.stopVoice();
                    this.showGestureFeedback('Speech Stopped');
                }
            } else {
                this.userInput.focus();
                this.showGestureFeedback('Ready to type');
            }
        }
    }
    
    onSwipeRight() {
        if (!this.isProcessing) {
            this.toggleVoice();
        }
    }
    
    onSwipeLeft() {
        if (this.isSpeaking) {
            this.stopVoice();
            this.showGestureFeedback('Speech Stopped');
        }
    }
    
    showGestureFeedback(message) {
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
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dalimmsChatBot = new DalimmsChatBot();
});
