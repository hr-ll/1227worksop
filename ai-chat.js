// AI个性化问答系统
class AIChatManager {
    constructor() {
        this.currentSession = null;
        this.messages = [];
        this.isWaitingForResponse = false;
        this.chatComplete = false;
    }

    async init(sessionId, keywords, questionnaireData) {
        this.currentSession = sessionId;
        this.messages = [];
        this.chatComplete = false;

        // 加载历史消息
        await this.loadHistory();

        // 如果还没有消息，生成第一个问题
        if (this.messages.length === 0) {
            await this.generateFirstQuestion(keywords, questionnaireData);
        } else {
            // 如果已有消息，启用输入框（除非聊天已完成）
            if (!this.chatComplete) {
                this.updateChatInput(true);
            }
        }
    }

    async loadHistory() {
        // 如果是临时session，从localStorage加载
        if (this.currentSession && this.currentSession.startsWith('session_')) {
            const savedMessages = localStorage.getItem(`chat_messages_${this.currentSession}`);
            if (savedMessages) {
                try {
                    this.messages = JSON.parse(savedMessages);
                    this.renderMessages();
                } catch (error) {
                    console.error('加载聊天历史失败:', error);
                }
            }
            return;
        }

        // 如果有Supabase，从数据库加载
        if (window.supabaseClient && this.currentSession) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('ai_chat_messages')
                    .select('*')
                    .eq('session_id', this.currentSession)
                    .order('created_at', { ascending: true });

                if (error) throw error;

                this.messages = data || [];
                this.renderMessages();
            } catch (error) {
                console.error('加载聊天历史失败:', error);
            }
        }
    }

    async generateFirstQuestion(keywords, questionnaireData) {
        if (!window.aiProcessor || !window.aiProcessor.apiKey) {
            // 如果没有AI，使用默认问题
            this.addMessage('assistant', '您希望这次旅行是放松还是探索？', 'question');
            this.updateChatInput(true); // 启用输入框
            return;
        }

        const context = `用户想要旅行的情绪关键词：${keywords.join('、')}
已收集的基础信息：
- 出行日期：${questionnaireData.travelDate}
- 出行时间：${questionnaireData.travelTime}
- 人数：${questionnaireData.travelerCount}
- 出发地：${questionnaireData.departureLocation}`;

        const prompt = `作为旅行规划助手，请根据用户的情绪和已收集的信息，生成一个个性化问题来了解更多需求。问题应该：
1. 与用户的情绪关键词相关
2. 帮助更好地推荐景点
3. 自然、友好

只返回问题内容，不要其他解释。

${context}

问题：`;

        try {
            const question = await window.aiProcessor.callGLM4(prompt);
            this.addMessage('assistant', question.trim(), 'question');
            await this.saveMessage('assistant', question.trim(), 'question');
            this.updateChatInput(true); // 启用输入框
        } catch (error) {
            console.error('生成问题失败:', error);
            this.addMessage('assistant', '您希望这次旅行是放松还是探索？', 'question');
            this.updateChatInput(true); // 启用输入框
        }
    }

    async handleUserMessage(userAnswer) {
        if (this.isWaitingForResponse || this.chatComplete) return;

        // 添加用户消息
        this.addMessage('user', userAnswer, 'answer');
        await this.saveMessage('user', userAnswer, 'answer');

        this.isWaitingForResponse = true;
        this.updateChatInput(false);

        // 生成下一个问题或完成
        try {
            const shouldContinue = await this.shouldContinueChatting();
            
            if (shouldContinue) {
                await this.generateNextQuestion();
            } else {
                this.completeChat();
            }
        } catch (error) {
            console.error('处理用户消息失败:', error);
            this.completeChat();
        } finally {
            this.isWaitingForResponse = false;
            this.updateChatInput(true);
        }
    }

    async shouldContinueChatting() {
        // 简单逻辑：如果已经问了3个问题，就完成
        const questionCount = this.messages.filter(m => m.role === 'assistant' && m.message_type === 'question').length;
        return questionCount < 3;
    }

    async generateNextQuestion() {
        if (!window.aiProcessor || !window.aiProcessor.apiKey) {
            this.completeChat();
            return;
        }

        const conversationHistory = this.messages.map(m => 
            `${m.role === 'assistant' ? '助手' : '用户'}: ${m.content}`
        ).join('\n');

        const prompt = `根据以下对话历史，生成下一个个性化问题。如果已经收集足够信息，可以结束对话。

对话历史：
${conversationHistory}

请生成下一个问题，或者如果信息已足够，回复"信息已收集完整，可以开始推荐了"。只返回问题或结束语，不要其他解释。

回复：`;

        try {
            const response = await window.aiProcessor.callGLM4(prompt);
            const content = response.trim();

            if (content.includes('信息已收集完整') || content.includes('可以开始推荐')) {
                this.completeChat();
            } else {
                this.addMessage('assistant', content, 'question');
                await this.saveMessage('assistant', content, 'question');
                this.updateChatInput(true); // 启用输入框
            }
        } catch (error) {
            console.error('生成问题失败:', error);
            this.completeChat();
        }
    }

    completeChat() {
        this.chatComplete = true;
        this.addMessage('assistant', '信息已收集完整，正在为您生成推荐...', 'recommendation');
        this.updateChatInput(false);
        
        // 触发推荐生成
        if (window.appManager) {
            setTimeout(() => {
                window.appManager.goToStep(4);
            }, 1000);
        }
    }

    addMessage(role, content, messageType = null) {
        const message = {
            role,
            content,
            message_type: messageType,
            created_at: new Date().toISOString()
        };

        this.messages.push(message);
        this.renderMessages();
        
        // 如果是助手的问题消息，启用输入框
        if (role === 'assistant' && messageType === 'question' && !this.chatComplete) {
            this.updateChatInput(true);
        }
    }

    async saveMessage(role, content, messageType) {
        // 如果是临时session，保存到localStorage
        if (this.currentSession && this.currentSession.startsWith('session_')) {
            const savedMessages = localStorage.getItem(`chat_messages_${this.currentSession}`);
            let messages = savedMessages ? JSON.parse(savedMessages) : [];
            messages.push({
                role,
                content,
                message_type: messageType,
                created_at: new Date().toISOString()
            });
            localStorage.setItem(`chat_messages_${this.currentSession}`, JSON.stringify(messages));
            return;
        }

        // 如果有Supabase，保存到数据库
        if (window.supabaseClient && this.currentSession) {
            try {
                const { error } = await window.supabaseClient
                    .from('ai_chat_messages')
                    .insert({
                        session_id: this.currentSession,
                        role,
                        content,
                        message_type: messageType
                    });

                if (error) throw error;
            } catch (error) {
                console.error('保存消息失败:', error);
            }
        }
    }

    renderMessages() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = '';

        this.messages.forEach(message => {
            const messageEl = document.createElement('div');
            messageEl.className = `chat-message ${message.role}`;

            const contentEl = document.createElement('div');
            contentEl.className = 'message-content';
            contentEl.textContent = message.content;

            messageEl.appendChild(contentEl);
            messagesContainer.appendChild(messageEl);
        });

        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    updateChatInput(enabled) {
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        const finishBtn = document.getElementById('finish-chat-btn');

        if (chatInput) chatInput.disabled = !enabled;
        if (sendBtn) sendBtn.disabled = !enabled;
        if (finishBtn) finishBtn.disabled = !this.chatComplete;
    }

    getAdditionalAnswers() {
        const answers = {};
        this.messages.forEach((msg, index) => {
            if (msg.role === 'user' && index > 0) {
                const question = this.messages[index - 1]?.content || '';
                answers[question] = msg.content;
            }
        });
        return answers;
    }

    skip() {
        this.completeChat();
    }
}

// 创建全局AI聊天管理器实例
window.aiChatManager = new AIChatManager();

// 绑定聊天界面事件
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const skipBtn = document.getElementById('skip-chat-btn');
    const finishBtn = document.getElementById('finish-chat-btn');

    const sendMessage = () => {
        const message = chatInput?.value.trim();
        if (message && window.aiChatManager) {
            window.aiChatManager.handleUserMessage(message);
            chatInput.value = '';
        }
    };

    sendBtn?.addEventListener('click', sendMessage);
    chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    skipBtn?.addEventListener('click', () => {
        if (window.aiChatManager) {
            window.aiChatManager.skip();
        }
    });

    finishBtn?.addEventListener('click', () => {
        if (window.aiChatManager) {
            window.aiChatManager.completeChat();
        }
    });
});

