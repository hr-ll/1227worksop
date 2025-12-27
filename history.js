// 推荐历史管理
class HistoryManager {
    constructor() {
        this.history = [];
    }

    async loadHistory() {
        // 从localStorage加载历史记录
        const savedHistory = localStorage.getItem('recommendation_history');
        if (savedHistory) {
            try {
                this.history = JSON.parse(savedHistory);
                this.renderHistory();
            } catch (error) {
                console.error('加载历史失败:', error);
            }
        }

        // 如果有Supabase且已登录，也从数据库加载
        if (window.supabaseClient && window.authManager?.isAuthenticated()) {
            try {
                const user = window.authManager.getCurrentUser();
                if (user) {
                    const { data, error } = await window.supabaseClient
                        .from('recommendation_sessions')
                        .select(`
                            *,
                            recommended_places (*),
                            travel_questionnaires (*)
                        `)
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(20);

                    if (error) throw error;

                    if (data && data.length > 0) {
                        this.history = data;
                        this.renderHistory();
                    }
                }
            } catch (error) {
                console.error('加载历史失败:', error);
            }
        }
    }

    renderHistory() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;

        historyList.innerHTML = '';

        if (this.history.length === 0) {
            historyList.innerHTML = '<p style="padding: 2rem; text-align: center; color: var(--text-secondary);">暂无历史记录</p>';
            return;
        }

        this.history.forEach(session => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.style.cssText = 'padding: 1rem; border-bottom: 1px solid var(--border-color); cursor: pointer;';

            const date = new Date(session.created_at).toLocaleString('zh-CN');
            const keywords = session.extracted_keywords?.join('、') || '无';
            const placeCount = session.recommended_places?.length || 0;

            item.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 0.5rem;">${date}</div>
                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem;">关键词: ${keywords}</div>
                <div style="color: var(--text-secondary); font-size: 0.875rem;">推荐景点: ${placeCount}个</div>
            `;

            item.addEventListener('click', () => {
                this.loadSession(session.id);
            });

            historyList.appendChild(item);
        });
    }

    async loadSession(sessionId) {
        // 加载历史会话
        if (window.appManager) {
            // 这里可以实现加载历史会话的逻辑
            alert('加载历史会话功能待实现');
        }
    }

    async saveSession(sessionData) {
        // 生成一个临时session ID（使用时间戳+随机数）
        const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // 保存到localStorage
        const sessionRecord = {
            id: sessionId,
            input_type: sessionData.inputType,
            input_content: sessionData.inputContent,
            extracted_keywords: sessionData.keywords,
            created_at: new Date().toISOString()
        };

        const savedHistory = localStorage.getItem('recommendation_history');
        let history = savedHistory ? JSON.parse(savedHistory) : [];
        history.unshift(sessionRecord);
        // 只保留最近20条
        history = history.slice(0, 20);
        localStorage.setItem('recommendation_history', JSON.stringify(history));

        // 如果有Supabase且已登录，也保存到数据库
        if (window.supabaseClient && window.authManager?.isAuthenticated()) {
            try {
                const user = window.authManager.getCurrentUser();
                if (user) {
                    const { data, error } = await window.supabaseClient
                        .from('recommendation_sessions')
                        .insert({
                            user_id: user.id,
                            input_type: sessionData.inputType,
                            input_content: sessionData.inputContent,
                            extracted_keywords: sessionData.keywords
                        })
                        .select()
                        .single();

                    if (error) throw error;
                    return data.id;
                }
            } catch (error) {
                console.error('保存会话到数据库失败:', error);
            }
        }

        return sessionId;
    }
}

// 创建全局历史管理器实例
window.historyManager = new HistoryManager();

// 绑定历史记录按钮
document.addEventListener('DOMContentLoaded', () => {
    const historyBtn = document.getElementById('history-btn');
    const historySidebar = document.getElementById('history-sidebar');
    const closeHistoryBtn = document.getElementById('close-history-btn');

    historyBtn?.addEventListener('click', async () => {
        if (historySidebar) {
            historySidebar.classList.remove('hidden');
            await window.historyManager.loadHistory();
        }
    });

    closeHistoryBtn?.addEventListener('click', () => {
        if (historySidebar) {
            historySidebar.classList.add('hidden');
        }
    });
});

