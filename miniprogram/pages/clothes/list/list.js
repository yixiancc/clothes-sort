const api = require('../../../api/index');

const SEASONS = [
  { key: 'spring', label: '春' },
  { key: 'summer', label: '夏' },
  { key: 'autumn', label: '秋' },
  { key: 'winter', label: '冬' }
];
const SEASON_LABEL = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

// 内存窗口：最多在 DOM 中保留的衣服数量（超出后丢弃最旧的，配合分页仍可看全）
// 固定高度卡片 + 这个上限 = 内存有界，滚动不卡
const MAX_KEEP = 120;

// 排序选项（key 与后端 sort 参数一致）
const SORTS = [
  { key: 'newest', label: '最新添加', short: '最新' },
  { key: 'oldest', label: '最早添加', short: '最早' },
  { key: 'name', label: '按名称', short: '名称' },
  { key: 'wear_desc', label: '穿得最多', short: '穿得多' },
  { key: 'wear_asc', label: '穿得最少', short: '穿得少' },
  { key: 'recent', label: '最近穿过', short: '最近穿' },
  { key: 'stale', label: '最久没穿', short: '最久没穿' }
];

function wearText(c) {
  if (c.worn_today) return `今天穿了 · 共${c.wear_count}次`;
  if (c.wear_count > 0) return `穿过${c.wear_count}次 · ${c.last_worn.slice(5)}`;
  return '还没穿过';
}

Page({
  data: {
    sortKey: 'newest',
    sortLabel: '最新',
    sortOptions: SORTS.map((s) => s.label), // picker 的 range
    sortIndex: 0,
    staleOnly: false,
    firstLoad: true, // 首次加载中：显示骨架屏
    skeletons: [1, 2, 3, 4],
    keyword: '',
    categoryIds: [],
    locationIds: [],
    selectedSeasons: [],
    categories: [],
    locations: [],
    seasons: SEASONS,
    // 预先算好的激活态（避免 WXML 里 indexOf 表达式不稳定）
    seasonActive: {},    // { spring: true, ... }
    categoryActive: {},  // { 2: true, ... }
    locationActive: {},
    allActive: true,
    list: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    trimmed: false // 是否因内存窗口裁剪了最旧的
  },

  // 根据当前选中数组，重算每个芯片的激活态（纯数据，WXML 只读布尔）
  _refreshActive() {
    const { selectedSeasons, categoryIds, locationIds, staleOnly } = this.data;
    const seasonActive = {};
    SEASONS.forEach((s) => { seasonActive[s.key] = selectedSeasons.indexOf(s.key) >= 0; });
    const categoryActive = {};
    this.data.categories.forEach((c) => { categoryActive[c.id] = categoryIds.indexOf(c.id) >= 0; });
    const locationActive = {};
    this.data.locations.forEach((l) => { locationActive[l.id] = locationIds.indexOf(l.id) >= 0; });
    this.setData({
      seasonActive,
      categoryActive,
      locationActive,
      allActive: !selectedSeasons.length && !categoryIds.length && !locationIds.length && !staleOnly
    });
  },

  onShow() {
    // 从统计页「压箱底」跳转过来：预设「好久没穿」筛选
    const preset = getApp().globalData.listPreset;
    if (preset) {
      getApp().globalData.listPreset = null;
      this.setData({
        staleOnly: !!preset.staleOnly,
        categoryIds: [], locationIds: [], selectedSeasons: [], keyword: ''
      });
      this._refreshActive();
      this.loadFilters();
      this.reload();
      return;
    }
    // 从表单页返回（可能改了分类/位置或新增衣服）时刷新
    if (this.data.list.length === 0 || getApp().globalData.needRefresh) {
      getApp().globalData.needRefresh = false;
      this.loadFilters();
      this.reload();
    }
  },

  onPullDownRefresh() {
    this.loadFilters();
    this.reload().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadList(this.data.page + 1);
    }
  },

  loadFilters() {
    api.listCategories().then((d) => {
      this.setData({ categories: d || [] });
      this._refreshActive();
    }).catch(() => {});
    api.listLocations().then((d) => {
      this.setData({ locations: d || [] });
      this._refreshActive();
    }).catch(() => {});
  },

  reload() {
    this.setData({ list: [], page: 1, hasMore: true, trimmed: false });
    return this.loadList(1);
  },

  loadList(page) {
    // 翻页时防重入；重新加载(page 1)可以顶掉还在途中的旧请求，用序号丢弃过期响应
    if (page > 1 && this.data.loading) return Promise.resolve();
    const reqId = (this._reqId = (this._reqId || 0) + 1);
    this.setData({ loading: true });
    const { keyword, categoryIds, locationIds, selectedSeasons, pageSize, sortKey, staleOnly } = this.data;
    const params = {
      keyword: keyword.trim(),
      category_id: categoryIds.join(','),
      location_id: locationIds.join(','),
      season: selectedSeasons.join(','),
      sort: sortKey,
      page,
      page_size: pageSize
    };
    if (staleOnly) params.stale = 1;
    return api.listClothes(params).then((d) => {
      if (reqId !== this._reqId) return; // 期间筛选/排序又变了，这份结果已过期
      const items = (d.items || []).map((c) => ({
        ...c,
        seasonText: (c.seasons || []).map((s) => SEASON_LABEL[s] || s).join(' / '),
        wearText: wearText(c)
      }));
      let list = page === 1 ? items : this.data.list.concat(items);
      // 内存窗口：超出上限丢弃最旧的，DOM 节点数保持有界
      let trimmed = false;
      if (list.length > MAX_KEEP) {
        list = list.slice(list.length - MAX_KEEP);
        trimmed = true;
      }
      this.setData({
        list,
        page,
        hasMore: !!d.has_more,
        trimmed
      });
      if (trimmed) {
        console.info(`[list] 已裁剪到最近 ${MAX_KEEP} 件以控制内存`);
      }
    }).catch(() => {}).finally(() => {
      if (reqId !== this._reqId) return;
      this.setData({ loading: false, firstLoad: false });
    });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() { this.reload(); },

  clearKeyword() {
    this.setData({ keyword: '' });
    this.reload();
  },

  resetFilters() {
    this.setData({ categoryIds: [], locationIds: [], selectedSeasons: [], staleOnly: false });
    this._refreshActive();
    this.reload();
  },

  // 「好久没穿」：只看超过 30 天没穿（或入库后从没穿过）的衣服
  toggleStale() {
    this.setData({ staleOnly: !this.data.staleOnly });
    this._refreshActive();
    this.reload();
  },

  // 排序：原生 picker 选择（不用 ActionSheet，避免选项数量上限导致调用失败、无反应）
  onSortChange(e) {
    const idx = Number(e.detail.value);
    const s = SORTS[idx];
    if (!s) return;
    if (s.key === this.data.sortKey) {
      this.setData({ sortIndex: idx });
      return;
    }
    this.setData({ sortIndex: idx, sortKey: s.key, sortLabel: s.short });
    this.reload();
  },

  // 一键记录「今天穿了这件」；已记录则再点一次撤销
  toggleWear(e) {
    const id = Number(e.currentTarget.dataset.id);
    const item = this.data.list.find((c) => c.id === id);
    if (!item) return;
    this._wearBusy = this._wearBusy || {};
    if (this._wearBusy[id]) return;
    this._wearBusy[id] = true;
    const call = item.worn_today ? api.unwearClothes(id) : api.wearClothes(id);
    call.then((c) => {
      const list = this.data.list.map((x) => (x.id === id
        ? { ...x, wear_count: c.wear_count, last_worn: c.last_worn, worn_today: c.worn_today, wearText: wearText(c) }
        : x));
      this.setData({ list });
      wx.showToast({ title: c.worn_today ? '已记录今天穿过' : '已撤销', icon: 'none' });
    }).catch(() => {}).finally(() => { this._wearBusy[id] = false; });
  },

  // 多选 toggle 辅助：数组里有则移除，无则加入
  _toggle(arr, val) {
    const a = arr.slice();
    const i = a.indexOf(val);
    if (i >= 0) a.splice(i, 1); else a.push(val);
    return a;
  },

  toggleSeason(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ selectedSeasons: this._toggle(this.data.selectedSeasons, key) });
    this._refreshActive();
    this.reload();
  },

  toggleCategory(e) {
    const id = Number(e.currentTarget.dataset.id);
    this.setData({ categoryIds: this._toggle(this.data.categoryIds, id) });
    this._refreshActive();
    this.reload();
  },

  toggleLocation(e) {
    const id = Number(e.currentTarget.dataset.id);
    this.setData({ locationIds: this._toggle(this.data.locationIds, id) });
    this._refreshActive();
    this.reload();
  },

  previewItem(e) {
    const item = e.currentTarget.dataset.item;
    wx.previewImage({ current: item.image_url, urls: [item.image_url] });
  },

  // 图片加载失败（多为 COS 签名 URL 过期）：重新拉该条详情，刷新签名 URL
  onImageError(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    // 防止同一项反复触发
    this._refreshingImg = this._refreshingImg || {};
    if (this._refreshingImg[id]) return;
    this._refreshingImg[id] = true;
    api.getClothes(id).then((c) => {
      const list = this.data.list.map((item) =>
        item.id === id ? { ...item, image_url: c.image_url } : item
      );
      this.setData({ list });
    }).catch(() => {}).finally(() => {
      this._refreshingImg[id] = false;
    });
  },

  editItem(e) {
    // form 页是 tabBar 页面，navigateTo 到 tab 页会复用实例导致 id 不更新，
    // 用 redirectTo 在登录后的栈里无法返回，改用 reLaunch 太重——
    // 最佳方案：form 页 onShow 检测 id 变化，见 form.js
    wx.navigateTo({ url: `/pages/clothes/form/form?id=${e.currentTarget.dataset.id}` });
  },

  deleteItem(e) {
    const id = Number(e.currentTarget.dataset.id);
    wx.showModal({
      title: '提示',
      content: '确定删除这件衣服吗？',
      confirmColor: '#e07070',
      success: (res) => {
        if (!res.confirm) return;
        api.deleteClothes(id).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' });
          // dataset.id 是字符串，后端 c.id 是数字，统一转数字再比较
          const list = this.data.list.filter((c) => c.id !== id);
          this.setData({ list });
        }).catch(() => {});
      }
    });
  }
});
