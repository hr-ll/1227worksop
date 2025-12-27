// 景点推荐引擎
class RecommendationEngine {
    constructor() {
        this.currentSession = null;
    }

    async recommend(keywords, city = '全国') {
        try {
            // 调用地图API搜索景点
            const places = await window.mapAPI.searchPlaces(keywords, city);

            // 基于关键词匹配度排序
            const scoredPlaces = this.scorePlaces(places, keywords);

            // 返回排序后的景点列表
            return scoredPlaces.sort((a, b) => b.score - a.score);
        } catch (error) {
            console.error('推荐失败:', error);
            throw error;
        }
    }

    scorePlaces(places, keywords) {
        return places.map(place => {
            let score = 0;

            // 基础评分
            if (place.rating) {
                score += place.rating * 10;
            }

            // 关键词匹配评分
            const placeText = `${place.name} ${place.address} ${place.description}`.toLowerCase();
            keywords.forEach(keyword => {
                if (placeText.includes(keyword.toLowerCase())) {
                    score += 20;
                }
            });

            // 距离评分（如果有）
            if (place.distance) {
                // 距离越近分数越高
                score += Math.max(0, 50 - place.distance / 100);
            }

            return {
                ...place,
                score: score,
                matchedKeywords: keywords.filter(k => 
                    placeText.includes(k.toLowerCase())
                )
            };
        });
    }

    async saveRecommendation(sessionId, places) {
        // 如果是临时session（以session_开头），不保存到数据库
        if (sessionId && sessionId.startsWith('session_')) {
            return;
        }

        // 如果有Supabase，尝试保存到数据库
        if (window.supabaseClient && sessionId) {
            try {
                const placesToSave = places.map(place => ({
                    session_id: sessionId,
                    place_name: place.name,
                    place_id: place.id,
                    address: place.address,
                    latitude: place.location.lat,
                    longitude: place.location.lng,
                    description: place.description,
                    image_urls: place.images || [],
                    video_url: null, // 视频URL需要单独获取
                    rating: place.rating,
                    matched_keywords: place.matchedKeywords || [],
                    map_provider: place.provider
                }));

                const { error } = await window.supabaseClient
                    .from('recommended_places')
                    .insert(placesToSave);

                if (error) throw error;
            } catch (error) {
                console.error('保存推荐失败:', error);
            }
        }
    }
}

// 创建全局推荐引擎实例
window.recommendationEngine = new RecommendationEngine();

