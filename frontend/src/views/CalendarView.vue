<template>
  <div>
    <AppHeader />
    <div class="page">
      <div class="cal-wrap">
        <section class="panel cal">
          <div class="cal-head">
            <el-button circle :icon="ArrowLeft" @click="shift(-1)" />
            <div class="cal-title">{{ year }} 年 {{ month }} 月</div>
            <el-button circle :icon="ArrowRight" @click="shift(1)" />
          </div>
          <div class="cal-sub">本月穿了 {{ wornDays }} 天 · 共 {{ totalLogs }} 次</div>
          <div class="week">
            <span v-for="w in WEEK" :key="w">{{ w }}</span>
          </div>
          <div v-loading="loading" class="days">
            <template v-for="c in cells" :key="c.key">
              <span v-if="c.empty" class="cell empty" />
              <button v-else type="button" class="cell" :class="{ sel: c.date === selected, future: c.isFuture }"
                      :aria-label="`${c.date}，穿了 ${c.count} 件`" @click="pick(c.date)">
                <span class="d" :class="{ today: c.isToday }">{{ c.day }}</span>
                <span v-if="c.count" class="dot">{{ c.count }}</span>
              </button>
            </template>
          </div>
        </section>

        <section class="panel detail">
          <h3>{{ selectedTitle || '选择一天查看' }} <span v-if="selected" class="muted">穿了 {{ items.length }} 件</span></h3>
          <div v-for="c in items" :key="c.clothes_id" class="row">
            <img :src="c.image_url" :alt="c.name" loading="lazy" />
            <div class="main">
              <div class="nm">{{ c.name }}</div>
              <div v-if="c.outfit_name" class="tag">搭配 · {{ c.outfit_name }}</div>
            </div>
            <el-button size="small" text type="danger" @click="undo(c)">撤销</el-button>
          </div>
          <div v-if="selected && !items.length" class="muted center">这天没有穿着记录</div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import api from '../api'
import AppHeader from '../components/AppHeader.vue'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const pad = (n) => (n < 10 ? '0' + n : '' + n)

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const today = ref('')
const days = ref({})
const selected = ref('')
const wornDays = ref(0)
const totalLogs = ref(0)
const loading = ref(false)

const cells = computed(() => {
  const y = year.value
  const m = month.value
  const first = new Date(y, m - 1, 1).getDay()
  const total = new Date(y, m, 0).getDate()
  const out = []
  for (let i = 0; i < first; i++) out.push({ empty: true, key: 'e' + i })
  for (let d = 1; d <= total; d++) {
    const date = `${y}-${pad(m)}-${pad(d)}`
    out.push({
      key: date, day: d, date,
      count: (days.value[date] || []).length,
      isToday: date === today.value,
      isFuture: !!today.value && date > today.value,
    })
  }
  return out
})
const items = computed(() => (selected.value ? days.value[selected.value] || [] : []))
const selectedTitle = computed(() => {
  if (!selected.value) return ''
  return selected.value === today.value ? '今天' : `${Number(selected.value.slice(5, 7))} 月 ${Number(selected.value.slice(8))} 日`
})

let seq = 0
async function load() {
  const my = ++seq // 快速连点切月时，丢弃过期响应
  loading.value = true
  try {
    const res = await api.get('/wear/calendar', { params: { month: `${year.value}-${pad(month.value)}` } })
    if (my !== seq) return
    const d = res.data
    today.value = d.today
    days.value = d.days
    wornDays.value = d.worn_days
    totalLogs.value = d.total_logs
    const keys = Object.keys(d.days).sort()
    if (selected.value && selected.value.slice(0, 7) === d.month) return // 同月刷新：保持选中
    selected.value = d.today.slice(0, 7) === d.month ? d.today : (keys.length ? keys[keys.length - 1] : '')
  } catch (e) {
    if (my === seq) ElMessage.error(e.message)
  } finally {
    if (my === seq) loading.value = false
  }
}

function shift(delta) {
  let m = month.value + delta
  let y = year.value
  if (m < 1) { m = 12; y -= 1 }
  if (m > 12) { m = 1; y += 1 }
  year.value = y
  month.value = m
  selected.value = ''
  load()
}

function pick(date) { selected.value = date }

async function undo(c) {
  try {
    await ElMessageBox.confirm('把这件衣服在这一天的穿着记录删掉？', '撤销记录', { type: 'warning' })
    await api.delete(`/clothes/${c.clothes_id}/wear`, { params: { date: selected.value } })
    ElMessage.success('已撤销')
    load()
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
  }
}

onMounted(load)
</script>

<style scoped>
.cal-wrap { display: grid; grid-template-columns: minmax(320px, 460px) 1fr; gap: 16px; align-items: start; }
@media (max-width: 800px) { .cal-wrap { grid-template-columns: 1fr; } }
.panel {
  background: #fff; border-radius: 20px; padding: 18px 20px;
  box-shadow: 0 10px 30px rgba(124, 58, 237, .10), 0 2px 8px rgba(124, 58, 237, .05);
}
.cal-head { display: flex; align-items: center; justify-content: space-between; }
.cal-title { font-size: 17px; font-weight: 800; color: #46405a; }
.cal-sub { text-align: center; color: #9a93a8; font-size: 13px; margin: 6px 0 12px; }
.week { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; color: #b4a7d4; font-size: 12px; padding-bottom: 6px; }
.days { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 4px; min-height: 120px; }
.cell {
  height: 54px; border: 0; background: none; border-radius: 12px; margin: 0 2px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: inherit;
}
.cell.empty { cursor: default; }
.cell:not(.empty):hover { background: #f4f1fb; }
.cell.sel { background: #ede9fe; }
.cell.future .d { color: #d6cfe6; }
.cell .d { width: 26px; height: 26px; line-height: 26px; border-radius: 50%; font-size: 14px; color: #46405a; }
.cell .d.today { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: #fff; font-weight: 700; }
.cell .dot { margin-top: 1px; min-width: 16px; height: 14px; line-height: 14px; padding: 0 5px; border-radius: 7px; background: #7c3aed; color: #fff; font-size: 10px; }

.detail h3 { margin: 0 0 12px; font-size: 15px; color: #46405a; }
.muted { color: #9a93a8; font-weight: 400; font-size: 13px; }
.center { text-align: center; padding: 20px 0; }
.row { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
.row img { width: 48px; height: 60px; object-fit: cover; border-radius: 10px; background: #ede9fe; flex: none; }
.row .main { flex: 1; min-width: 0; }
.row .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #46405a; }
.row .tag { margin-top: 3px; font-size: 12px; color: #7c3aed; }
</style>
