// 智谱AI处理（关键词提取）
class AIProcessor {
    constructor() {
        // 可以直接在这里设置API密钥（用于测试，生产环境建议使用设置面板）
        this.apiKey = '44712b774a124c67932099f3085a26c4.OHd1n1nloNbS6nGD';
        this.apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    }

    async init() {
        // 从数据库或配置中获取API密钥
        await this.loadApiConfig();
    }

    async loadApiConfig() {
        // 如果已经在构造函数中设置了API密钥，优先使用
        if (this.apiKey) {
            return;
        }

        // 尝试从localStorage加载配置
        const savedKey = localStorage.getItem('zhipu_api_key');
        if (savedKey) {
            this.apiKey = savedKey;
            return;
        }

        // 如果有Supabase且已登录，从数据库加载
        if (window.supabaseClient && window.authManager?.isAuthenticated()) {
            try {
                const user = window.authManager.getCurrentUser();
                if (user) {
                    const { data, error } = await window.supabaseClient
                        .from('api_config')
                        .select('api_key, api_url')
                        .eq('user_id', user.id)
                        .eq('config_type', 'zhipu')
                        .single();

                    if (!error && data) {
                        this.apiKey = data.api_key;
                        if (data.api_url) {
                            this.apiUrl = data.api_url;
                        }
                    }
                }
            } catch (error) {
                console.error('加载API配置失败:', error);
            }
        }
    }

    async extractKeywords(inputData) {
        if (!this.apiKey) {
            throw new Error('智谱API密钥未配置，请在设置中配置');
        }

        const { type, files, text } = inputData;

        try {
            switch (type) {
                case 'image':
                    return await this.processImages(files.image);
                case 'audio':
                    return await this.processAudio(files.audio);
                case 'video':
                    return await this.processVideo(files.video);
                case 'text':
                    return await this.processText(text);
                default:
                    throw new Error('不支持的输入类型');
            }
        } catch (error) {
            console.error('关键词提取失败:', error);
            throw error;
        }
    }

    async processImages(imageFiles) {
        // 使用GLM-4V处理图片
        const keywords = [];

        for (const file of imageFiles) {
            try {
                const base64 = await this.fileToBase64(file);
                const imageKeywords = await this.callGLM4V(base64);
                if (imageKeywords && imageKeywords.length > 0) {
                    keywords.push(...imageKeywords);
                }
            } catch (error) {
                console.error('处理图片失败:', error);
                // 继续处理下一张图片
            }
        }

        // 去重并合并
        return [...new Set(keywords)];
    }

    async processAudio(audioFile) {
        // 音频处理：提取音频特征，然后转换为情绪和空间倾向
        // 注意：如果智谱API不支持音频，这里需要先转文本
        try {
            const base64 = await this.fileToBase64(audioFile);
            const features = await this.extractAudioFeatures(base64);
            const emotionKeywords = this.mapAudioFeaturesToEmotions(features);
            const spatialTendencies = this.mapAudioFeaturesToSpatialTendencies(features);
            return [...emotionKeywords, ...spatialTendencies];
        } catch (error) {
            console.error('音频处理失败，尝试文本转换:', error);
            // 如果音频处理失败，可以尝试使用音频转文本服务
            return ['音乐', '音频', '声音'];
        }
    }

    async extractAudioFeatures(audioBase64) {
        // 如果API支持音频分析，提取特征
        // 否则返回默认特征
        return {
            tempo: '中等',
            mood: '中性',
            instruments: [],
            rhythm: '中等',
            volume: '中等'
        };
    }

    mapAudioFeaturesToEmotions(features) {
        const emotions = [];
        const { tempo, mood, rhythm, volume } = features;

        // 基于节奏映射情绪
        if (tempo.includes('快') || tempo.includes('快节奏')) {
            emotions.push('活力', '兴奋', '动感');
        } else if (tempo.includes('慢') || tempo.includes('慢节奏')) {
            emotions.push('放松', '宁静', '舒缓');
        }

        // 基于情绪映射
        if (mood.includes('快乐') || mood.includes('欢快')) {
            emotions.push('快乐', '积极', '开朗');
        } else if (mood.includes('悲伤') || mood.includes('忧郁')) {
            emotions.push('深沉', '安静', '内省');
        } else if (mood.includes('平静')) {
            emotions.push('平静', '放松', '舒适');
        }

        // 基于音量映射
        if (volume.includes('大') || volume.includes('响亮')) {
            emotions.push('强烈', '震撼', '活力');
        } else if (volume.includes('小') || volume.includes('轻柔')) {
            emotions.push('温柔', '安静', '私密');
        }

        return [...new Set(emotions)];
    }

    mapAudioFeaturesToSpatialTendencies(features) {
        const tendencies = [];
        const { tempo, mood, instruments, rhythm } = features;

        // 基于节奏映射空间倾向
        if (tempo.includes('快')) {
            tendencies.push('动态', '活力', '探索');
        } else if (tempo.includes('慢')) {
            tendencies.push('安静', '放松', '私密');
        }

        // 基于乐器映射空间倾向
        if (instruments.some(inst => inst.includes('自然') || inst.includes('鸟'))) {
            tendencies.push('自然', '户外', '森林');
        } else if (instruments.some(inst => inst.includes('城市') || inst.includes('电子'))) {
            tendencies.push('城市', '现代', '活力');
        }

        // 基于情绪映射空间倾向
        if (mood.includes('快乐') || mood.includes('欢快')) {
            tendencies.push('开阔', '户外', '阳光');
        } else if (mood.includes('平静')) {
            tendencies.push('安静', '自然', '放松');
        }

        return [...new Set(tendencies)];
    }

    async processVideo(videoFile) {
        // 视频处理：提取关键帧和音频
        // 简化处理：提取第一帧作为图片分析
        const frame = await this.extractVideoFrame(videoFile);
        const base64 = await this.canvasToBase64(frame);
        return await this.callGLM4V(base64);
    }

    async processText(text) {
        // 使用GLM-4处理文本，提取情绪和空间倾向
        const prompt = `请分析以下文本描述，提取：
1. 情绪关键词（如：宁静、兴奋、放松等）
2. 空间倾向关键词（如：自然、开阔、私密、水边、山地等）

文本：${text}

请以JSON格式返回：
{
  "emotions": ["情绪1", "情绪2", ...],
  "spatial_tendencies": ["空间倾向1", "空间倾向2", ...]
}

只返回JSON，不要其他解释。`;

        try {
            const response = await this.callGLM4(prompt);
            const parsed = this.parseTextResponse(response);
            return [...parsed.emotions, ...parsed.spatial_tendencies];
        } catch (error) {
            console.error('文本处理失败，使用简单提取:', error);
            // 如果解析失败，使用简单关键词提取
            const simplePrompt = `从以下文本中提取关键词，用逗号分隔：${text}`;
            const response = await this.callGLM4(simplePrompt);
            return response.split(/[,，、]/).map(k => k.trim()).filter(k => k);
        }
    }

    parseTextResponse(responseText) {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    emotions: parsed.emotions || [],
                    spatial_tendencies: parsed.spatial_tendencies || []
                };
            }
        } catch (error) {
            console.error('解析文本响应失败:', error);
        }
        return {
            emotions: [],
            spatial_tendencies: []
        };
    }

    async callGLM4V(imageBase64) {
        // 第一步：提取图像的客观特征（物体、颜色、明暗、构图等）
        const featurePrompt = `请详细分析这张图片的客观特征，以JSON格式返回：
{
  "objects": ["物体1", "物体2", ...],  // 图片中的主要物体和元素
  "colors": ["颜色1", "颜色2", ...],   // 主要颜色（如：蓝色、绿色、暖色调等）
  "brightness": "明暗程度",           // 明亮/中等/昏暗
  "contrast": "对比度",               // 高/中/低
  "composition": "构图特点",          // 如：开阔、紧凑、对称等
  "texture": "质感",                  // 如：光滑、粗糙、自然等
  "atmosphere": "氛围特征"            // 如：空旷、密集、流动等
}

只返回JSON，不要其他解释。`;

        const featureMessages = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: featurePrompt
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${imageBase64}`
                        }
                    }
                ]
            }
        ];

        try {
            // 提取图像特征
            const featureResponse = await this.callAPIForFeatures(featureMessages, 'glm-4.7');
            const features = this.parseFeatures(featureResponse);
            
            // 第二步：基于规则将特征转换为情绪关键词和空间倾向
            const emotionKeywords = this.mapFeaturesToEmotions(features);
            const spatialTendencies = this.mapFeaturesToSpatialTendencies(features);
            
            // 合并情绪关键词和空间倾向
            return [...emotionKeywords, ...spatialTendencies];
        } catch (error) {
            console.warn('使用glm-4.7失败，尝试glm-4-flash:', error);
            try {
                const featureResponse = await this.callAPIForFeatures(featureMessages, 'glm-4-flash');
                const features = this.parseFeatures(featureResponse);
                const emotionKeywords = this.mapFeaturesToEmotions(features);
                const spatialTendencies = this.mapFeaturesToSpatialTendencies(features);
                return [...emotionKeywords, ...spatialTendencies];
            } catch (e) {
                console.warn('使用glm-4-flash失败，尝试glm-4v:', e);
                const featureResponse = await this.callAPIForFeatures(featureMessages, 'glm-4v');
                const features = this.parseFeatures(featureResponse);
                const emotionKeywords = this.mapFeaturesToEmotions(features);
                const spatialTendencies = this.mapFeaturesToSpatialTendencies(features);
                return [...emotionKeywords, ...spatialTendencies];
            }
        }
    }

    async callAPIForFeatures(messages, model) {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: 0.3, // 降低温度以获得更准确的客观描述
                })
            });

            const responseText = await response.text();

            if (!response.ok) {
                let errorData;
                try {
                    errorData = JSON.parse(responseText);
                } catch (e) {
                    throw new Error(`API调用失败: ${response.status} ${response.statusText}`);
                }
                throw new Error(errorData.error?.message || errorData.message || 'API调用失败');
            }

            const data = JSON.parse(responseText);
            return data.choices?.[0]?.message?.content || data.data?.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error('API调用错误:', error);
            throw error;
        }
    }

    parseFeatures(responseText) {
        try {
            // 尝试提取JSON
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            // 如果无法解析，返回默认结构
            return {
                objects: [],
                colors: [],
                brightness: '中等',
                contrast: '中等',
                composition: '',
                texture: '',
                atmosphere: ''
            };
        } catch (error) {
            console.error('解析特征失败:', error);
            return {
                objects: [],
                colors: [],
                brightness: '中等',
                contrast: '中等',
                composition: '',
                texture: '',
                atmosphere: ''
            };
        }
    }

    // 基于规则将图像特征映射到情绪关键词
    mapFeaturesToEmotions(features) {
        const emotions = [];
        const { objects, colors, brightness, contrast, composition, texture, atmosphere } = features;

        // 基于颜色映射情绪
        const colorEmotionMap = {
            '蓝色': ['宁静', '冷静', '清新'],
            '绿色': ['自然', '放松', '生机'],
            '黄色': ['温暖', '活力', '明亮'],
            '红色': ['热情', '活力', '温暖'],
            '橙色': ['温暖', '舒适', '活力'],
            '紫色': ['神秘', '优雅', '宁静'],
            '粉色': ['温柔', '浪漫', '舒适'],
            '白色': ['纯净', '简洁', '宁静'],
            '黑色': ['深沉', '神秘', '安静'],
            '灰色': ['平静', '中性', '沉稳'],
            '暖色调': ['温暖', '舒适', '亲切'],
            '冷色调': ['冷静', '清新', '宁静']
        };

        colors.forEach(color => {
            const colorLower = color.toLowerCase();
            for (const [key, values] of Object.entries(colorEmotionMap)) {
                if (colorLower.includes(key) || color.includes(key)) {
                    emotions.push(...values);
                    break;
                }
            }
        });

        // 基于明暗映射情绪
        if (brightness.includes('明亮') || brightness.includes('亮')) {
            emotions.push('开朗', '积极', '清晰');
        } else if (brightness.includes('昏暗') || brightness.includes('暗')) {
            emotions.push('安静', '深沉', '神秘');
        } else {
            emotions.push('平衡', '舒适');
        }

        // 基于对比度映射情绪
        if (contrast.includes('高')) {
            emotions.push('鲜明', '强烈', '清晰');
        } else if (contrast.includes('低')) {
            emotions.push('柔和', '温和', '平静');
        }

        // 基于构图映射情绪
        if (composition.includes('开阔') || composition.includes('空旷')) {
            emotions.push('自由', '放松', '开阔');
        } else if (composition.includes('紧凑') || composition.includes('密集')) {
            emotions.push('温馨', '亲密', '安全');
        }

        // 基于质感映射情绪
        if (texture.includes('自然') || texture.includes('粗糙')) {
            emotions.push('自然', '原始', '真实');
        } else if (texture.includes('光滑') || texture.includes('精致')) {
            emotions.push('优雅', '精致', '现代');
        }

        // 基于氛围映射情绪
        if (atmosphere.includes('空旷')) {
            emotions.push('自由', '开阔', '放松');
        } else if (atmosphere.includes('密集')) {
            emotions.push('热闹', '活力', '丰富');
        } else if (atmosphere.includes('流动')) {
            emotions.push('动态', '活力', '变化');
        }

        return [...new Set(emotions)]; // 去重
    }

    // 基于规则将图像特征映射到空间倾向
    mapFeaturesToSpatialTendencies(features) {
        const tendencies = [];
        const { objects, colors, brightness, contrast, composition, texture, atmosphere } = features;

        // 基于物体映射空间倾向
        const objectSpatialMap = {
            '山': ['山地', '自然', '户外'],
            '水': ['水边', '湖泊', '河流'],
            '海': ['海边', '海岸', '海洋'],
            '树': ['森林', '公园', '自然'],
            '花': ['花园', '自然', '户外'],
            '建筑': ['城市', '现代', '人文'],
            '天空': ['开阔', '户外', '自然'],
            '云': ['开阔', '自然', '户外'],
            '路': ['探索', '旅行', '户外'],
            '桥': ['水边', '连接', '人文']
        };

        objects.forEach(obj => {
            for (const [key, values] of Object.entries(objectSpatialMap)) {
                if (obj.includes(key)) {
                    tendencies.push(...values);
                    break;
                }
            }
        });

        // 基于颜色映射空间倾向
        const colorSpatialMap = {
            '蓝色': ['水边', '天空', '开阔'],
            '绿色': ['自然', '森林', '公园'],
            '黄色': ['温暖', '阳光', '户外'],
            '暖色调': ['温暖', '舒适', '室内'],
            '冷色调': ['清新', '自然', '户外']
        };

        colors.forEach(color => {
            const colorLower = color.toLowerCase();
            for (const [key, values] of Object.entries(colorSpatialMap)) {
                if (colorLower.includes(key) || color.includes(key)) {
                    tendencies.push(...values);
                    break;
                }
            }
        });

        // 基于明暗映射空间倾向
        if (brightness.includes('明亮')) {
            tendencies.push('开阔', '户外', '阳光');
        } else if (brightness.includes('昏暗')) {
            tendencies.push('安静', '室内', '私密');
        }

        // 基于构图映射空间倾向
        if (composition.includes('开阔') || composition.includes('空旷')) {
            tendencies.push('开阔', '户外', '自然');
        } else if (composition.includes('紧凑')) {
            tendencies.push('温馨', '室内', '私密');
        }

        // 基于氛围映射空间倾向
        if (atmosphere.includes('空旷')) {
            tendencies.push('开阔', '自然', '户外');
        } else if (atmosphere.includes('密集')) {
            tendencies.push('丰富', '热闹', '城市');
        } else if (atmosphere.includes('流动')) {
            tendencies.push('动态', '变化', '探索');
        }

        return [...new Set(tendencies)]; // 去重
    }

    async callGLM4(prompt) {
        const messages = [
            {
                role: 'user',
                content: prompt
            }
        ];

        return await this.callAPI(messages, 'glm-4.7');
    }

    async callGLM4Audio(audioBase64) {
        // 如果智谱API支持音频，使用类似方式调用
        // 否则需要先转文本
        const prompt = `请分析这段音频中的情绪和氛围，提取3-8个关键词，只返回关键词，用逗号分隔。`;

        const messages = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: prompt
                    },
                    {
                        type: 'audio',
                        audio: `data:audio/mpeg;base64,${audioBase64}`
                    }
                ]
            }
        ];

        return await this.callAPI(messages);
    }

    async callAPI(messages, model = 'glm-4.7') {
        try {
            // 构建请求体
            const requestBody = {
                model: model,
                messages: messages,
                temperature: 0.7,
            };

            console.log('API请求:', {
                url: this.apiUrl,
                model: model,
                messagesCount: messages.length
            });

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            const responseText = await response.text();
            console.log('API响应状态:', response.status);
            console.log('API响应内容:', responseText);

            if (!response.ok) {
                let errorData;
                try {
                    errorData = JSON.parse(responseText);
                } catch (e) {
                    throw new Error(`API调用失败: ${response.status} ${response.statusText}\n响应内容: ${responseText}`);
                }
                const errorMsg = errorData.error?.message || errorData.message || errorData.msg || 'API调用失败';
                throw new Error(errorMsg);
            }

            const data = JSON.parse(responseText);
            const content = data.choices?.[0]?.message?.content || data.data?.choices?.[0]?.message?.content || '';
            
            if (!content) {
                console.error('API返回数据:', data);
                throw new Error('API返回内容为空，请检查API响应格式');
            }
            
            // 提取关键词
            const keywords = content.split(/[,，、]/).map(k => k.trim()).filter(k => k);
            
            if (keywords.length === 0) {
                // 如果没有找到关键词，返回整个内容作为单个关键词
                return [content.trim()];
            }
            
            return keywords;
        } catch (error) {
            console.error('API调用错误:', error);
            throw error;
        }
    }

    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async extractVideoFrame(videoFile) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(videoFile);
            video.onloadedmetadata = () => {
                video.currentTime = 1; // 提取第1秒的帧
            };
            video.onseeked = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);
                resolve(canvas);
                URL.revokeObjectURL(video.src);
            };
            video.onerror = reject;
        });
    }

    async canvasToBase64(canvas) {
        return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    }
}

// 创建全局AI处理器实例
window.aiProcessor = new AIProcessor();

