const api = require('../../api/index');

Page({
  data: {
    users: [],
    keyword: '',
    pendingCount: 0,
    loading: true
  },

  onShow() {
    const user = getApp().globalData.user;
    // 非管理员不该进来（直接输路径/旧缓存时兜底）
    if (user && !user.is_admin) {
      wx.showToast({ title: '需要管理员权限', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  load() {
    const reqId = (this._reqId = (this._reqId || 0) + 1);
    return api.adminListUsers(this.data.keyword.trim()).then((list) => {
      if (reqId !== this._reqId) return;
      // 待审核的排最前面，其余按 id 升序（后端已按 id 排序）
      const users = (list || []).slice().sort((a, b) => Number(a.is_approved) - Number(b.is_approved));
      this.setData({
        users,
        pendingCount: users.filter((u) => !u.is_approved).length
      });
    }).catch(() => {}).finally(() => this.setData({ loading: false }));
  },

  approve(e) {
    const id = Number(e.currentTarget.dataset.id);
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: '通过审核',
      content: `通过「${name}」的注册申请？通过后该用户即可登录。`,
      confirmColor: '#7C3AED',
      success: (res) => {
        if (!res.confirm) return;
        api.adminApproveUser(id).then(() => {
          wx.showToast({ title: '已通过', icon: 'success' });
          this.load();
        }).catch(() => {});
      }
    });
  }
});
