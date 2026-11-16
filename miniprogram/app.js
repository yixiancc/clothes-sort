App({
  globalData: {
    token: '',
    user: null,
    needRefresh: false
  },

  onLaunch() {
    const token = wx.getStorageSync('token') || '';
    const user = wx.getStorageSync('user') || null;
    if (token) {
      this.globalData.token = token;
      this.globalData.user = user;
      // 启动时校验 token 是否仍有效（过期会自动跳登录）
      const { request } = require('./utils/request');
      request({ url: '/api/auth/profile' })
        .then((u) => { this.globalData.user = u; })
        .catch(() => {});
    }
  }
});
