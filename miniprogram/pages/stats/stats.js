const api = require('../../api/index');

// 图表配色：单一紫色系（数量大小用同色深浅/长度表达，不用彩虹色）
function withPercent(rows) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows.map((r) => ({ ...r, pct: Math.round((r.count / max) * 100) }));
}

Page({
  data: {
    loading: true,
    s: null,
    seasons: [],
    categories: [],
    locations: [],
    monthly: [],
    mostWorn: [],
    leastWorn: []
  },

  onShow() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  load() {
    return api.statsOverview().then((s) => {
      const maxMonth = Math.max(1, ...s.monthly.map((m) => m.count));
      this.setData({
        s,
        seasons: withPercent(s.by_season),
        categories: withPercent(s.by_category),
        locations: withPercent(s.by_location),
        monthly: s.monthly.map((m) => ({
          ...m,
          label: `${Number(m.month.slice(5))}月`,
          h: m.count ? Math.max(8, Math.round((m.count / maxMonth) * 100)) : 0
        })),
        mostWorn: s.most_worn,
        leastWorn: s.least_worn.map((c) => ({
          ...c,
          note: c.last_worn ? `${c.days_unworn} 天没穿` : `入库 ${c.days_unworn} 天，没穿过`
        }))
      });
    }).catch(() => {}).finally(() => this.setData({ loading: false }));
  },

  goCalendar() {
    wx.navigateTo({ url: '/pages/calendar/calendar' });
  },

  // 点「好久没穿」：回到衣柜页并只看这些
  viewStale() {
    getApp().globalData.listPreset = { staleOnly: true };
    wx.switchTab({ url: '/pages/clothes/list/list' });
  },

  preview(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ current: url, urls: [url] });
  }
});
