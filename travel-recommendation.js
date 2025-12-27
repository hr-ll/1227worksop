// 出行方式、时间推荐
class TravelRecommendationEngine {
    constructor() {
        this.aiProcessor = window.aiProcessor;
    }

    async generateRecommendation(place, questionnaireData, weatherData, nearbyInfo, keywords) {
        try {
            // 综合分析所有信息
            const recommendation = await this.analyzeAndRecommend(
                place,
                questionnaireData,
                weatherData,
                nearbyInfo,
                keywords
            );

            return recommendation;
        } catch (error) {
            console.error('生成推荐失败:', error);
            // 返回基础推荐
            return this.getBasicRecommendation(place, questionnaireData, weatherData);
        }
    }

    async analyzeAndRecommend(place, questionnaireData, weatherData, nearbyInfo, keywords) {
        if (!this.aiProcessor || !this.aiProcessor.apiKey) {
            return this.getBasicRecommendation(place, questionnaireData, weatherData);
        }

        const context = this.buildContext(place, questionnaireData, weatherData, nearbyInfo, keywords);
        const prompt = `作为旅行规划专家，请根据以下信息为这个景点生成出行推荐：

${context}

请提供：
1. 最佳出行时间（具体到小时，考虑天气和人流量）
2. 推荐出行方式（自驾/公共交通/步行等，说明理由）
3. 行程安排建议（简要说明）
4. 注意事项（如天气、交通等）

请以JSON格式返回，格式如下：
{
  "recommendedTime": "具体时间",
  "recommendedTransport": ["方式1", "方式2"],
  "itinerarySuggestion": "建议内容",
  "notes": "注意事项"
}`;

        try {
            const response = await this.aiProcessor.callGLM4(prompt);
            // 尝试解析JSON
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            } else {
                // 如果无法解析，返回基础推荐
                return this.getBasicRecommendation(place, questionnaireData, weatherData);
            }
        } catch (error) {
            console.error('AI推荐生成失败:', error);
            return this.getBasicRecommendation(place, questionnaireData, weatherData);
        }
    }

    buildContext(place, questionnaireData, weatherData, nearbyInfo, keywords) {
        let context = `景点信息：
- 名称：${place.name}
- 地址：${place.address}
- 评分：${place.rating || '未知'}
- 情绪关键词：${keywords.join('、')}

出行信息：
- 日期：${questionnaireData.travelDate}
- 时间偏好：${this.translateTime(questionnaireData.travelTime)}
- 人数：${questionnaireData.travelerCount}
- 出发地：${questionnaireData.departureLocation}`;

        if (weatherData) {
            context += `\n\n天气信息：
- 温度：${weatherData.temperature?.min}°C - ${weatherData.temperature?.max}°C
- 天气：${weatherData.condition}
- 降雨概率：${weatherData.precipitation || 0}mm
- 风速：${weatherData.windSpeed || 0}m/s`;
        }

        if (nearbyInfo) {
            context += `\n\n周边设施：`;
            if (nearbyInfo.transport?.length > 0) {
                context += `\n- 交通：${nearbyInfo.transport.slice(0, 3).map(t => t.name).join('、')}`;
            }
            if (nearbyInfo.dining?.length > 0) {
                context += `\n- 餐饮：${nearbyInfo.dining.slice(0, 3).map(d => d.name).join('、')}`;
            }
            if (nearbyInfo.accommodation?.length > 0) {
                context += `\n- 住宿：${nearbyInfo.accommodation.slice(0, 3).map(a => a.name).join('、')}`;
            }
        }

        return context;
    }

    getBasicRecommendation(place, questionnaireData, weatherData) {
        const time = questionnaireData.travelTime || 'afternoon';
        const recommendedTime = this.getRecommendedTime(time, weatherData);
        const transport = this.getRecommendedTransport(place, questionnaireData);

        return {
            recommendedTime: recommendedTime,
            recommendedTransport: transport,
            itinerarySuggestion: `建议在${recommendedTime}到达${place.name}，游览时间约2-3小时。`,
            notes: weatherData ? `注意天气：${weatherData.condition}，温度${weatherData.temperature?.min}-${weatherData.temperature?.max}°C` : '请注意天气变化'
        };
    }

    getRecommendedTime(timePreference, weatherData) {
        const timeMap = {
            morning: '09:00',
            afternoon: '14:00',
            evening: '18:00',
            night: '20:00'
        };

        let recommended = timeMap[timePreference] || '14:00';

        // 根据天气调整
        if (weatherData) {
            if (weatherData.condition?.includes('雨')) {
                // 如果下雨，建议避开
                recommended = '10:00'; // 早一点，可能雨小
            } else if (weatherData.temperature?.max > 30) {
                // 如果很热，建议早一点或晚一点
                if (timePreference === 'afternoon') {
                    recommended = '16:00';
                }
            }
        }

        return recommended;
    }

    getRecommendedTransport(place, questionnaireData) {
        const transport = [];

        // 根据距离和人数推荐
        if (place.distance) {
            if (place.distance < 500) {
                transport.push('步行');
            } else if (place.distance < 5000) {
                transport.push('公共交通');
                if (questionnaireData.travelerCount >= 3) {
                    transport.push('打车');
                }
            } else {
                transport.push('自驾');
                transport.push('公共交通');
            }
        } else {
            transport.push('公共交通');
            transport.push('自驾');
        }

        return transport;
    }

    translateTime(time) {
        const timeMap = {
            morning: '上午',
            afternoon: '下午',
            evening: '晚上',
            night: '夜间'
        };
        return timeMap[time] || time;
    }

    async saveRecommendation(sessionId, placeId, recommendation) {
        // 如果是临时session或place ID，不保存到数据库
        if ((sessionId && sessionId.startsWith('session_')) || (placeId && placeId.startsWith('place_'))) {
            return;
        }

        // 如果有Supabase，尝试保存到数据库
        if (window.supabaseClient && sessionId && placeId) {
            try {
                const { error } = await window.supabaseClient
                    .from('travel_recommendations')
                    .insert({
                        session_id: sessionId,
                        place_id: placeId,
                        recommended_time: recommendation.recommendedTime,
                        recommended_transport: recommendation.recommendedTransport,
                        itinerary_suggestion: recommendation.itinerarySuggestion,
                        notes: recommendation.notes,
                        recommendation_data: recommendation
                    });

                if (error) throw error;
            } catch (error) {
                console.error('保存出行推荐失败:', error);
            }
        }
    }
}

// 创建全局出行推荐引擎实例
window.travelRecommendationEngine = new TravelRecommendationEngine();

