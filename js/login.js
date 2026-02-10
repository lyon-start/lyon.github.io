document.addEventListener('DOMContentLoaded', function() {
  // ===================== 工具函数：Base64 解密（适配浏览器环境） =====================
  function base64Decode(str) {
    try {
      // 浏览器原生Base64解密，处理特殊字符
      return decodeURIComponent(escape(window.atob(str)));
    } catch (e) {
      console.error('Base64解密失败：', e);
      return '';
    }
  }

  // ===================== 1. 背景图轮播逻辑（保留原有） =====================
  const slides = document.querySelectorAll('.bg-slide');
  let currentSlide = 0;
  const slideInterval = 6000;

  function nextSlide() {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
  }

  // 初始化显示第一张背景图
  slides[0].classList.add('active');
  // 启动轮播
  setInterval(nextSlide, slideInterval);

  // ===================== 2. 加载登录配置（从JSON读取加密账号密码） =====================
  let loginConfig = { users: [], tips: '' };
  // 加载配置文件
  async function loadLoginConfig() {
    try {
      const response = await fetch('config/login-config.json');
      if (!response.ok) throw new Error(`配置加载失败（状态码：${response.status}）`);
      loginConfig = await response.json();
      console.log('✅ 登录配置加载成功');
    } catch (error) {
      console.error('❌ 登录配置加载失败：', error);
      // 加载失败时使用默认值（兜底）
      loginConfig = {
        users: [{ username: 'YWRtaW4=', password: 'MTIzNDU2' }],
        tips: '默认账号：admin，默认密码：123456'
      };
    }
  }

  // 页面加载时先加载配置
  loadLoginConfig();

  // ===================== 3. 登录逻辑（适配JSON+解密） =====================
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorTip = document.getElementById('errorTip');

  // 监听表单提交
  loginForm.addEventListener('submit', async function(e) {
    // 阻止表单默认提交行为
    e.preventDefault();

    // 确保配置已加载（如果加载慢，等待一下）
    if (loginConfig.users.length === 0) {
      await loadLoginConfig();
    }

    // 获取并去除输入框首尾空格
    const inputUsername = usernameInput.value.trim();
    const inputPassword = passwordInput.value.trim();

    // 先隐藏错误提示
    errorTip.style.display = 'none';

    // 校验1：输入为空
    if (!inputUsername || !inputPassword) {
      errorTip.textContent = '账号和密码不能为空';
      errorTip.style.display = 'block';
      return;
    }

    // 校验2：遍历用户列表，解密后对比
    let isLoginSuccess = false;
    for (const user of loginConfig.users) {
      // 解密账号密码
      const realUsername = base64Decode(user.username);
      const realPassword = base64Decode(user.password);
      // 对比
      if (inputUsername === realUsername && inputPassword === realPassword) {
        isLoginSuccess = true;
        break;
      }
    }

    // 登录成功/失败处理
    if (isLoginSuccess) {
      // 标记登录态（持久化，关闭浏览器也不会消失）
      localStorage.setItem('isLogin', 'true');
      // 生成随机一次性token（会话级，关闭浏览器失效）
      const accessToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('accessToken', accessToken);
      // 延迟400ms跳转，提升体验
      setTimeout(() => {
        window.location.href = `notes.html?token=${accessToken}`;
      }, 400);
    } else {
      // 密码错误提示（显示JSON中的提示）
      errorTip.textContent = `账号或密码错误（${loginConfig.tips}）`;
      errorTip.style.display = 'block';
      // 3秒后自动隐藏错误提示
      setTimeout(() => {
        errorTip.style.display = 'none';
      }, 3000);
    }
  });
});