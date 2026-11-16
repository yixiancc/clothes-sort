const api = require('../../api/index');
const { setAuth, getRemembered, setRemembered, clearRemembered } = require('../../utils/auth');

Page({
  data: {
    mode: 'login', // login | register
    username: '',
    password: '',
    nickname: '',
    captchaId: '',
    captchaCode: '',
    captchaImage: '',
    remember: false,
    loading: false
  },

  onLoad() {
    const remembered = getRemembered();
    if (remembered) {
      this.setData({
        username: remembered.username,
        password: remembered.password,
        remember: true
      });
    }
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode });
    if (mode === 'register' && !this.data.captchaImage) {
      this.refreshCaptcha();
    }
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  toggleRemember() {
    this.setData({ remember: !this.data.remember });
  },

  refreshCaptcha() {
    api.getCaptcha()
      .then((data) => {
        this.setData({ captchaId: data.captcha_id, captchaImage: data.image, captchaCode: '' });
      })
      .catch(() => {});
  },

  submit() {
    const { mode, username, password, nickname, captchaId, captchaCode, remember } = this.data;
    if (!username.trim() || !password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' });
      return;
    }
    if (this.data.loading) return;
    this.setData({ loading: true });

    const done = () => this.setData({ loading: false });

    if (mode === 'register') {
      if (password.length < 6) {
        wx.showToast({ title: '密码至少6位', icon: 'none' });
        done();
        return;
      }
      if (!captchaCode.trim()) {
        wx.showToast({ title: '请输入验证码', icon: 'none' });
        done();
        return;
      }
      api.register({
        username: username.trim(),
        password,
        nickname: nickname.trim(),
        captcha_id: captchaId,
        captcha_code: captchaCode.trim()
      }).then(() => {
        wx.showToast({ title: '注册成功，等待管理员审核', icon: 'none', duration: 2500 });
        this.setData({ mode: 'login', password: '', captchaCode: '' });
      }).catch(() => {
        this.refreshCaptcha();
      }).finally(done);
      return;
    }

    api.login({ username: username.trim(), password }).then((data) => {
      setAuth(data.token, data.user);
      if (remember) {
        setRemembered(username.trim(), password);
      } else {
        clearRemembered();
      }
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => wx.reLaunch({ url: '/pages/clothes/list/list' }), 500);
      // reLaunch：登录页不在 tabBar，switchTab 无法到达且会报错
    }).catch(() => {}).finally(done);
  }
});
