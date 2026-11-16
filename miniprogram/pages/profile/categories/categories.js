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
    api.listCategories().then((d) => this.setData({ list: d || [] })).catch(() => {});
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
    api.createCategory(name).then(() => {
      this.setData({ newName: '' });
      this.markDirty();
      this.load();
    }).catch(() => {});
  },

  rename(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '修改分类名',
      editable: true,
      placeholderText: '分类名称',
      content: name,
      success: (res) => {
        if (!res.confirm || !res.content || !res.content.trim()) return;
        api.updateCategory(id, res.content.trim()).then(() => {
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
      content: '删除后该分类下的衣服将归为「未分类」，确定删除？',
      confirmColor: '#e07070',
      success: (res) => {
        if (!res.confirm) return;
        api.deleteCategory(id).then(() => {
          this.markDirty();
          this.load();
        }).catch(() => {});
      }
    });
  }
});
