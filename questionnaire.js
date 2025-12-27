// 理性问题收集（日期、时间、人数、出发地）
class QuestionnaireManager {
    constructor() {
        this.currentSession = null;
        this.data = {
            travelDate: null,
            travelTime: null,
            travelerCount: null,
            departureLocation: null,
            additionalAnswers: {}
        };
    }

    init() {
        this.setupForm();
    }

    setupForm() {
        const form = document.getElementById('questionnaire-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submit();
        });

        // 实时验证
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateData();
            });
        });
    }

    updateData() {
        this.data.travelDate = document.getElementById('travel-date')?.value;
        this.data.travelTime = document.getElementById('travel-time')?.value;
        this.data.travelerCount = parseInt(document.getElementById('traveler-count')?.value) || null;
        this.data.departureLocation = document.getElementById('departure-location')?.value;
    }

    async submit() {
        this.updateData();

        // 验证必填项
        if (!this.data.travelDate || !this.data.travelTime || !this.data.travelerCount || !this.data.departureLocation) {
            alert('请填写所有必填项');
            return;
        }

        // 保存到数据库
        if (this.currentSession && window.supabaseClient) {
            try {
                const { error } = await window.supabaseClient
                    .from('travel_questionnaires')
                    .insert({
                        session_id: this.currentSession,
                        travel_date: this.data.travelDate,
                        travel_time: this.data.travelTime,
                        traveler_count: this.data.travelerCount,
                        departure_location: this.data.departureLocation,
                        additional_answers: this.data.additionalAnswers
                    });

                if (error) throw error;

                // 触发下一步
                if (window.appManager) {
                    window.appManager.goToStep(3);
                }
            } catch (error) {
                console.error('保存问卷失败:', error);
                alert('保存失败，请重试');
            }
        } else {
            // 如果没有session，直接进入下一步
            if (window.appManager) {
                window.appManager.goToStep(3);
            }
        }
    }

    getData() {
        return { ...this.data };
    }

    setSession(sessionId) {
        this.currentSession = sessionId;
    }

    clear() {
        this.data = {
            travelDate: null,
            travelTime: null,
            travelerCount: null,
            departureLocation: null,
            additionalAnswers: {}
        };
        
        const form = document.getElementById('questionnaire-form');
        if (form) {
            form.reset();
        }
    }
}

// 创建全局问卷管理器实例
window.questionnaireManager = new QuestionnaireManager();

