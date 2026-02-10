document.addEventListener('DOMContentLoaded', function() {
    // ===================== 核心配置（全局唯一） =====================
    const CONFIG = {
        loginPage: 'index.html',
        jsonConfigPath: 'photos/photos-config.json', // JSON仅读取一次
        defaultImg: 'images/default.jpg'
    };

    // 内存缓存：仅存储一次加载的照片数据，切换分类时直接使用
    let photoDataCache = [];
    // 标记：是否已加载过JSON数据（防止重复读取）
    let isDataLoaded = false;

    // ===================== 1. 权限校验（仅执行一次） =====================
    const checkAuth = () => {
        const isLogin = localStorage.getItem('isLogin') === 'true';
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        const sessionToken = sessionStorage.getItem('accessToken');
        const isVerified = sessionStorage.getItem('isVerified') === 'true';

        if (!isLogin) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = CONFIG.loginPage;
            return false;
        } else if (!isVerified) {
            if (!urlToken || !sessionToken || urlToken !== sessionToken) {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = CONFIG.loginPage;
                return false;
            } else {
                sessionStorage.setItem('isVerified', 'true');
                const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
                window.history.replaceState({}, document.title, newUrl);
            }
        }
        return true;
    };

    // 权限校验失败直接退出，不执行后续逻辑
    if (!checkAuth()) return;

    // ===================== 2. DOM元素获取（仅执行一次） =====================
    const DOM = {
        categoryList: document.getElementById('photoCategories'),
        photosContent: document.getElementById('photosContent'),
        photoModal: document.getElementById('photoModal'),
        modalPhoto: document.getElementById('modalPhoto'),
        photoDesc: document.getElementById('photoDesc'),
        modalClose: document.getElementById('modalClose'),
        themeToggle: document.getElementById('themeToggle'),
        themeIcon: document.getElementById('themeIcon'),
        body: document.body
    };

    // ===================== 3. 主题切换（仅初始化一次） =====================
    const initTheme = () => {
        // 初始化主题样式
        const savedTheme = localStorage.getItem('photosTheme') || 'light';
        DOM.body.classList.toggle('dark-theme', savedTheme === 'dark');
        DOM.themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

        // 绑定主题切换事件（仅绑定一次）
        DOM.themeToggle.addEventListener('click', () => {
            const isDark = DOM.body.classList.toggle('dark-theme');
            const theme = isDark ? 'dark' : 'light';
            DOM.themeIcon.textContent = isDark ? '🌙' : '☀️';
            localStorage.setItem('photosTheme', theme);
            // 同步到导航条iframe（仅执行一次绑定）
            try {
                window.frames[0].postMessage({ type: 'theme', value: theme }, '*');
            } catch (e) {
                console.warn('同步主题到导航条失败：', e);
            }
        });
    };

    // ===================== 4. 一次性读取JSON数据（核心逻辑） =====================
    const loadPhotoDataOnce = async () => {
        // 如果已经加载过数据，直接返回缓存（不再读取JSON）
        if (isDataLoaded) {
            return photoDataCache;
        }

        // 显示初始化加载提示（仅首次加载时显示）
        DOM.photosContent.innerHTML = `
            <div class="content-placeholder">
                <div class="loading-spinner"></div>
                <p>正在初始化个人回忆...</p>
            </div>
        `;

        try {
            // 仅发起一次JSON请求
            const response = await fetch(CONFIG.jsonConfigPath);
            if (!response.ok) {
                throw new Error(`配置文件加载失败（状态码：${response.status}）`);
            }

            const rawData = await response.json();
            // 数据格式校验（仅执行一次）
            if (!Array.isArray(rawData.categories)) {
                throw new Error('JSON格式错误：categories必须是数组');
            }

            // 将数据缓存到内存，标记为已加载
            photoDataCache = rawData.categories;
            CONFIG.defaultImg = rawData.defaultImg || CONFIG.defaultImg;
            isDataLoaded = true;

            console.log('✅ 仅读取一次JSON数据完成，数据已缓存');
            return photoDataCache;
        } catch (error) {
            // 加载失败：显示错误提示，不再重复尝试
            DOM.photosContent.innerHTML = `
                <div class="content-placeholder" style="color: #ff3b30;">
                    <h2>初始化失败</h2>
                    <p>${error.message}</p>
                    <p>请检查：</p>
                    <ul style="text-align: left; margin: 10px 0; padding-left: 20px;">
                        <li>1. ${CONFIG.jsonConfigPath} 文件是否存在</li>
                        <li>2. JSON格式是否正确（无语法错误）</li>
                    </ul>
                    <button class="reload-btn" onclick="window.location.reload()">刷新页面重试</button>
                </div>
            `;
            console.error('❌ JSON数据读取失败：', error);
            return null;
        }
    };

    // ===================== 5. 渲染逻辑（使用缓存数据，无请求） =====================
    // 渲染分类列表（仅基于缓存数据渲染）
    const renderCategories = () => {
        DOM.categoryList.innerHTML = '';

        // 无分类数据时提示
        if (photoDataCache.length === 0) {
            DOM.photosContent.innerHTML = `
                <div class="content-placeholder">
                    <h2>暂无回忆分类</h2>
                    <p>请在 ${CONFIG.jsonConfigPath} 中配置分类和照片</p>
                </div>
            `;
            return;
        }

        // 渲染分类（仅渲染一次，切换时仅改激活态）
        photoDataCache.forEach((category, index) => {
            const li = document.createElement('li');
            li.className = `category-item ${index === 0 ? 'active' : ''}`;
            li.innerHTML = `<a class="category-link">${category.name}</a>`;
            DOM.categoryList.appendChild(li);

            // 分类点击事件（仅使用缓存数据，无请求）
            li.addEventListener('click', () => {
                // 仅切换激活态，不重新请求数据
                document.querySelectorAll('.category-item').forEach(item => item.classList.remove('active'));
                li.classList.add('active');
                // 渲染照片（从缓存读取，无请求）
                renderPhotos(category.name);
            });
        });

        // 初始化渲染第一个分类（从缓存读取）
        renderPhotos(photoDataCache[0].name);
    };

    // 渲染照片（仅使用缓存数据，无任何请求）
    const renderPhotos = (categoryName) => {
        // 从缓存中查找分类数据
        const targetCategory = photoDataCache.find(item => item.name === categoryName);
        if (!targetCategory) {
            DOM.photosContent.innerHTML = `
                <div class="content-placeholder">
                    <p>未找到「${categoryName}」分类的回忆</p>
                </div>
            `;
            return;
        }

        // 分类下无照片时提示
        if (!Array.isArray(targetCategory.photos) || targetCategory.photos.length === 0) {
            DOM.photosContent.innerHTML = `
                <div class="content-placeholder">
                    <p>「${categoryName}」分类下暂无照片</p>
                </div>
            `;
            return;
        }

        // 生成照片网格（仅使用缓存的路径，无请求）
        let photoGrid = '<div class="photo-grid">';
        targetCategory.photos.forEach(photo => {
            const photoSrc = photo.src || CONFIG.defaultImg;
            const photoDesc = photo.desc || `${categoryName} - 美好回忆`;

            photoGrid += `
                <div class="photo-card">
                    <img src="${photoSrc}" alt="${photoDesc}" onerror="this.src='${CONFIG.defaultImg}'">
                    <div class="card-desc">${photoDesc}</div>
                </div>
            `;
        });
        photoGrid += '</div>';

        // 直接渲染（无延迟、无请求）
        DOM.photosContent.innerHTML = photoGrid;

        // 绑定照片预览事件（仅绑定一次，基于缓存数据）
        document.querySelectorAll('.photo-card').forEach(card => {
            card.addEventListener('click', () => {
                const img = card.querySelector('img');
                DOM.modalPhoto.src = img.src;
                DOM.photoDesc.textContent = img.alt;
                DOM.photoModal.classList.add('show');
            });
        });
    };

    // ===================== 6. 弹窗关闭逻辑（仅绑定一次） =====================
    const initModal = () => {
        // 关闭按钮点击
        DOM.modalClose.addEventListener('click', () => {
            DOM.photoModal.classList.remove('show');
        });
        // 点击弹窗外区域关闭
        DOM.photoModal.addEventListener('click', (e) => {
            if (e.target === DOM.photoModal) {
                DOM.photoModal.classList.remove('show');
            }
        });
    };

    // ===================== 7. 初始化加载动画（仅添加一次） =====================
    const initStyle = () => {
        const style = document.createElement('style');
        style.textContent = `
            /* 加载动画（仅首次显示） */
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid rgba(66, 184, 131, 0.2);
                border-radius: 50%;
                border-top-color: #42b883;
                animation: spin 1s ease-in-out infinite;
                margin-bottom: 16px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }

            /* 重新加载按钮 */
            .reload-btn {
                margin-top: 16px;
                padding: 8px 16px;
                background: rgba(66, 184, 131, 0.2);
                color: #42b883;
                border: 1px solid rgba(66, 184, 131, 0.3);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 14px;
            }
            .reload-btn:hover {
                background: rgba(66, 184, 131, 0.3);
                transform: translateY(-2px);
            }
        `;
        document.head.appendChild(style);
    };

    // ===================== 8. 监听iframe消息（仅处理跳转/退出，无请求） =====================
    const initMessageListener = () => {
        window.addEventListener('message', (e) => {
            // 退出登录：清空状态并跳转
            if (e.data.type === 'logout') {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = CONFIG.loginPage;
            }
            // 导航跳转：仅跳转页面，不重新读取数据
            else if (e.data.type === 'navigate') {
                window.location.href = e.data.page === 'notes' ? 'notes.html' : 'photos.html';
            }
            // 主题同步：仅修改样式，无请求
            else if (e.data.type === 'theme') {
                const isDark = e.data.value === 'dark';
                DOM.body.classList.toggle('dark-theme', isDark);
                DOM.themeIcon.textContent = isDark ? '🌙' : '☀️';
            }
        });
    };

    // ===================== 9. 页面初始化入口（仅执行一次） =====================
    const initPage = async () => {
        // 1. 初始化样式和弹窗（仅一次）
        initStyle();
        initModal();
        initMessageListener();

        // 2. 初始化主题（仅一次）
        initTheme();

        // 3. 仅读取一次JSON数据（核心）
        const photoData = await loadPhotoDataOnce();
        if (!photoData) return; // 加载失败则终止

        // 4. 渲染分类和照片（使用缓存数据，无请求）
        renderCategories();
    };

    // ===================== 关键：页面加载完成后同步导航条高亮 =====================
    window.addEventListener('load', function() {
        // 告诉导航条iframe：当前是「个人回忆」页面，需要高亮对应选项
        try {
            window.frames[0].postMessage({
                type: 'syncPage',
                page: 'memories'
            }, '*');
        } catch (e) {
            console.warn('同步导航条高亮失败：', e);
        }
    });

    // ===================== 启动初始化（仅执行一次） =====================
    initPage();
});