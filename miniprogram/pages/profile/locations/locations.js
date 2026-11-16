const api = require('../../../api/index');

Page({
  data: {
    list: [],
    newName: ''
  },

  onShow() {
    this.load();
  },

  load() {
    api.listLocations().then((d) => this.setData({ list: d || [] })).catch(() => {});
  },

  onInput(e) {
    this.setData({ newName: e.detail.value });
  },

  markDirty() {
    getApp().globalData.needRefresh = true;
  },

  add() {
    const name = this.data.newName.trim();
    if (!name) return;
    api.createLocation(name).then(() => {
      this.setData({ newName: '' });
      this.markDirty();
      this.load();
    }).catch(() => {});
  },

  rename(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '修改位置名',
      editable: true,
      placeholderText: '位置名称',
      content: name,
      success: (res) => {
        if (!res.confirm || !res.content || !res.content.trim()) return;
        api.updateLocation(id, res.content.trim()).then(() => {
          this.markDirty();
          this.load();
        }).catch(() => {});
      }
    });
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '删除后该位置下的衣服将归为「未设置位置」，确定删除？',
      confirmColor: '#e07070',
      success: (res) => {
        if (!res.confirm) return;
        api.deleteLocation(id).then(() => {
          this.markDirty();
          this.load();
        }).catch(() => {});
      }
    });
  }
});
