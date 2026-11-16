// 服务器地址：默认线上环境，「我的 → 服务器地址」里可改，重启后仍生效
const DEFAULT_BASE_URL = 'https://clothessortback.yixianluoshui.top';

function getBaseUrl() {
  return wx.getStorageSync('base_url') || DEFAULT_BASE_URL;
}

function setBaseUrl(url) {
  const u = (url || '').trim().replace(/\/+$/, '');
  wx.setStorageSync('base_url', u || DEFAULT_BASE_URL);
}

module.exports = { DEFAULT_BASE_URL, getBaseUrl, setBaseUrl };
