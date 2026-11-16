const api = require('../../api/index');

const pad = (n) => (n < 10 ? '0' + n : '' + n);
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function monthKey(y, m) { return `${y}-${pad(m)}`; }

Page({
  data: {
    year: 0,
    month: 0,
    today: '',
    week: WEEK,
    cells: [],        // 日历格子：{ day, date, count, isToday, isFuture, selected }
    days: {},         // { 'YYYY-MM-DD': [clothes...] }
    selected: '',     // 选中的日期
    selectedItems: [],
    selectedTitle: '',
    wornDays: 0,
    totalLogs: 0,
    loading: false
  },

  onLoad() {
    const now = new Date();
    this.setData({ year: now.getFullYear(), month: now.getMonth() + 1 });
    this.load();
  },

  load() {
    const { year, month } = this.data;
    const reqId = (this._reqId = (this._reqId || 0) + 1);
    this.setData({ loading: true });
    return api.wearCalendar(monthKey(year, month)).then((d) => {
      if (reqId !== this._reqId) return; // 快速连点切月时丢弃过期响应
      this.setData({
        today: d.today,
        days: d.days,
        wornDays: d.worn_days,
        totalLogs: d.total_logs
      });
      // 默认选中：本月 → 今天；其他月 → 当月 1 号附近第一个有记录的日子（没有就不选）
      const keys = Object.keys(d.days).sort();
      let sel = '';
      if (d.today.slice(0, 7) === d.month) sel = d.today;
      else if (keys.length) sel = keys[keys.length - 1];
      this._build(sel);
    }).catch(() => {}).finally(() => {
      if (reqId === this._reqId) this.setData({ loading: false });
    });
  },

  _build(selected) {
    const { year, month, days, today } = this.data;
    const first = new Date(year, month - 1, 1).getDay(); // 当月 1 号是周几
    const total = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push({ empty: true, key: 'e' + i });
    for (let d = 1; d <= total; d++) {
      const date = `${year}-${pad(month)}-${pad(d)}`;
      cells.push({
        key: date,
        day: d,
        date,
        count: (days[date] || []).length,
        isToday: date === today,
        isFuture: date > today,
        selected: date === selected
      });
    }
    const items = selected ? (days[selected] || []) : [];
    this.setData({
      cells,
      selected,
      selectedItems: items,
      selectedTitle: selected ? (selected === today ? '今天' : selected.slice(5).replace('-', '月') + '日') : ''
    });
  },

  prevMonth() { this._shift(-1); },
  nextMonth() { this._shift(1); },

  _shift(delta) {
    let { year, month } = this.data;
    month += delta;
    if (month < 1) { month = 12; year -= 1; }
    if (month > 12) { month = 1; year += 1; }
    this.setData({ year, month });
    this.load();
  },

  pick(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    this._build(date);
  },

  // 给选中的日期补记/撤销：下面的衣服列表里点「撤销」
  undo(e) {
    const { id } = e.currentTarget.dataset;
    const date = this.data.selected;
    if (!date) return;
    wx.showModal({
      title: '撤销记录',
      content: '把这件衣服在这一天的穿着记录删掉？',
      confirmColor: '#E11D48',
      success: (res) => {
        if (!res.confirm) return;
        api.unwearClothes(id, date).then(() => {
          getApp().globalData.needRefresh = true;
          this.load();
        }).catch(() => {});
      }
    });
  },

  preview(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ current: url, urls: [url] });
  }
});
