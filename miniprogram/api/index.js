const { request, upload } = require('../utils/request');

// ---------- 认证 ----------
const getCaptcha = () => request({ url: '/api/auth/captcha' });
const login = (data) => request({ url: '/api/auth/login', method: 'POST', data });
const register = (data) => request({ url: '/api/auth/register', method: 'POST', data });
const getProfile = () => request({ url: '/api/auth/profile' });
const updateProfile = (data) => request({ url: '/api/auth/profile', method: 'PUT', data });

// ---------- 分类 / 位置 ----------
const listCategories = () => request({ url: '/api/categories' });
const createCategory = (name) => request({ url: '/api/categories', method: 'POST', data: { name } });
const updateCategory = (id, name) => request({ url: `/api/categories/${id}`, method: 'PUT', data: { name } });
const deleteCategory = (id) => request({ url: `/api/categories/${id}`, method: 'DELETE' });

const listLocations = () => request({ url: '/api/locations' });
const createLocation = (name) => request({ url: '/api/locations', method: 'POST', data: { name } });
const updateLocation = (id, name) => request({ url: `/api/locations/${id}`, method: 'PUT', data: { name } });
const deleteLocation = (id) => request({ url: `/api/locations/${id}`, method: 'DELETE' });

// ---------- 衣服 ----------
const listClothes = (params) => request({ url: '/api/clothes', data: params });
const getClothes = (id) => request({ url: `/api/clothes/${id}` });

function clothesFormData({ name, category_id, location_id, seasons }) {
  const formData = { name: name || '' };
  formData.category_id = category_id ? String(category_id) : '';
  formData.location_id = location_id ? String(location_id) : '';
  formData.seasons = (seasons || []).join(',');
  return formData;
}

const createClothes = (fields, filePath) =>
  upload({ url: '/api/clothes', method: 'POST', filePath, formData: clothesFormData(fields) });

// 编辑：带新图走 uploadFile；不带图用 request + form 编码（后端读 request.form）
// 注意：wx.request 在 Content-Type 为 x-www-form-urlencoded 时不会自动把对象序列化为 form 格式，
// 必须手动拼成 key=value&... 字符串，否则后端 Flask 解析不到 request.form。
function toFormString(obj) {
  return Object.keys(obj)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k] == null ? '' : obj[k])}`)
    .join('&');
}

const updateClothes = (id, fields, filePath) => {
  const formData = clothesFormData(fields);
  if (filePath) {
    return upload({ url: `/api/clothes/${id}`, method: 'PUT', filePath, formData });
  }
  return request({
    url: `/api/clothes/${id}`,
    method: 'PUT',
    data: toFormString(formData),
    header: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
};

const deleteClothes = (id) => request({ url: `/api/clothes/${id}`, method: 'DELETE' });

// ---------- 穿着记录 ----------
// date 省略 = 今天（北京时间），格式 YYYY-MM-DD
const wearClothes = (id, date) => request({ url: `/api/clothes/${id}/wear`, method: 'POST', data: date ? { date } : {} });
const unwearClothes = (id, date) => request({ url: `/api/clothes/${id}/wear${date ? '?date=' + date : ''}`, method: 'DELETE' });
const wearHistory = (id) => request({ url: `/api/clothes/${id}/wear` });
const wearCalendar = (month) => request({ url: '/api/wear/calendar', data: month ? { month } : {} });

// ---------- 搭配 ----------
const listOutfits = () => request({ url: '/api/outfits' });
const getOutfit = (id) => request({ url: `/api/outfits/${id}` });
const createOutfit = (data) => request({ url: '/api/outfits', method: 'POST', data });
const updateOutfit = (id, data) => request({ url: `/api/outfits/${id}`, method: 'PUT', data });
const deleteOutfit = (id) => request({ url: `/api/outfits/${id}`, method: 'DELETE' });
const wearOutfit = (id, date) => request({ url: `/api/outfits/${id}/wear`, method: 'POST', data: date ? { date } : {} });
const unwearOutfit = (id, date) => request({ url: `/api/outfits/${id}/wear${date ? '?date=' + date : ''}`, method: 'DELETE' });

// ---------- 统计 ----------
const statsOverview = () => request({ url: '/api/stats/overview' });

// ---------- 管理（仅管理员；复用后端 /api/admin 接口） ----------
const adminListUsers = (keyword) => request({ url: '/api/admin/users', data: keyword ? { keyword } : {} });
const adminApproveUser = (id) => request({ url: `/api/admin/users/${id}/approve`, method: 'PUT' });

module.exports = {
  getCaptcha, login, register, getProfile, updateProfile,
  listCategories, createCategory, updateCategory, deleteCategory,
  listLocations, createLocation, updateLocation, deleteLocation,
  listClothes, getClothes, createClothes, updateClothes, deleteClothes,
  wearClothes, unwearClothes, wearHistory, wearCalendar,
  listOutfits, getOutfit, createOutfit, updateOutfit, deleteOutfit, wearOutfit, unwearOutfit,
  statsOverview,
  adminListUsers, adminApproveUser
};
