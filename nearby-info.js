// 景点周边情况查询
class NearbyInfoManager {
    constructor() {
        this.mapAPI = window.mapAPI;
    }

    async getNearbyInfo(place) {
        if (!place.location) {
            return null;
        }

        try {
            const { lat, lng } = place.location;
            const nearbyPlaces = await this.mapAPI.searchNearby(lat, lng, ['餐饮', '交通', '住宿']);

            return this.organizeNearbyInfo(nearbyPlaces);
        } catch (error) {
            console.error('获取周边信息失败:', error);
            return null;
        }
    }

    organizeNearbyInfo(places) {
        const organized = {
            transport: [],
            dining: [],
            accommodation: [],
            other: []
        };

        places.forEach(place => {
            const type = this.categorizePlace(place);
            organized[type].push({
                name: place.name,
                address: place.address,
                distance: place.distance,
                rating: place.rating,
                location: place.location
            });
        });

        // 按距离排序
        Object.keys(organized).forEach(key => {
            organized[key].sort((a, b) => (a.distance || 0) - (b.distance || 0));
        });

        return organized;
    }

    categorizePlace(place) {
        const name = place.name.toLowerCase();
        const address = (place.address || '').toLowerCase();
        const text = `${name} ${address}`;

        if (text.includes('地铁') || text.includes('公交') || text.includes('站') || text.includes('停车场')) {
            return 'transport';
        } else if (text.includes('餐厅') || text.includes('饭店') || text.includes('美食') || text.includes('小吃')) {
            return 'dining';
        } else if (text.includes('酒店') || text.includes('宾馆') || text.includes('民宿') || text.includes('住宿')) {
            return 'accommodation';
        } else {
            return 'other';
        }
    }

    async saveNearbyInfo(placeId, nearbyInfo) {
        // 如果是临时place ID（以place_开头），不保存到数据库
        if (placeId && placeId.startsWith('place_')) {
            return;
        }

        // 如果有Supabase，尝试保存到数据库
        if (window.supabaseClient && placeId && nearbyInfo) {
            try {
                const records = [];

                Object.keys(nearbyInfo).forEach(infoType => {
                    nearbyInfo[infoType].forEach(item => {
                        records.push({
                            place_id: placeId,
                            info_type: infoType,
                            name: item.name,
                            distance: item.distance,
                            rating: item.rating,
                            address: item.address,
                            latitude: item.location?.lat,
                            longitude: item.location?.lng,
                            additional_info: {}
                        });
                    });
                });

                if (records.length > 0) {
                    const { error } = await window.supabaseClient
                        .from('nearby_info')
                        .insert(records);

                    if (error) throw error;
                }
            } catch (error) {
                console.error('保存周边信息失败:', error);
            }
        }
    }
}

// 创建全局周边信息管理器实例
window.nearbyInfoManager = new NearbyInfoManager();

