// wx.request 封装：自动带 token、统一解包 {code,message,data}、401 跳登录
const { getBaseUrl } = require('./config');
const { getToken, clearAuth } = require('./auth');

let relogining = false;

function gotoLogin() {
  clearAuth();
  if (relogining) return;
  relogining = true;
  setTimeout(() => { relogining = false; }, 2000);
  wx.reLaunch({ url: '/pages/login/login' });
}

function request({ url, method = 'GET', data = {}, header = {}, showError = true }) {
  // 认证类接口（登录/注册/验证码）的 401 是「业务失败」（如密码错误），
  // 不应触发「重新登录跳转」，否则会造成登录页闪刷。
  const isAuthApi = url.indexOf('/api/auth/login') === 0 || url.indexOf('/api/auth/register') === 0;
  return new Promise((resolve, reject) => {
    const token = getToken();
    wx.request({
      url: getBaseUrl() + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...header
      },
      success(res) {
        const body = res.data || {};
        // flask-jwt-extended 默认：token 缺失/无效返回 422，过期返回 401，都按重新登录处理
        if ((res.statusCode === 401 || res.statusCode === 422) && !isAuthApi) {
          if (showError) wx.showToast({ title: body.message || body.msg || '登录已过期', icon: 'none' });
          gotoLogin();
          reject(new Error(body.message || body.msg || 'unauthorized'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0) {
          resolve(body.data);
        } else {
          if (showError) wx.showToast({ title: body.message || body.msg || '请求失败', icon: 'none' });
          reject(new Error(body.message || body.msg || `http ${res.statusCode}`));
        }
      },
      fail(err) {
        if (showError) wx.showToast({ title: '网络异常，请检查服务器地址', icon: 'none' });
        reject(err);
      }
    });
  });
}

// multipart 上传（wx.uploadFile 无法设置 JSON body，后端衣服接口本来就是 form-data）
function upload({ url, method = 'POST', filePath, name = 'image', formData = {} }) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    wx.uploadFile({
      url: getBaseUrl() + url,
      filePath,
      name,
      formData,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        let body = {};
        try { body = JSON.parse(res.data || '{}'); } catch (e) { /* ignore */ }
        if (res.statusCode === 401 || res.statusCode === 422) {
          wx.showToast({ title: body.message || body.msg || '登录已过期', icon: 'none' });
          gotoLogin();
          reject(new Error(body.message || body.msg || 'unauthorized'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0) {
          resolve(body.data);
        } else {
          wx.showToast({ title: body.message || '上传失败', icon: 'none' });
          reject(new Error(body.message || `http ${res.statusCode}`));
        }
      },
      fail(err) {
        console.error('[upload fail]', getBaseUrl() + url, err);
        wx.showToast({ title: '上传失败：' + (err.errMsg || '网络异常'), icon: 'none', duration: 2500 });
        reject(err);
      }
    });
  });
}

module.exports = { request, upload, gotoLogin };
