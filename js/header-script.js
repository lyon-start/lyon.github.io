document.addEventListener('DOMContentLoaded', function() {
    // 1. 获取所有导航项
    const navItems = document.querySelectorAll('.nav-item');

    // 2. 导航项点击事件（点哪亮哪 + 跳转）
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // 移除所有高亮
            navItems.forEach(nav => nav.classList.remove('active'));
            // 给当前点击项加高亮
            this.classList.add('active');

            const pageType = this.dataset.page;
            switch (pageType) {
                case 'notes':
                    // 通知父页面跳转到读书笔记
                    window.parent.postMessage({ type: 'navigate', page: 'notes' }, '*');
                    break;
                case 'memories':
                    // 通知父页面跳转到个人回忆
                    window.parent.postMessage({ type: 'navigate', page: 'memories' }, '*');
                    break;
                case 'reserved':
                    alert('预留功能正在规划中，敬请期待～');
                    break;
                case 'theme':
                    alert('主题设置功能即将上线，支持白天/夜晚/流星雨模式～');
                    break;
                case 'logout':
                    if (confirm('确定要退出登录吗？')) {
                        window.parent.postMessage({ type: 'logout' }, '*');
                        localStorage.removeItem('isLogin');
                        sessionStorage.removeItem('accessToken');
                    }
                    break;
                default:
                    alert('功能暂未配置，请联系开发者～');
            }
        });
    });

    // 3. 接收父页面的同步消息（同步当前页面高亮）
    window.addEventListener('message', (e) => {
        // 同步页面高亮
        if (e.data.type === 'syncPage') {
            const targetPage = e.data.page;
            // 移除所有高亮
            navItems.forEach(nav => nav.classList.remove('active'));
            // 给目标页面的导航项加高亮
            const targetItem = document.querySelector(`.nav-item[data-page="${targetPage}"]`);
            if (targetItem) {
                targetItem.classList.add('active');
            }
        }
        // 同步主题
        else if (e.data.type === 'theme') {
            document.body.classList.toggle('dark-theme', e.data.value === 'dark');
        }
    });
});