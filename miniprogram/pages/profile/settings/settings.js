const { getBaseUrl, setBaseUrl, DEFAULT_BASE_URL } = require('../../../utils/config');

Page({
  data: {
    baseUrl: ''
  },

  onLoad() {
    this.setData({ baseUrl: getBaseUrl() });
  },

  onInput(e) {
    this.setData({ baseUrl: e.detail.value });
  },

  reset() {
    this.setData({ baseUrl: DEFAULT_BASE_URL });
    setBaseUrl(DEFAULT_BASE_URL);
    wx.showToast({ title: '已恢复默认', icon: 'success' });
  },

  save() {
    const url = this.data.baseUrl.trim();
    if (url && !/^https?:\/\//.test(url)) {
      wx.showToast({ title: '地址需以 http:// 或 https:// 开头', icon: 'none' });
      return;
    }
    setBaseUrl(url);
    wx.showToast({ title: '已保存', icon: 'success' });
  }
});
