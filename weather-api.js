// 天气查询API
class WeatherAPI {
    constructor() {
        this.apiKey = null;
        this.provider = 'heweather'; // 'heweather' 或 'openweather'
        this.heweatherUrl = 'https://devapi.qweather.com/v7/weather/7d';
        this.openweatherUrl = 'https://api.openweathermap.org/data/2.5/forecast';
    }

    async init() {
        await this.loadApiConfig();
    }

    async loadApiConfig() {
        // 尝试从localStorage加载配置
        const savedKey = localStorage.getItem('weather_api_key');
        if (savedKey) {
            this.apiKey = savedKey;
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
                        .eq('config_type', 'weather')
                        .single();

                    if (!error && data) {
                        this.apiKey = data.api_key;
                        if (data.api_url) {
                            if (data.api_url.includes('qweather') || data.api_url.includes('heweather')) {
                                this.provider = 'heweather';
                                this.heweatherUrl = data.api_url;
                            } else if (data.api_url.includes('openweather')) {
                                this.provider = 'openweather';
                                this.openweatherUrl = data.api_url;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('加载天气API配置失败:', error);
            }
        }
    }

    async getWeather(lat, lng, date) {
        if (!this.apiKey) {
            console.warn('天气API密钥未配置');
            return null;
        }

        try {
            if (this.provider === 'heweather') {
                return await this.getHeWeather(lat, lng, date);
            } else {
                return await this.getOpenWeather(lat, lng, date);
            }
        } catch (error) {
            console.error('获取天气失败:', error);
            return null;
        }
    }

    async getHeWeather(lat, lng, date) {
        // 先获取位置信息
        const locationKey = await this.getLocationKey(lat, lng);
        if (!locationKey) return null;

        const params = new URLSearchParams({
            key: this.apiKey,
            location: locationKey
        });

        const response = await fetch(`${this.heweatherUrl}?${params}`);
        const data = await response.json();

        if (data.code !== '200') {
            throw new Error(data.message || '获取天气失败');
        }

        // 找到对应日期的天气
        const targetDate = new Date(date);
        const weather = data.daily?.find(d => {
            const weatherDate = new Date(d.fxDate);
            return weatherDate.toDateString() === targetDate.toDateString();
        });

        if (!weather) return null;

        return {
            date: weather.fxDate,
            temperature: {
                max: parseFloat(weather.tempMax),
                min: parseFloat(weather.tempMin)
            },
            condition: weather.textDay,
            precipitation: parseFloat(weather.precip) || 0,
            windSpeed: parseFloat(weather.windSpeedDay) || 0,
            humidity: parseFloat(weather.humidity) || 0,
            rawData: weather
        };
    }

    async getLocationKey(lat, lng) {
        const params = new URLSearchParams({
            key: this.apiKey,
            location: `${lng},${lat}`
        });

        const response = await fetch(`https://geoapi.qweather.com/v2/city/lookup?${params}`);
        const data = await response.json();

        if (data.code === '200' && data.location && data.location.length > 0) {
            return data.location[0].id;
        }

        return null;
    }

    async getOpenWeather(lat, lng, date) {
        const params = new URLSearchParams({
            appid: this.apiKey,
            lat: lat,
            lon: lng,
            units: 'metric',
            lang: 'zh_cn'
        });

        const response = await fetch(`${this.openweatherUrl}?${params}`);
        const data = await response.json();

        if (data.cod !== '200') {
            throw new Error(data.message || '获取天气失败');
        }

        // 找到对应日期的天气
        const targetDate = new Date(date);
        const weather = data.list?.find(item => {
            const itemDate = new Date(item.dt * 1000);
            return itemDate.toDateString() === targetDate.toDateString();
        });

        if (!weather) return null;

        return {
            date: date,
            temperature: {
                max: weather.main.temp_max,
                min: weather.main.temp_min
            },
            condition: weather.weather[0].description,
            precipitation: weather.rain?.['3h'] || 0,
            windSpeed: weather.wind.speed || 0,
            humidity: weather.main.humidity || 0,
            rawData: weather
        };
    }

    async saveWeather(placeId, date, weatherData) {
        // 如果是临时place ID（以place_开头），不保存到数据库
        if (placeId && placeId.startsWith('place_')) {
            return;
        }

        // 如果有Supabase，尝试保存到数据库
        if (window.supabaseClient && placeId && weatherData) {
            try {
                const { error } = await window.supabaseClient
                    .from('weather_data')
                    .upsert({
                        place_id: placeId,
                        query_date: date,
                        temperature: weatherData.temperature?.max || null,
                        weather_condition: weatherData.condition,
                        precipitation_probability: weatherData.precipitation || 0,
                        wind_speed: weatherData.windSpeed || 0,
                        humidity: weatherData.humidity || 0,
                        weather_data: weatherData.rawData
                    }, {
                        onConflict: 'place_id,query_date'
                    });

                if (error) throw error;
            } catch (error) {
                console.error('保存天气数据失败:', error);
            }
        }
    }
}

// 创建全局天气API实例
window.weatherAPI = new WeatherAPI();

