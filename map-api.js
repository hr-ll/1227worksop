// 地图API集成（OpenStreetMap Nominatim - 免费开源，无需API密钥）
class MapAPI {
    constructor() {
        this.apiKey = null;
        this.provider = 'nominatim'; // 默认使用免费的Nominatim
        this.nominatimUrl = 'https://nominatim.openstreetmap.org/search';
        this.amapUrl = 'https://restapi.amap.com/v3/place/text';
        this.baiduUrl = 'https://api.map.baidu.com/place/v2/search';
    }

    async init() {
        await this.loadApiConfig();
    }

    async loadApiConfig() {
        // 尝试从localStorage加载配置
        const savedKey = localStorage.getItem('map_api_key');
        if (savedKey) {
            this.apiKey = savedKey;
            // 如果有API密钥，尝试使用高德或百度
            this.provider = 'amap'; // 默认使用高德
        } else {
            // 没有API密钥时，使用免费的Nominatim
            this.provider = 'nominatim';
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
                        .eq('config_type', 'map')
                        .single();

                    if (!error && data) {
                        this.apiKey = data.api_key;
                        if (data.api_url) {
                            // 根据URL判断提供商
                            if (data.api_url.includes('amap')) {
                                this.provider = 'amap';
                                this.amapUrl = data.api_url;
                            } else if (data.api_url.includes('baidu')) {
                                this.provider = 'baidu';
                                this.baiduUrl = data.api_url;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('加载地图API配置失败:', error);
            }
        }
    }

    async searchPlaces(keywords, city = '全国') {
        // 优先使用免费的Nominatim，如果有API密钥则使用高德/百度
        if (this.provider === 'nominatim' || !this.apiKey) {
            return await this.searchNominatim(keywords, city);
        } else if (this.provider === 'amap') {
            return await this.searchAmap(keywords, city);
        } else {
            return await this.searchBaidu(keywords, city);
        }
    }

    // 使用OpenStreetMap Nominatim API（免费，无需API密钥）
    async searchNominatim(keywords, city) {
        const query = Array.isArray(keywords) ? keywords.join(' ') : keywords;
        
        // 构建搜索查询，优先搜索景点、公园、自然景观等
        const searchTerms = [
            '景点', 'park', '自然', 'mountain', 'lake', 'beach', 
            'temple', 'garden', 'scenic', 'viewpoint'
        ];
        
        // 组合关键词和搜索词
        const fullQuery = city !== '全国' && city !== '全国' 
            ? `${query} ${city} ${searchTerms.join(' ')}`
            : `${query} ${searchTerms.join(' ')}`;

        const params = new URLSearchParams({
            q: fullQuery,
            format: 'json',
            limit: 20,
            addressdetails: 1,
            extratags: 1,
            namedetails: 1
        });

        try {
            // 添加User-Agent（Nominatim要求）
            const response = await fetch(`${this.nominatimUrl}?${params}`, {
                headers: {
                    'User-Agent': 'EmotionalTravelApp/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`Nominatim API错误: ${response.status}`);
            }

            const data = await response.json();
            return this.formatNominatimResults(data || []);
        } catch (error) {
            console.error('Nominatim搜索失败:', error);
            throw error;
        }
    }

    async searchAmap(keywords, city) {
        const query = Array.isArray(keywords) ? keywords.join(' ') : keywords;
        
        const params = new URLSearchParams({
            key: this.apiKey,
            keywords: query,
            city: city,
            output: 'json',
            offset: 20,
            page: 1,
            extensions: 'all'
        });

        try {
            const response = await fetch(`${this.amapUrl}?${params}`);
            const data = await response.json();

            if (data.status !== '1') {
                throw new Error(data.info || '搜索失败');
            }

            return this.formatAmapResults(data.pois || []);
        } catch (error) {
            console.error('高德地图搜索失败:', error);
            throw error;
        }
    }

    async searchBaidu(keywords, city) {
        const query = Array.isArray(keywords) ? keywords.join(' ') : keywords;
        
        const params = new URLSearchParams({
            ak: this.apiKey,
            query: query,
            region: city,
            output: 'json',
            page_size: 20,
            page_num: 0,
            scope: 2
        });

        try {
            const response = await fetch(`${this.baiduUrl}?${params}`);
            const data = await response.json();

            if (data.status !== 0) {
                throw new Error(data.message || '搜索失败');
            }

            return this.formatBaiduResults(data.results || []);
        } catch (error) {
            console.error('百度地图搜索失败:', error);
            throw error;
        }
    }

    formatAmapResults(pois) {
        return pois.map(poi => ({
            id: poi.id,
            name: poi.name,
            address: poi.address,
            location: {
                lat: parseFloat(poi.location.split(',')[1]),
                lng: parseFloat(poi.location.split(',')[0])
            },
            rating: parseFloat(poi.biz_ext?.rating || 0),
            images: poi.photos?.map(photo => photo.url) || [],
            description: poi.intro || poi.type || '',
            tel: poi.tel || '',
            distance: poi.distance ? parseFloat(poi.distance) : null,
            provider: 'amap'
        }));
    }

    formatNominatimResults(results) {
        return results.map(place => {
            const address = place.address || {};
            const fullAddress = [
                address.road,
                address.suburb,
                address.city || address.town || address.village,
                address.state,
                address.country
            ].filter(Boolean).join(', ');

            return {
                id: place.place_id?.toString() || place.osm_id?.toString() || Math.random().toString(),
                name: place.display_name?.split(',')[0] || place.name || '未知地点',
                address: fullAddress || place.display_name || '',
                location: {
                    lat: parseFloat(place.lat),
                    lng: parseFloat(place.lon)
                },
                rating: 0, // Nominatim不提供评分
                images: [], // Nominatim不提供图片
                description: place.type || place.class || '',
                tel: '',
                distance: null,
                provider: 'nominatim',
                osm_type: place.osm_type,
                category: place.category || place.type
            };
        });
    }

    formatBaiduResults(results) {
        return results.map(poi => ({
            id: poi.uid,
            name: poi.name,
            address: poi.address,
            location: {
                lat: poi.location.lat,
                lng: poi.location.lng
            },
            rating: poi.detail_info?.overall_rating ? parseFloat(poi.detail_info.overall_rating) : 0,
            images: poi.detail_info?.image?.map(img => img) || [],
            description: poi.detail_info?.tag || poi.detail_info?.detail_url || '',
            tel: poi.detail_info?.phone || '',
            distance: poi.detail_info?.distance ? parseFloat(poi.detail_info.distance) : null,
            provider: 'baidu'
        }));
    }

    async getPlaceDetails(placeId, provider) {
        if (provider === 'amap') {
            return await this.getAmapDetails(placeId);
        } else {
            return await this.getBaiduDetails(placeId);
        }
    }

    async getAmapDetails(placeId) {
        const params = new URLSearchParams({
            key: this.apiKey,
            id: placeId,
            output: 'json',
            extensions: 'all'
        });

        const response = await fetch(`https://restapi.amap.com/v3/place/detail?${params}`);
        const data = await response.json();

        if (data.status === '1' && data.pois && data.pois.length > 0) {
            return this.formatAmapResults(data.pois)[0];
        }

        return null;
    }

    async getBaiduDetails(placeId) {
        const params = new URLSearchParams({
            ak: this.apiKey,
            uid: placeId,
            output: 'json',
            scope: 2
        });

        const response = await fetch(`https://api.map.baidu.com/place/v2/detail?${params}`);
        const data = await response.json();

        if (data.status === 0 && data.result) {
            return this.formatBaiduResults([data.result])[0];
        }

        return null;
    }

    async searchNearby(lat, lng, types = ['餐饮', '交通', '住宿']) {
        if (this.provider === 'nominatim' || !this.apiKey) {
            return await this.searchNominatimNearby(lat, lng, types);
        } else if (this.provider === 'amap') {
            return await this.searchAmapNearby(lat, lng, types);
        } else {
            return await this.searchBaiduNearby(lat, lng, types);
        }
    }

    async searchNominatimNearby(lat, lng, types) {
        const results = [];
        const typeMap = {
            '餐饮': ['restaurant', 'cafe', 'food', 'dining'],
            '交通': ['bus_station', 'train_station', 'parking', 'transport'],
            '住宿': ['hotel', 'hostel', 'accommodation', 'lodging']
        };

        for (const type of types) {
            const searchTerms = typeMap[type] || [type.toLowerCase()];
            
            for (const term of searchTerms) {
                try {
                    const params = new URLSearchParams({
                        q: term,
                        format: 'json',
                        limit: 10,
                        lat: lat,
                        lon: lng,
                        radius: 2000, // 2公里范围内
                        addressdetails: 1
                    });

                    const response = await fetch(`${this.nominatimUrl}?${params}`, {
                        headers: {
                            'User-Agent': 'EmotionalTravelApp/1.0'
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const formatted = this.formatNominatimResults(data);
                        results.push(...formatted);
                    }
                } catch (error) {
                    console.error(`搜索附近${type}失败:`, error);
                }
            }
        }

        // 计算距离并排序
        return results.map(place => {
            const distance = this.calculateDistance(lat, lng, place.location.lat, place.location.lng);
            return {
                ...place,
                distance: distance
            };
        }).sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    // 计算两点之间的距离（米）
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // 地球半径（米）
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    async searchAmapNearby(lat, lng, types) {
        const results = [];

        for (const type of types) {
            const params = new URLSearchParams({
                key: this.apiKey,
                location: `${lng},${lat}`,
                keywords: type,
                radius: 2000,
                output: 'json',
                offset: 10
            });

            try {
                const response = await fetch(`https://restapi.amap.com/v3/place/around?${params}`);
                const data = await response.json();

                if (data.status === '1' && data.pois) {
                    results.push(...this.formatAmapResults(data.pois));
                }
            } catch (error) {
                console.error(`搜索附近${type}失败:`, error);
            }
        }

        return results;
    }

    async searchBaiduNearby(lat, lng, types) {
        const results = [];

        for (const type of types) {
            const params = new URLSearchParams({
                ak: this.apiKey,
                location: `${lat},${lng}`,
                query: type,
                radius: 2000,
                output: 'json',
                page_size: 10
            });

            try {
                const response = await fetch(`https://api.map.baidu.com/place/v2/search?${params}`);
                const data = await response.json();

                if (data.status === 0 && data.results) {
                    results.push(...this.formatBaiduResults(data.results));
                }
            } catch (error) {
                console.error(`搜索附近${type}失败:`, error);
            }
        }

        return results;
    }
}

// 创建全局地图API实例
window.mapAPI = new MapAPI();

