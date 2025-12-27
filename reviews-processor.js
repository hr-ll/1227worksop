// 网友评论获取和AI精简处理
class ReviewsProcessor {
    constructor() {
        this.aiProcessor = window.aiProcessor;
    }

    async getReviews(placeId, provider) {
        // 从地图API获取评论
        // 注意：实际实现需要根据具体API调整
        try {
            if (provider === 'amap') {
                return await this.getAmapReviews(placeId);
            } else {
                return await this.getBaiduReviews(placeId);
            }
        } catch (error) {
            console.error('获取评论失败:', error);
            return [];
        }
    }

    async getAmapReviews(placeId) {
        // 高德地图评论API（需要根据实际API文档调整）
        // 这里返回模拟数据，实际应该调用真实API
        return [
            { content: '景色很美，适合放松心情', rating: 5, time: '2024-01-01' },
            { content: '环境安静，空气清新', rating: 5, time: '2024-01-02' },
            { content: '值得一去的好地方', rating: 4, time: '2024-01-03' },
        ];
    }

    async getBaiduReviews(placeId) {
        // 百度地图评论API（需要根据实际API文档调整）
        return [
            { content: '景色很美，适合放松心情', rating: 5, time: '2024-01-01' },
            { content: '环境安静，空气清新', rating: 5, time: '2024-01-02' },
        ];
    }

    async processReviews(reviews, keywords = []) {
        if (!reviews || reviews.length === 0) {
            return {
                summary: '暂无评论',
                count: 0,
                sentiment: 'neutral'
            };
        }

        try {
            // 使用AI精简评论
            const summary = await this.summarizeReviews(reviews, keywords);
            const sentiment = this.analyzeSentiment(reviews);

            return {
                summary: summary,
                count: reviews.length,
                sentiment: sentiment
            };
        } catch (error) {
            console.error('处理评论失败:', error);
            // 如果AI处理失败，返回简单摘要
            return {
                summary: this.simpleSummary(reviews),
                count: reviews.length,
                sentiment: 'neutral'
            };
        }
    }

    async summarizeReviews(reviews, keywords) {
        if (!this.aiProcessor || !this.aiProcessor.apiKey) {
            return this.simpleSummary(reviews);
        }

        const reviewsText = reviews.map(r => r.content).join('\n');
        const keywordsText = keywords.join('、');

        const prompt = `请分析以下网友评论，提取与关键词"${keywordsText}"相关的核心观点，生成2-5句精简的评论摘要。只返回摘要内容，不要其他解释：

${reviewsText}

评论摘要：`;

        try {
            const response = await this.aiProcessor.callGLM4(prompt);
            return response.trim();
        } catch (error) {
            console.error('AI评论精简失败:', error);
            return this.simpleSummary(reviews);
        }
    }

    simpleSummary(reviews) {
        // 简单摘要：取前几条评论的关键内容
        const summary = reviews.slice(0, 3).map(r => r.content).join('；');
        return summary.length > 100 ? summary.substring(0, 100) + '...' : summary;
    }

    analyzeSentiment(reviews) {
        // 简单的情感分析：基于评分
        const avgRating = reviews.reduce((sum, r) => sum + (r.rating || 3), 0) / reviews.length;
        
        if (avgRating >= 4.5) {
            return 'positive';
        } else if (avgRating >= 3.5) {
            return 'neutral';
        } else {
            return 'negative';
        }
    }

    async saveReviews(placeId, reviewsData) {
        // 如果是临时place ID（以place_开头），不保存到数据库
        if (placeId && placeId.startsWith('place_')) {
            return;
        }

        // 如果有Supabase，尝试保存到数据库
        if (window.supabaseClient && placeId) {
            try {
                const { error } = await window.supabaseClient
                    .from('place_reviews')
                    .upsert({
                        place_id: placeId,
                        raw_reviews: reviewsData.rawReviews || [],
                        ai_summary: reviewsData.summary,
                        review_count: reviewsData.count,
                        sentiment: reviewsData.sentiment
                    }, {
                        onConflict: 'place_id'
                    });

                if (error) throw error;
            } catch (error) {
                console.error('保存评论失败:', error);
            }
        }
    }
}

// 创建全局评论处理器实例
window.reviewsProcessor = new ReviewsProcessor();

