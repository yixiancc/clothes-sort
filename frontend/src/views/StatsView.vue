<template>
  <div>
    <AppHeader />
    <div class="page">
      <div v-loading="loading" class="stats">
        <!-- KPI：数字本身就是图表 -->
        <div v-if="s" class="kpi-row">
          <div class="kpi"><div class="v">{{ s.total }}</div><div class="l">件衣服</div></div>
          <div class="kpi"><div class="v">{{ s.outfit_count }}</div><div class="l">套搭配</div></div>
          <router-link class="kpi link" to="/calendar"><div class="v">{{ s.wear_logs_30d }}</div><div class="l">近 30 天穿着 ›</div></router-link>
          <router-link class="kpi link" :to="{ path: '/', query: { stale: 1 } }">
            <div class="v warn">{{ s.stale_count }}</div><div class="l">压箱底（&gt;{{ s.stale_days }} 天没穿）›</div>
          </router-link>
        </div>

        <template v-if="s && s.total">
          <div class="grid">
            <!-- 利用率 -->
            <section class="panel">
              <h3>穿着利用率</h3>
              <div class="meter"><div class="fill" :style="{ width: usedPct + '%' }" /></div>
              <div class="meter-text">
                <span>{{ s.worn_total }} 件穿过（{{ usedPct }}%）</span>
                <span class="muted">{{ s.never_worn }} 件还没穿过</span>
              </div>
            </section>

            <!-- 月度趋势：柱状图（SVG） -->
            <section class="panel">
              <h3>近 6 个月穿着次数</h3>
              <svg class="chart" :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="近6个月穿着次数柱状图">
                <line :x1="PAD" :x2="W - PAD" :y1="H - 28" :y2="H - 28" class="axis" />
                <g v-for="(m, i) in monthly" :key="m.month">
                  <rect :x="m.x" :y="m.y" :width="m.w" :height="m.h" rx="4" class="bar" />
                  <text :x="m.x + m.w / 2" :y="H - 10" class="tick" text-anchor="middle">{{ Number(m.month.slice(5)) }}月</text>
                  <text v-if="m.count" :x="m.x + m.w / 2" :y="m.y - 6" class="val" text-anchor="middle">{{ m.count }}</text>
                  <title>{{ m.month }}：{{ m.count }} 次</title>
                </g>
              </svg>
            </section>

            <section class="panel">
              <h3>按季节</h3>
              <BarList :rows="s.by_season.map((r) => ({ name: r.label, count: r.count }))" />
            </section>
            <section v-if="s.by_category.length" class="panel">
              <h3>按分类</h3>
              <BarList :rows="s.by_category" />
            </section>
            <section v-if="s.by_location.length" class="panel">
              <h3>按位置</h3>
              <BarList :rows="s.by_location" />
            </section>

            <section v-if="s.most_worn.length" class="panel">
              <h3>最爱穿 TOP{{ s.most_worn.length }}</h3>
              <div v-for="(c, i) in s.most_worn" :key="c.id" class="rank">
                <span class="no">{{ i + 1 }}</span>
                <img :src="c.image_url" :alt="c.name" loading="lazy" />
                <span class="nm">{{ c.name }}</span>
                <span class="val">{{ c.wear_count }} 次</span>
              </div>
            </section>
            <section v-if="s.least_worn.length" class="panel">
              <h3>压箱底 <span class="muted">共 {{ s.stale_count }} 件</span></h3>
              <div v-for="c in s.least_worn" :key="c.id" class="rank">
                <img :src="c.image_url" :alt="c.name" loading="lazy" />
                <span class="nm">{{ c.name }}</span>
                <span class="val muted">{{ c.last_worn ? `${c.days_unworn} 天没穿` : `入库 ${c.days_unworn} 天，没穿过` }}</span>
              </div>
            </section>
          </div>
        </template>
        <el-empty v-else-if="s && !loading" description="衣柜还是空的，先去添加几件衣服吧" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../api'
import AppHeader from '../components/AppHeader.vue'

// 横向条形列表（名称 / 轨道 / 数值）。单色系，长度表达数量
const BarList = defineComponent({
  props: { rows: { type: Array, default: () => [] } },
  setup(props) {
    return () => {
      const max = Math.max(1, ...props.rows.map((r) => r.count))
      return h('div', props.rows.map((r) =>
        h('div', { class: 'bar-row', key: r.name }, [
          h('span', { class: 'bn', title: r.name }, r.name),
          h('div', { class: 'bt' }, [h('div', { class: 'bf', style: { width: `${(r.count / max) * 100}%` } })]),
          h('span', { class: 'bv' }, r.count),
        ])))
    }
  },
})

const s = ref(null)
const loading = ref(false)

const usedPct = computed(() => (s.value && s.value.total ? Math.round((s.value.worn_total * 100) / s.value.total) : 0))

// 柱状图几何：4px 圆角柱，最宽 24px，基线固定
const W = 420
const H = 200
const PAD = 16
const monthly = computed(() => {
  if (!s.value) return []
  const rows = s.value.monthly
  const max = Math.max(1, ...rows.map((m) => m.count))
  const slot = (W - PAD * 2) / rows.length
  const bw = Math.min(24, slot * 0.5)
  const plotH = H - 28 - 24
  return rows.map((m, i) => {
    const bh = m.count ? Math.max(6, (m.count / max) * plotH) : 0
    return { ...m, w: bw, h: bh, x: PAD + slot * i + (slot - bw) / 2, y: H - 28 - bh }
  })
})
onMounted(async () => {
  loading.value = true
  try {
    s.value = (await api.get('/stats/overview')).data
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.stats { min-height: 200px; }
.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 16px; }
.kpi {
  background: #fff; border-radius: 20px; padding: 18px 12px; text-align: center; text-decoration: none; display: block;
  box-shadow: 0 10px 30px rgba(124, 58, 237, .10), 0 2px 8px rgba(124, 58, 237, .05);
}
.kpi .v { font-size: 34px; font-weight: 800; color: #7c3aed; line-height: 1.1; }
.kpi .v.warn { color: #e11d48; }
.kpi .l { margin-top: 6px; font-size: 12px; color: #9a93a8; }
.kpi.link { transition: transform .2s ease; }
.kpi.link:hover { transform: translateY(-3px); }

.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; }
.panel {
  background: #fff; border-radius: 20px; padding: 18px 20px;
  box-shadow: 0 10px 30px rgba(124, 58, 237, .10), 0 2px 8px rgba(124, 58, 237, .05);
}
.panel h3 { margin: 0 0 14px; font-size: 15px; color: #46405a; }
.muted { color: #9a93a8; font-weight: 400; }

.meter { height: 12px; border-radius: 6px; background: #ede9fe; overflow: hidden; }
.meter .fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, #a78bfa, #7c3aed); transition: width .5s ease; }
.meter-text { display: flex; justify-content: space-between; margin-top: 8px; font-size: 13px; color: #46405a; }

.chart { width: 100%; height: auto; display: block; }
.chart .axis { stroke: #ece8f6; stroke-width: 1; }
.chart .bar { fill: #7c3aed; transition: opacity .2s; }
.chart .bar:hover { opacity: .75; }
.chart .tick { fill: #9a93a8; font-size: 11px; }
.chart .val { fill: #46405a; font-size: 11px; }

.rank { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
.rank .no { width: 20px; font-weight: 800; color: #b4a7d4; }
.rank img { width: 44px; height: 56px; object-fit: cover; border-radius: 8px; background: #ede9fe; flex: none; }
.rank .nm { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #46405a; font-size: 14px; }
.rank .val { font-weight: 700; color: #7c3aed; font-size: 13px; flex: none; }
.rank .val.muted { font-weight: 400; }

</style>

<style>
/* BarList 渲染函数里的类名不带 scoped 属性，用全局样式 */
.bar-row { display: flex; align-items: center; margin-bottom: 10px; }
.bar-row .bn { width: 84px; font-size: 13px; color: #46405a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-row .bt { flex: 1; height: 10px; margin: 0 10px; border-radius: 5px; background: #f4f1fb; overflow: hidden; }
.bar-row .bf { height: 100%; border-radius: 5px; background: linear-gradient(90deg, #a78bfa, #7c3aed); transition: width .5s ease; }
.bar-row .bv { width: 36px; text-align: right; font-size: 13px; font-weight: 700; color: #7c3aed; }
</style>
