// 主应用逻辑 - 整合所有模块，管理应用状态、步骤流程和路由
class AppManager {
    constructor() {
        this.currentStep = 1;
        this.currentSession = null;
        this.currentKeywords = [];
        this.currentRecommendations = [];
        this.init();
    }

    async init() {
        // 等待所有模块初始化
        await this.initializeModules();

        // 绑定事件
        this.setupEventListeners();

        // 初始化步骤指示器
        this.updateStepIndicator();
    }

    async initializeModules() {
        // 初始化各个模块
        if (window.aiProcessor) {
            await window.aiProcessor.init();
        }
        if (window.mapAPI) {
            await window.mapAPI.init();
        }
        if (window.weatherAPI) {
            await window.weatherAPI.init();
        }
        if (window.questionnaireManager) {
            window.questionnaireManager.init();
        }
    }

    setupEventListeners() {
        // 分析按钮
        const analyzeBtn = document.getElementById('analyze-btn');
        analyzeBtn?.addEventListener('click', () => {
            this.handleAnalyze();
        });

        // 步骤1下一步
        const step1Next = document.getElementById('step1-next');
        step1Next?.addEventListener('click', () => {
            this.goToStep(2);
        });

        // 步骤2返回
        const step2Back = document.getElementById('step2-back');
        step2Back?.addEventListener('click', () => {
            this.goToStep(1);
        });

        // 步骤3返回
        const step3Back = document.getElementById('step3-back');
        step3Back?.addEventListener('click', () => {
            this.goToStep(2);
        });

        // 步骤4返回
        const step4Back = document.getElementById('step4-back');
        step4Back?.addEventListener('click', () => {
            this.goToStep(3);
        });

        // 重新搜索
        const newSearchBtn = document.getElementById('new-search-btn');
        newSearchBtn?.addEventListener('click', () => {
            this.reset();
        });

        // 设置按钮
        const settingsBtn = document.getElementById('settings-btn');
        const settingsPanel = document.getElementById('settings-panel');
        const closeSettingsBtn = document.getElementById('close-settings-btn');
        const saveApiConfigBtn = document.getElementById('save-api-config');

        settingsBtn?.addEventListener('click', () => {
            if (settingsPanel) {
                settingsPanel.classList.remove('hidden');
            }
        });

        closeSettingsBtn?.addEventListener('click', () => {
            if (settingsPanel) {
                settingsPanel.classList.add('hidden');
            }
        });

        saveApiConfigBtn?.addEventListener('click', () => {
            this.saveApiConfig();
        });

        // 图片模态框
        this.setupImageModal();
    }

    setupImageModal() {
        const imageModal = document.getElementById('image-modal');
        const closeImageModal = document.getElementById('close-image-modal');
        const modalImage = document.getElementById('modal-image');

        closeImageModal?.addEventListener('click', () => {
            if (imageModal) {
                imageModal.classList.add('hidden');
            }
        });

        imageModal?.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                imageModal.classList.add('hidden');
            }
        });
    }

    async handleAnalyze() {
        const analyzeBtn = document.getElementById('analyze-btn');
        const keywordsDisplay = document.getElementById('keywords-display');
        const keywordsList = document.getElementById('keywords-list');

        if (!analyzeBtn || !keywordsDisplay) return;

        // 禁用按钮
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '分析中...';

        try {
            // 获取输入数据
            const inputData = window.inputHandler.getInputData();

            // 提取关键词
            const keywords = await window.aiProcessor.extractKeywords(inputData);
            this.currentKeywords = keywords;

            // 显示关键词
            keywordsList.innerHTML = '';
            keywords.forEach(keyword => {
                const tag = document.createElement('span');
                tag.className = 'keyword-tag';
                tag.textContent = keyword;
                keywordsList.appendChild(tag);
            });

            keywordsDisplay.classList.remove('hidden');

            // 保存会话
            const inputContent = inputData.type === 'text' 
                ? inputData.text 
                : `${inputData.type} files`;
            
            this.currentSession = await window.historyManager.saveSession({
                inputType: inputData.type,
                inputContent: inputContent,
                keywords: keywords
            });

        } catch (error) {
            console.error('分析失败:', error);
            alert('分析失败：' + error.message);
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '分析情绪';
        }
    }

    goToStep(step) {
        // 隐藏所有步骤
        document.querySelectorAll('.step-content').forEach(el => {
            el.classList.remove('active');
        });

        // 显示目标步骤
        const targetStep = document.getElementById(`step-${step}`);
        if (targetStep) {
            targetStep.classList.add('active');
        }

        this.currentStep = step;
        this.updateStepIndicator();

        // 步骤特定逻辑
        if (step === 2) {
            if (this.currentSession) {
                window.questionnaireManager.setSession(this.currentSession);
            }
        } else if (step === 3) {
            this.initAIChat();
        } else if (step === 4) {
            this.generateRecommendations();
        }
    }

    updateStepIndicator() {
        document.querySelectorAll('.step-item').forEach((item, index) => {
            const stepNum = index + 1;
            item.classList.remove('active', 'completed');
            
            if (stepNum === this.currentStep) {
                item.classList.add('active');
            } else if (stepNum < this.currentStep) {
                item.classList.add('completed');
            }
        });
    }

    async initAIChat() {
        const questionnaireData = window.questionnaireManager.getData();
        
        await window.aiChatManager.init(
            this.currentSession,
            this.currentKeywords,
            questionnaireData
        );
    }

    async generateRecommendations() {
        const loadingIndicator = document.getElementById('loading-indicator');
        const recommendationsContainer = document.getElementById('recommendations-container');

        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
        if (recommendationsContainer) recommendationsContainer.classList.add('hidden');

        try {
            // 获取问卷数据
            const questionnaireData = window.questionnaireManager.getData();
            const additionalAnswers = window.aiChatManager.getAdditionalAnswers();

            // 推荐景点
            const places = await window.recommendationEngine.recommend(
                this.currentKeywords,
                questionnaireData.departureLocation
            );

            // 保存推荐
            if (this.currentSession) {
                await window.recommendationEngine.saveRecommendation(this.currentSession, places);
            }

            // 为每个景点获取详细信息
            const detailedPlaces = await Promise.all(
                places.slice(0, 5).map(async (place) => {
                    // 获取评论
                    const reviews = await window.reviewsProcessor.getReviews(place.id, place.provider);
                    const reviewsData = await window.reviewsProcessor.processReviews(reviews, this.currentKeywords);

                    // 获取天气
                    const weather = await window.weatherAPI.getWeather(
                        place.location.lat,
                        place.location.lng,
                        questionnaireData.travelDate
                    );

                    // 获取周边信息
                    const nearbyInfo = await window.nearbyInfoManager.getNearbyInfo(place);

                    // 生成出行推荐
                    const travelRecommendation = await window.travelRecommendationEngine.generateRecommendation(
                        place,
                        questionnaireData,
                        weather,
                        nearbyInfo,
                        this.currentKeywords
                    );

                    // 保存数据
                    if (this.currentSession) {
                        const placeRecord = await this.savePlace(place);
                        if (placeRecord) {
                            await window.reviewsProcessor.saveReviews(placeRecord.id, { ...reviewsData, rawReviews: reviews });
                            if (weather) {
                                await window.weatherAPI.saveWeather(placeRecord.id, questionnaireData.travelDate, weather);
                            }
                            if (nearbyInfo) {
                                await window.nearbyInfoManager.saveNearbyInfo(placeRecord.id, nearbyInfo);
                            }
                            await window.travelRecommendationEngine.saveRecommendation(
                                this.currentSession,
                                placeRecord.id,
                                travelRecommendation
                            );
                        }
                    }

                    return {
                        ...place,
                        reviews: reviewsData,
                        weather: weather,
                        nearbyInfo: nearbyInfo,
                        travelRecommendation: travelRecommendation
                    };
                })
            );

            this.currentRecommendations = detailedPlaces;
            this.renderRecommendations(detailedPlaces);

        } catch (error) {
            console.error('生成推荐失败:', error);
            alert('生成推荐失败：' + error.message);
        } finally {
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            if (recommendationsContainer) recommendationsContainer.classList.remove('hidden');
        }
    }

    async savePlace(place) {
        // 创建临时place记录（用于本地使用）
        const placeRecord = {
            id: 'place_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            session_id: this.currentSession,
            place_name: place.name,
            place_id: place.id,
            address: place.address,
            latitude: place.location.lat,
            longitude: place.location.lng,
            description: place.description,
            image_urls: place.images || [],
            rating: place.rating,
            matched_keywords: place.matchedKeywords || [],
            map_provider: place.provider
        };

        // 如果有Supabase且已登录，保存到数据库
        if (window.supabaseClient && this.currentSession && this.currentSession.startsWith('session_') === false) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('recommended_places')
                    .select('id')
                    .eq('session_id', this.currentSession)
                    .eq('place_id', place.id)
                    .single();

                if (data) return data;

                const { data: newData, error: insertError } = await window.supabaseClient
                    .from('recommended_places')
                    .insert({
                        session_id: this.currentSession,
                        place_name: place.name,
                        place_id: place.id,
                        address: place.address,
                        latitude: place.location.lat,
                        longitude: place.location.lng,
                        description: place.description,
                        image_urls: place.images || [],
                        rating: place.rating,
                        matched_keywords: place.matchedKeywords || [],
                        map_provider: place.provider
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                return newData;
            } catch (error) {
                console.error('保存景点到数据库失败:', error);
            }
        }

        return placeRecord;
    }

    renderRecommendations(places) {
        const container = document.getElementById('recommendations-container');
        if (!container) return;

        container.innerHTML = '';

        places.forEach(place => {
            const card = this.createPlaceCard(place);
            container.appendChild(card);
        });
    }

    createPlaceCard(place) {
        const card = document.createElement('div');
        card.className = 'place-card';

        // 媒体展示
        let mediaHTML = '';
        if (place.video_url) {
            mediaHTML = `
                <div class="place-media">
                    <video controls style="width: 100%; height: 100%; object-fit: cover;">
                        <source src="${place.video_url}" type="video/mp4">
                    </video>
                </div>
            `;
        } else if (place.images && place.images.length > 0) {
            mediaHTML = `
                <div class="place-media">
                    <div class="image-gallery">
                        ${place.images.slice(0, 5).map((img, idx) => `
                            <img src="${img}" alt="${place.name}" onclick="window.appManager.showImageModal('${img}')">
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // 评论摘要
        const reviewsHTML = place.reviews ? `
            <div class="reviews-summary">
                <p>${place.reviews.summary}</p>
                <div class="reviews-meta">基于${place.reviews.count}条网友评论</div>
            </div>
        ` : '';

        // 天气信息
        const weatherHTML = place.weather ? `
            <div class="info-item">
                <span>🌤️</span>
                <span>${place.weather.condition} ${place.weather.temperature?.min}°C - ${place.weather.temperature?.max}°C</span>
            </div>
        ` : '';

        // 出行推荐
        const travelHTML = place.travelRecommendation ? `
            <div class="travel-recommendation">
                <h4>出行建议</h4>
                <div class="recommendation-item">
                    <strong>推荐时间：</strong>${place.travelRecommendation.recommendedTime}
                </div>
                <div class="recommendation-item">
                    <strong>出行方式：</strong>${place.travelRecommendation.recommendedTransport.join('、')}
                </div>
                <div class="recommendation-item">
                    <strong>行程建议：</strong>${place.travelRecommendation.itinerarySuggestion}
                </div>
                <div class="recommendation-item">
                    <strong>注意事项：</strong>${place.travelRecommendation.notes}
                </div>
            </div>
        ` : '';

        card.innerHTML = `
            ${mediaHTML}
            <div class="place-content">
                <div class="place-header">
                    <h3 class="place-name">${place.name}</h3>
                    ${place.rating ? `<div class="place-rating">⭐ ${place.rating}</div>` : ''}
                </div>
                <p style="color: var(--text-secondary); margin: 0.5rem 0;">${place.address}</p>
                ${reviewsHTML}
                <div class="place-keywords">
                    ${place.matchedKeywords?.map(k => `<span class="keyword-tag">${k}</span>`).join('') || ''}
                </div>
                <div class="place-info">
                    ${weatherHTML}
                </div>
                ${travelHTML}
                <div class="place-actions">
                    <button class="btn btn-primary" onclick="window.appManager.addToPlan('${place.id}')">加入计划</button>
                    <a href="https://www.openstreetmap.org/?mlat=${place.location.lat}&mlon=${place.location.lng}&zoom=15" 
                       target="_blank" class="btn btn-secondary">查看地图</a>
                </div>
            </div>
        `;

        return card;
    }

    showImageModal(imageSrc) {
        const modal = document.getElementById('image-modal');
        const modalImage = document.getElementById('modal-image');
        
        if (modal && modalImage) {
            modalImage.src = imageSrc;
            modal.classList.remove('hidden');
        }
    }

    async addToPlan(placeId) {
        // 添加到计划功能
        alert('添加到计划功能待实现');
    }

    async saveApiConfig() {
        const zhipuKey = document.getElementById('zhipu-api-key')?.value;
        const mapKey = document.getElementById('map-api-key')?.value;
        const weatherKey = document.getElementById('weather-api-key')?.value;

        try {
            // 保存到localStorage
            if (zhipuKey) {
                localStorage.setItem('zhipu_api_key', zhipuKey);
                window.aiProcessor.apiKey = zhipuKey;
            }
            if (mapKey) {
                localStorage.setItem('map_api_key', mapKey);
                window.mapAPI.apiKey = mapKey;
            }
            if (weatherKey) {
                localStorage.setItem('weather_api_key', weatherKey);
                window.weatherAPI.apiKey = weatherKey;
            }

            // 如果有Supabase且已登录，也保存到数据库
            if (window.supabaseClient && window.authManager?.isAuthenticated()) {
                const user = window.authManager.getCurrentUser();
                if (user) {
                    const configs = [];
                    
                    if (zhipuKey) {
                        configs.push({
                            user_id: user.id,
                            config_type: 'zhipu',
                            api_key: zhipuKey
                        });
                    }
                    if (mapKey) {
                        configs.push({
                            user_id: user.id,
                            config_type: 'map',
                            api_key: mapKey
                        });
                    }
                    if (weatherKey) {
                        configs.push({
                            user_id: user.id,
                            config_type: 'weather',
                            api_key: weatherKey
                        });
                    }

                    if (configs.length > 0) {
                        const { error } = await window.supabaseClient
                            .from('api_config')
                            .upsert(configs, { onConflict: 'user_id,config_type' });

                        if (error) throw error;
                    }
                }
            }

            alert('配置保存成功！');
            
            // 重新加载配置
            await window.aiProcessor.loadApiConfig();
            await window.mapAPI.loadApiConfig();
            await window.weatherAPI.loadApiConfig();
        } catch (error) {
            console.error('保存配置失败:', error);
            alert('保存配置失败：' + error.message);
        }
    }

    reset() {
        this.currentStep = 1;
        this.currentSession = null;
        this.currentKeywords = [];
        this.currentRecommendations = [];
        
        window.inputHandler.clear();
        window.questionnaireManager.clear();
        
        this.goToStep(1);
    }
}

// 创建全局应用管理器实例
window.appManager = new AppManager();

