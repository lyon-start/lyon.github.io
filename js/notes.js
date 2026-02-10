document.addEventListener('DOMContentLoaded', function() {
    // ========== 原有访问限制校验逻辑（保留不变） ==========
    const isLogin = localStorage.getItem('isLogin') === 'true';
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const sessionToken = sessionStorage.getItem('accessToken');
    const isVerified = sessionStorage.getItem('isVerified') === 'true';
    const loginPage = 'index.html';

    if (!isLogin) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = loginPage;
        return;
    } else if (!isVerified) {
        if (!urlToken || !sessionToken || urlToken !== sessionToken) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = loginPage;
            return;
        } else {
            sessionStorage.setItem('isVerified', 'true');
            const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
            window.history.replaceState({}, document.title, newUrl);
        }
    }

    // ========== 新增：监听iframe发送的消息（核心修复） ==========
    window.addEventListener('message', (e) => {
        // 1. 处理退出登录
        if (e.data.type === 'logout') {
            // 清除所有登录态
            localStorage.clear();
            sessionStorage.clear();
            // 跳回登录页（核心：父页面跳转，整个页面消失）
            window.location.href = loginPage;
        }
        // 2. 处理导航跳转（可选，如需支持iframe导航到其他页面）
        else if (e.data.type === 'navigate') {
            if (e.data.page === 'notes') {
                window.location.href = 'notes.html';
            }
            else if (e.data.page === 'memories') {
            window.location.href = 'photos.html';
        }
        }
    });

    // ========== 原有主题切换/MD加载逻辑（保留不变） ==========
    const THEME = {
        LIGHT: 'light',
        DARK: 'dark',
        ICON_LIGHT: '☀️',
        ICON_DARK: '🌙'
    };
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const body = document.body;

    const savedTheme = localStorage.getItem('notesTheme') || THEME.LIGHT;
    if (savedTheme === THEME.DARK) {
        body.classList.add('dark-theme');
        themeIcon.textContent = THEME.ICON_DARK;
    } else {
        body.classList.remove('dark-theme');
        themeIcon.textContent = THEME.ICON_LIGHT;
    }

    themeToggle.addEventListener('click', () => {
        const isDark = body.classList.toggle('dark-theme');
        const currentTheme = isDark ? THEME.DARK : THEME.LIGHT;
        themeIcon.textContent = isDark ? THEME.ICON_DARK : THEME.ICON_LIGHT;
        localStorage.setItem('notesTheme', currentTheme);
        try {
            window.frames[0].postMessage({ type: 'theme', value: currentTheme }, '*');
        } catch (e) {
            console.warn('同步主题到导航条失败：', e);
        }
    });

    // 原有MD加载逻辑（保留不变）
    const bookListEl = document.getElementById('bookList');
    const notesContentEl = document.getElementById('notesContent');
    let mdFileNames = [];

    async function fetchData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`请求失败（状态码：${response.status}）`);
            return await response.json();
        } catch (error) {
            console.error(`加载 ${url} 失败：`, error);
            throw error;
        }
    }

    async function loadFileList() {
        try {
            const data = await fetchData('notes/files.json');
            if (!Array.isArray(data.mdFiles)) throw new Error('files.json格式错误：mdFiles必须是数组');
            mdFileNames = data.mdFiles;
            return mdFileNames;
        } catch (error) {
            notesContentEl.innerHTML = `
                <div class="content-placeholder" style="color: #ff3b30;">
                    <h2>初始化失败</h2>
                    <p>${error.message}</p>
                    <p>请检查notes/files.json文件是否存在且格式正确</p>
                </div>
            `;
            return [];
        }
    }

    function formatBookList() {
        return mdFileNames.map((fileName, index) => {
            const bookName = fileName.replace(/\.md$/, '')
                .replace(/-/g, ' ')
                .replace(/^\w/, c => c.toUpperCase()) + ' 读书笔记';
            return {
                id: index + 1,
                name: bookName,
                file: `notes/${fileName}`
            };
        });
    }

    async function loadMarkdown(filePath) {
        notesContentEl.innerHTML = `
            <div class="content-placeholder">
                <div class="loading-spinner"></div>
                <p>正在加载读书笔记...</p>
            </div>
        `;
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`文件不存在（状态码：${response.status}）`);
            const markdown = await response.text();
            const html = marked.parse(markdown);
            notesContentEl.innerHTML = `<div class="markdown-content">${html}</div>`;
        } catch (error) {
            console.error('MD文件加载失败：', error);
            notesContentEl.innerHTML = `
                <div class="content-placeholder" style="color: #ff3b30;">
                    <h2>加载失败</h2>
                    <p>无法读取notes目录下的文件：${filePath.split('/').pop()}</p>
                    <p>请检查该文件是否存在</p>
                    <button class="reload-btn" onclick="loadMarkdown('${filePath}')">重新加载</button>
                </div>
            `;
        }
    }

    async function initPage() {
        await loadFileList();
        if (mdFileNames.length === 0) {
            notesContentEl.innerHTML = `
                <div class="content-placeholder">
                    <h2>暂无读书笔记</h2>
                    <p>请在notes/files.json中配置MD文件路径</p>
                    <p>示例格式：{"mdFiles": ["你好.md", "小王子.md"]}</p>
                </div>
            `;
            return;
        }

        const bookList = formatBookList();
        bookListEl.innerHTML = '';
        bookList.forEach((book, index) => {
            const li = document.createElement('li');
            li.className = `book-item ${index === 0 ? 'active' : ''}`;
            li.innerHTML = `<a class="book-link" data-file="${book.file}">${book.name}</a>`;
            bookListEl.appendChild(li);

            li.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.book-item').forEach(item => item.classList.remove('active'));
                li.classList.add('active');
                loadMarkdown(book.file);
            });
        });

        loadMarkdown(bookList[0].file);
    }

    initPage();
});

// 全局重新加载函数
function loadMarkdown(filePath) {
    const notesContentEl = document.getElementById('notesContent');
    notesContentEl.innerHTML = `
        <div class="content-placeholder">
            <div class="loading-spinner"></div>
            <p>正在重新加载...</p>
        </div>
    `;
    fetch(filePath)
        .then(response => {
            if (!response.ok) throw new Error(`文件不存在（状态码：${response.status}）`);
            return response.text();
        })
        .then(markdown => {
            const html = marked.parse(markdown);
            notesContentEl.innerHTML = `<div class="markdown-content">${html}</div>`;
        })
        .catch(error => {
            console.error('重新加载MD文件失败：', error);
            notesContentEl.innerHTML = `
                <div class="content-placeholder" style="color: #ff3b30;">
                    <h2>加载失败</h2>
                    <p>${error.message}</p>
                    <button class="reload-btn" onclick="loadMarkdown('${filePath}')">再次重试</button>
                </div>
            `;
        });
}