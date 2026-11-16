const api = require('../../../api/index');

const SEASONS = [
  { key: 'spring', label: '春' },
  { key: 'summer', label: '夏' },
  { key: 'autumn', label: '秋' },
  { key: 'winter', label: '冬' }
];

Page({
  data: {
    id: 0, // 0 = 新增
    name: '',
    imagePath: '', // 新选的本地图片
    imageUrl: '',  // 编辑时的线上图片
    categories: [],
    locations: [],
    categoryIndex: -1,
    locationIndex: -1,
    selectedSeasons: [],
    seasons: SEASONS,
    seasonActive: {},   // 预计算季节激活态（WXML 只读布尔）
    loading: false,
    // picker 用的名称数组（range 绑定数组更稳）
    categoryNames: [],
    locationNames: []
  },

  // 根据 selectedSeasons 重算季节激活态
  _refreshSeason() {
    const act = {};
    SEASONS.forEach((s) => { act[s.key] = this.data.selectedSeasons.indexOf(s.key) >= 0; });
    this.setData({ seasonActive: act });
  },

  // 根据 categories/locations 重算 picker 的名称数组
  _refreshPickers() {
    this.setData({
      categoryNames: this.data.categories.map((c) => c.name),
      locationNames: this.data.locations.map((l) => l.name)
    });
  },

  onLoad(options) {
    const id = Number(options.id || 0);
    this.setData({ id });
    if (id) {
      wx.setNavigationBarTitle({ title: '编辑衣服' });
    }
    this.init();
  },

  onShow() {
    // form 是 tabBar 页，navigateTo 会复用实例导致 onLoad 不再触发。
    // 检测路由参数里的 id 是否变化，变化则重新加载详情。
    const pages = getCurrentPages();
    const current = pages[pages.length - 1];
    const routeId = Number((current.options && current.options.id) || 0);
    if (routeId !== this.data.id) {
      this.setData({
        id: routeId,
        name: '', imagePath: '', imageUrl: '',
        categoryIndex: -1, locationIndex: -1, selectedSeasons: []
      });
      if (routeId) {
        wx.setNavigationBarTitle({ title: '编辑衣服' });
      } else {
        wx.setNavigationBarTitle({ title: '添加衣服' });
      }
      this.init();
    }
  },

  init() {
    const { id } = this.data;
    Promise.all([
      api.listCategories().catch(() => []),
      api.listLocations().catch(() => [])
    ]).then(([cats, locs]) => {
      this.setData({ categories: cats || [], locations: locs || [] });
      this._refreshPickers();
      if (id) {
        this.loadDetail();
      } else {
        this._applyDefaults();
      }
    });
  },

  // 新增模式下：分类/位置默认选中第一项（若有）
  _applyDefaults() {
    const { categories, locations } = this.data;
    this.setData({
      categoryIndex: categories.length > 0 ? 0 : -1,
      locationIndex: locations.length > 0 ? 0 : -1
    });
  },

  // 清空表单（保存成功后调用）：重置为初始态并重新应用默认第一项
  _resetForm() {
    this.setData({
      name: '', imagePath: '', imageUrl: '', selectedSeasons: []
    });
    this._refreshSeason();
    this._applyDefaults();
  },

  loadDetail() {
    wx.showLoading({ title: '加载中', mask: true });
    api.getClothes(this.data.id)
      .then((c) => {
        const categoryIndex = this.data.categories.findIndex((x) => x.id === c.category_id);
        const locationIndex = this.data.locations.findIndex((x) => x.id === c.location_id);
        this.setData({
          name: c.name,
          imageUrl: c.image_url,
          categoryIndex,
          locationIndex,
          selectedSeasons: c.seasons || []
        });
        this._refreshSeason();
      })
      .catch(() => {})
      .finally(() => wx.hideLoading());
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles[0];
        // 上传前压缩：减小体积，上传更快、省 COS 流量和存储
        wx.compressImage({
          src: file.tempFilePath,
          quality: 80,
          success: (cres) => {
            this.setData({ imagePath: cres.tempFilePath });
          },
          fail: () => {
            // 压缩失败则用原图，不阻塞流程
            this.setData({ imagePath: file.tempFilePath });
          }
        });
      }
    });
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) });
  },

  onLocationChange(e) {
    this.setData({ locationIndex: Number(e.detail.value) });
  },

  toggleSeason(e) {
    const key = e.currentTarget.dataset.key;
    const arr = this.data.selectedSeasons.slice();
    const i = arr.indexOf(key);
    if (i >= 0) arr.splice(i, 1); else arr.push(key);
    this.setData({ selectedSeasons: arr });
    this._refreshSeason();
  },

  addCategory() {
    wx.showModal({
      title: '新建分类',
      editable: true,
      placeholderText: '分类名称',
      success: (res) => {
        if (!res.confirm || !res.content || !res.content.trim()) return;
        api.createCategory(res.content.trim()).then((c) => {
          const categories = this.data.categories.concat([c]);
          this.setData({ categories, categoryIndex: categories.length - 1 });
          this._refreshPickers();
          getApp().globalData.needRefresh = true;
        }).catch(() => {});
      }
    });
  },

  addLocation() {
    wx.showModal({
      title: '新建位置',
      editable: true,
      placeholderText: '位置名称',
      success: (res) => {
        if (!res.confirm || !res.content || !res.content.trim()) return;
        api.createLocation(res.content.trim()).then((l) => {
          const locations = this.data.locations.concat([l]);
          this.setData({ locations, locationIndex: locations.length - 1 });
          this._refreshPickers();
          getApp().globalData.needRefresh = true;
        }).catch(() => {});
      }
    });
  },

  save() {
    const { id, name, imagePath, imageUrl, categories, locations, categoryIndex, locationIndex, selectedSeasons, loading } = this.data;
    if (loading) return;
    if (!name.trim()) {
      wx.showToast({ title: '请填写名称', icon: 'none' });
      return;
    }
    if (!id && !imagePath) {
      wx.showToast({ title: '请选择图片', icon: 'none' });
      return;
    }
    const fields = {
      name: name.trim(),
      // 索引必须在有效范围内，防止分类/位置被删除后取到 undefined
      category_id: (categoryIndex >= 0 && categories[categoryIndex]) ? categories[categoryIndex].id : 0,
      location_id: (locationIndex >= 0 && locations[locationIndex]) ? locations[locationIndex].id : 0,
      seasons: selectedSeasons
    };
    this.setData({ loading: true });
    wx.showLoading({ title: '保存中', mask: true });
    const p = id
      ? api.updateClothes(id, fields, imagePath || '')
      : api.createClothes(fields, imagePath);
    p.then(() => {
      getApp().globalData.needRefresh = true;
      if (id) {
        // 编辑模式：提示后返回上一页
        wx.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
      } else {
        // 新增模式：提示保存成功 + 清空表单，留在本页方便连续添加
        wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 });
        this._resetForm();
      }
    }).catch((err) => {
      // 保存失败要给出提示，不能静默
      wx.showToast({ title: (err && err.message) ? `保存失败：${err.message}` : '保存失败，请重试', icon: 'none', duration: 2500 });
    }).finally(() => {
      wx.hideLoading();
      this.setData({ loading: false });
    });
  }
});
