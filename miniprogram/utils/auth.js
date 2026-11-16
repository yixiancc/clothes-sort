// token / 用户信息 / 记住密码 的本地存储
const { encode, decode } = require('./crypto');

const KEY_TOKEN = 'token';
const KEY_USER = 'user';
const KEY_REMEMBER = 'remember_account';

function getToken() {
  return wx.getStorageSync(KEY_TOKEN) || '';
}

function setAuth(token, user) {
  wx.setStorageSync(KEY_TOKEN, token || '');
  wx.setStorageSync(KEY_USER, user || null);
  const app = getApp();
  if (app) {
    app.globalData.token = token || '';
    app.globalData.user = user || null;
  }
}

function clearAuth() {
  wx.removeStorageSync(KEY_TOKEN);
  wx.removeStorageSync(KEY_USER);
  const app = getApp();
  if (app) {
    app.globalData.token = '';
    app.globalData.user = null;
  }
}

function getRemembered() {
  const raw = wx.getStorageSync(KEY_REMEMBER);
  if (!raw || !raw.username) return null;
  const password = decode(raw.password || '');
  // 密文非空但解码结果为空，说明数据损坏（或编码版本不兼容），清除避免误导
  if (raw.password && !password) {
    wx.removeStorageSync(KEY_REMEMBER);
    return null;
  }
  return { username: raw.username, password };
}

function setRemembered(username, password) {
  wx.setStorageSync(KEY_REMEMBER, { username, password: encode(password) });
}

function clearRemembered() {
  wx.removeStorageSync(KEY_REMEMBER);
}

module.exports = {
  getToken, setAuth, clearAuth,
  getRemembered, setRemembered, clearRemembered
};
