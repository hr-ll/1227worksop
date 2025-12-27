// 用户认证管理
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        if (!window.supabaseClient) {
            console.error('Supabase客户端未初始化');
            return;
        }

        // 检查当前会话
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            this.currentUser = session.user;
            this.updateUI();
        }

        // 监听认证状态变化
        window.supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                this.currentUser = session.user;
                this.updateUI();
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.updateUI();
            }
        });
    }

    async signUp(email, password, username = null) {
        if (!window.supabaseClient) {
            throw new Error('Supabase客户端未初始化');
        }

        try {
            const { data, error } = await window.supabaseClient.auth.signUp({
                email,
                password,
            });

            if (error) throw error;

            // 创建用户资料
            if (data.user && username) {
                await this.createUserProfile(data.user.id, username);
            }

            return { success: true, data };
        } catch (error) {
            console.error('注册失败:', error);
            return { success: false, error: error.message };
        }
    }

    async signIn(email, password) {
        if (!window.supabaseClient) {
            throw new Error('Supabase客户端未初始化');
        }

        try {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            this.currentUser = data.user;
            this.updateUI();

            return { success: true, data };
        } catch (error) {
            console.error('登录失败:', error);
            return { success: false, error: error.message };
        }
    }

    async signOut() {
        if (!window.supabaseClient) {
            throw new Error('Supabase客户端未初始化');
        }

        try {
            const { error } = await window.supabaseClient.auth.signOut();
            if (error) throw error;

            this.currentUser = null;
            this.updateUI();

            return { success: true };
        } catch (error) {
            console.error('退出失败:', error);
            return { success: false, error: error.message };
        }
    }

    async createUserProfile(userId, username) {
        if (!window.supabaseClient) return;

        try {
            const { error } = await window.supabaseClient
                .from('user_profiles')
                .insert({
                    id: userId,
                    username: username,
                });

            if (error) throw error;
        } catch (error) {
            console.error('创建用户资料失败:', error);
        }
    }

    async getUserProfile() {
        if (!window.supabaseClient || !this.currentUser) return null;

        try {
            const { data, error } = await window.supabaseClient
                .from('user_profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('获取用户资料失败:', error);
            return null;
        }
    }

    updateUI() {
        // 直接显示主应用页面，不需要登录
        const authPage = document.getElementById('auth-page');
        const appPage = document.getElementById('app-page');

        if (authPage) authPage.classList.add('hidden');
        if (appPage) appPage.classList.remove('hidden');
    }

    isAuthenticated() {
        // 始终返回true，跳过认证检查
        return true;
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// 创建全局认证管理器实例
window.authManager = new AuthManager();

// 绑定登录/注册表单事件
document.addEventListener('DOMContentLoaded', () => {
    // 登录/注册标签切换
    const tabButtons = document.querySelectorAll('.tab-btn');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (tab === 'login') {
                loginForm?.classList.add('active');
                registerForm?.classList.remove('active');
            } else {
                loginForm?.classList.remove('active');
                registerForm?.classList.add('active');
            }
        });
    });

    // 登录表单提交
    const loginFormEl = document.getElementById('login-form');
    loginFormEl?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');

        const result = await window.authManager.signIn(email, password);
        if (result.success) {
            errorDiv.textContent = '';
        } else {
            errorDiv.textContent = result.error || '登录失败';
        }
    });

    // 注册表单提交
    const registerFormEl = document.getElementById('register-form');
    registerFormEl?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const username = document.getElementById('register-username').value;
        const errorDiv = document.getElementById('register-error');

        const result = await window.authManager.signUp(email, password, username);
        if (result.success) {
            errorDiv.textContent = '注册成功！请检查邮箱验证链接。';
        } else {
            errorDiv.textContent = result.error || '注册失败';
        }
    });

    // 退出按钮
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', async () => {
        await window.authManager.signOut();
    });
});

