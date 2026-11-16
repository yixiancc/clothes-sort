const api = require('../../../api/index');

const MIN_ITEMS = 2;
const MAX_ITEMS = 8;

Page({
  data: {
    id: 0,
    name: '',
    note: '',
    keyword: '',
    clothes: [],          // 可选衣服（分页加载）
    selectedIds: [],      // 已选衣服 id，顺序即搭配展示顺序
    selected: [],         // 已选衣服（用于顶部预览）
    selectedMap: {},      // { id: 序号 }，WXML 只读预计算值
    page: 1,
    hasMore: true,
    loading: false,
    saving: false,
    maxItems: MAX_ITEMS
  },

  onLoad(options) {
    const id = Number(options.id || 0);
    this.setData({ id });
    wx.setNavigationBarTitle({ title: id ? '编辑搭配' : '新建搭配' });
    this._known = {}; // id -> 衣服对象，用于预览（即使被搜索条件过滤掉也能显示已选项）
    const tasks = [this.loadClothes(1)];
    if (id) tasks.push(this.loadOutfit(id));
    Promise.all(tasks);
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadClothes(this.data.page + 1);
  },

  loadOutfit(id) {
    return api.getOutfit(id).then((o) => {
      o.items.forEach((it) => {
        this._known[it.clothes_id] = { id: it.clothes_id, name: it.name, image_url: it.image_url };
      });
      this.setData({ name: o.name, note: o.note || '' });
      this._setSelected(o.items.map((it) => it.clothes_id));
    }).catch(() => {});
  },

  loadClothes(page) {
    if (this.data.loading) return Promise.resolve();
    const reqId = (this._reqId = (this._reqId || 0) + 1);
    this.setData({ loading: true });
    return api.listClothes({ keyword: this.data.keyword.trim(), page, page_size: 30 }).then((d) => {
      if (reqId !== this._reqId) return;
      const items = d.items || [];
      items.forEach((c) => { this._known[c.id] = c; });
      this.setData({
        clothes: page === 1 ? items : this.data.clothes.concat(items),
        page,
        hasMore: !!d.has_more
      });
      this._setSelected(this.data.selectedIds); // 补全预览里新认识的衣服信息
    }).catch(() => {}).finally(() => {
      if (reqId === this._reqId) this.setData({ loading: false });
    });
  },

  _setSelected(ids) {
    const selectedMap = {};
    ids.forEach((id, i) => { selectedMap[id] = i + 1; });
    this.setData({
      selectedIds: ids,
      selectedMap,
      selected: ids.map((id) => this._known[id] || { id, name: '', image_url: '' })
    });
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  onSearch() {
    this.setData({ loading: false }); // 搜索可以顶掉进行中的加载
    this.loadClothes(1);
  },

  toggle(e) {
    const id = Number(e.currentTarget.dataset.id);
    const ids = this.data.selectedIds.slice();
    const i = ids.indexOf(id);
    if (i >= 0) {
      ids.splice(i, 1);
    } else {
      if (ids.length >= MAX_ITEMS) {
        wx.showToast({ title: `一套搭配最多 ${MAX_ITEMS} 件`, icon: 'none' });
        return;
      }
      ids.push(id);
    }
    this._setSelected(ids);
  },

  // 预览里点已选项：移到最前面（调整展示顺序）
  moveFirst(e) {
    const id = Number(e.currentTarget.dataset.id);
    const ids = this.data.selectedIds.filter((x) => x !== id);
    ids.unshift(id);
    this._setSelected(ids);
  },

  remove(e) {
    const id = Number(e.currentTarget.dataset.id);
    this._setSelected(this.data.selectedIds.filter((x) => x !== id));
  },

  save() {
    const { id, name, note, selectedIds, saving } = this.data;
    if (saving) return;
    if (!name.trim()) {
      wx.showToast({ title: '请给搭配起个名字', icon: 'none' });
      return;
    }
    if (selectedIds.length < MIN_ITEMS) {
      wx.showToast({ title: `至少选 ${MIN_ITEMS} 件衣服`, icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    const payload = { name: name.trim(), note: note.trim(), clothes_ids: selectedIds };
    const p = id ? api.updateOutfit(id, payload) : api.createOutfit(payload);
    p.then(() => {
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    }).catch(() => {}).finally(() => this.setData({ saving: false }));
  }
});
