const api = require('../../api/index');
const { clearAuth } = require('../../utils/auth');

Page({
  data: {
    user: {},
    avatarText: '衣',
    showProfile: false,
    saving: false,
    form: { username: '', nickname: '', old_password: '', new_password: '' }
  },

  onShow() {
    const user = getApp().globalData.user;
    if (user) this.setUser(user);
    // 同步最新资料
    api.getProfile().then((u) => {
      this.setUser(u);
      getApp().globalData.user = u;
    }).catch(() => {});
  },

  setUser(user) {
    const nn = (user.nickname || '').trim();
    const un = (user.username || '').trim();
    // 取第一个字符（处理 emoji surrogate pair：用 Array.from 按码点取）
    const first = (s) => (s ? Array.from(s)[0] : '');
    this.setData({
      user,
      avatarText: first(nn) || first(un) || '衣'
    });
  },

  noop() {},

  goCategories() {
    wx.navigateTo({ url: '/pages/profile/categories/categories' });
  },

  goStats() {
    wx.navigateTo({ url: '/pages/stats/stats' });
  },

  goCalendar() {
    wx.navigateTo({ url: '/pages/calendar/calendar' });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' });
  },

  goLocations() {
    wx.navigateTo({ url: '/pages/profile/locations/locations' });
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/profile/settings/settings' });
  },

  editProfile() {
    const { user } = this.data;
    this.setData({
      showProfile: true,
      form: {
        username: user.username || '',
        nickname: user.nickname || '',
        old_password: '',
        new_password: ''
      }
    });
  },

  closeProfile() {
    this.setData({ showProfile: false });
  },

  onFormInput(e) {
    this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value });
  },

  saveProfile() {
    const { form, saving } = this.data;
    if (saving) return;
    if (form.new_password && form.new_password.length < 6) {
      wx.showToast({ title: '新密码至少6位', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    api.updateProfile({
      username: form.username.trim(),
      nickname: form.nickname.trim(),
      old_password: form.old_password,
      new_password: form.new_password
    }).then((u) => {
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ user: u, showProfile: false });
      getApp().globalData.user = u;
    }).catch(() => {}).finally(() => this.setData({ saving: false }));
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (!res.confirm) return;
        clearAuth();
        wx.reLaunch({ url: '/pages/login/login' });
      }
    });
  }
});
