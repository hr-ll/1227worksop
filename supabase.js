// Supabase客户端初始化
// 用户需要自行配置 SUPABASE_URL 和 SUPABASE_ANON_KEY

// TODO: 请替换为您的Supabase项目URL和匿名密钥
const SUPABASE_URL = 'https://mhythqemhjlcnwwvgggs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_u7Ie350hY1sjTCwjDSA25w_s5wzZnkf';

// 初始化Supabase客户端
let supabaseClient = null;

try {
    if (typeof supabase !== 'undefined' && SUPABASE_URL !== 'https://mhythqemhjlcnwwvgggs.supabase.co') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn('Supabase未配置，请设置 SUPABASE_URL 和 SUPABASE_ANON_KEY');
    }
} catch (error) {
    console.error('Supabase初始化失败:', error);
}

// 导出Supabase客户端
window.supabaseClient = supabaseClient;

