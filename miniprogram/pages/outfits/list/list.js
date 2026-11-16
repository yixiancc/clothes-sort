const api = require('../../../api/index');

Page({
  data: { list: [], loading: true },

  onShow() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  load() {
    return api.listOutfits().then((d) => {
      const list = (d || []).map((o) => ({
        ...o,
        thumbs: o.items.slice(0, 4),
        more: Math.max(0, o.items.length - 4),
        wearText: o.worn_today ? `今天穿了 · 共${o.wear_count}次`
          : (o.wear_count > 0 ? `穿过${o.wear_count}次 · ${o.last_worn.slice(5)}` : '还没穿过')
      }));
      this.setData({ list });
    }).catch(() => {}).finally(() => this.setData({ loading: false }));
  },

  create() {
    wx.navigateTo({ url: '/pages/outfits/form/form' });
  },

  edit(e) {
    wx.navigateTo({ url: `/pages/outfits/form/form?id=${e.currentTarget.dataset.id}` });
  },

  // 记录今天穿了这套；已记录则再点一次撤销
  toggleWear(e) {
    const id = Number(e.currentTarget.dataset.id);
    const o = this.data.list.find((x) => x.id === id);
    if (!o) return;
    this._busy = this._busy || {};
    if (this._busy[id]) return;
    this._busy[id] = true;
    const call = o.worn_today ? api.unwearOutfit(id) : api.wearOutfit(id);
    call.then(() => {
      wx.showToast({ title: o.worn_today ? '已撤销' : '已记录今天穿搭', icon: 'none' });
      getApp().globalData.needRefresh = true; // 衣柜列表里的穿着次数也变了
      return this.load();
    }).catch(() => {}).finally(() => { this._busy[id] = false; });
  },

  remove(e) {
    const id = Number(e.currentTarget.dataset.id);
    wx.showModal({
      title: '提示',
      content: '删除这套搭配？（衣服和穿着记录不受影响）',
      confirmColor: '#E11D48',
      success: (res) => {
        if (!res.confirm) return;
        api.deleteOutfit(id).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' });
          this.setData({ list: this.data.list.filter((x) => x.id !== id) });
        }).catch(() => {});
      }
    });
  },

  previewOutfit(e) {
    const o = this.data.list.find((x) => x.id === Number(e.currentTarget.dataset.id));
    if (!o || !o.items.length) return;
    wx.previewImage({ current: o.items[0].image_url, urls: o.items.map((i) => i.image_url) });
  }
});
