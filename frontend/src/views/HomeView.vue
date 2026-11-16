<template>
  <div>
    <AppHeader />
    <div class="page">
      <div class="toolbar">
        <el-input v-model="filters.keyword" placeholder="搜索衣服名称" clearable
                  :prefix-icon="Search" @input="debouncedReload" />
        <el-select v-model="filters.seasons" multiple collapse-tags collapse-tags-tooltip clearable
                   placeholder="季节（可多选）" @change="reload">
          <el-option label="春" value="spring" />
          <el-option label="夏" value="summer" />
          <el-option label="秋" value="autumn" />
          <el-option label="冬" value="winter" />
        </el-select>
        <el-select v-model="filters.category_ids" multiple collapse-tags collapse-tags-tooltip clearable
                   placeholder="分类（可多选）" @change="reload">
          <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
        <el-select v-model="filters.location_ids" multiple collapse-tags collapse-tags-tooltip clearable
                   placeholder="位置（可多选）" @change="reload">
          <el-option v-for="l in locations" :key="l.id" :label="l.name" :value="l.id" />
        </el-select>
        <el-select v-model="filters.sort" placeholder="排序" @change="reload">
          <el-option v-for="s in SORTS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-checkbox v-model="filters.stale" border @change="reload">💤 好久没穿</el-checkbox>
        <el-button @click="showCategory = true">分类管理</el-button>
        <el-button @click="showLocation = true">位置管理</el-button>
        <el-button type="primary" :icon="Plus" @click="openAdd">添加衣服</el-button>
      </div>

      <div v-if="items.length" v-infinite-scroll="loadMore"
           :infinite-scroll-disabled="loading || !hasMore" class="waterfall">
        <div v-for="(item, index) in items" :key="item.id" class="waterfall-item"
             :style="{ animationDelay: (index % 20) * 45 + 'ms' }">
          <img :src="item.image_url" :alt="item.name" loading="lazy" />
          <div class="info">
            <el-tooltip :content="item.name" placement="top" :show-after="200" effect="light">
              <div class="name">{{ item.name }}</div>
            </el-tooltip>
            <div class="attr">
              <span class="attr-icon">🏷️</span>
              <el-tooltip :content="item.category_name || '未分类'" placement="top"
                          :show-after="200" effect="light">
                <span class="attr-text">{{ item.category_name || '未分类' }}</span>
              </el-tooltip>
            </div>
            <div class="attr">
              <span class="attr-icon">📍</span>
              <el-tooltip :content="item.location_name || '未设置位置'" placement="top"
                          :show-after="200" effect="light">
                <span class="attr-text">{{ item.location_name || '未设置位置' }}</span>
              </el-tooltip>
            </div>
            <div class="attr">
              <span class="attr-icon">🗓️</span>
              <span v-if="item.seasons && item.seasons.length" class="season-chips">
                <span v-for="s in item.seasons" :key="s" class="season-chip"
                      :style="{ background: seasonColor(s) }">{{ seasonLabel(s) }}</span>
              </span>
              <span v-else class="attr-text">未设置季节</span>
            </div>
            <div class="attr">
              <span class="attr-icon">👣</span>
              <span class="attr-text" :class="{ worn: item.worn_today }">{{ wearText(item) }}</span>
            </div>
          </div>
          <div class="actions">
            <el-button size="small" :type="item.worn_today ? 'primary' : ''" :plain="!item.worn_today"
                       round :loading="wearBusy[item.id]" @click="toggleWear(item)">
              {{ item.worn_today ? '✓ 今天穿了' : '今天穿' }}
            </el-button>
            <el-button size="small" text type="primary" @click="openEdit(item)">编辑</el-button>
            <el-button size="small" text type="danger" @click="remove(item)">删除</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else-if="!loading"
                :description="filters.stale ? '没有好久没穿的衣服，保持得不错～' : '还没有衣服，点击右上角添加吧'" />

      <div v-if="loading" class="load-more">加载中…</div>
      <div v-else-if="items.length && !hasMore" class="load-more">没有更多了</div>

      <ClothesFormDialog v-model="showForm" :clothes="editing" :categories="categories"
                         :locations="locations" @saved="reload"
                         @category-created="fetchCategories" @location-created="fetchLocations" />
      <CategoryDialog v-model="showCategory" :categories="categories" @changed="onCategoryChanged" />
      <LocationDialog v-model="showLocation" :locations="locations" @changed="onLocationChanged" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import api from '../api'
import AppHeader from '../components/AppHeader.vue'
import ClothesFormDialog from '../components/ClothesFormDialog.vue'
import CategoryDialog from '../components/CategoryDialog.vue'
import LocationDialog from '../components/LocationDialog.vue'

const SEASON_LABELS = { spring: '🌸 春', summer: '☀️ 夏', autumn: '🍂 秋', winter: '❄️ 冬' }
const SEASON_COLORS = { spring: '#7ecb92', summer: '#ffab5e', autumn: '#d9a05b', winter: '#7fb8e8' }
const seasonLabel = (s) => SEASON_LABELS[s] || s
const seasonColor = (s) => SEASON_COLORS[s] || '#c39bff'

// 排序选项（value 与后端 sort 参数一致）
const SORTS = [
  { value: 'newest', label: '最新添加' },
  { value: 'oldest', label: '最早添加' },
  { value: 'name', label: '按名称' },
  { value: 'wear_desc', label: '穿得最多' },
  { value: 'wear_asc', label: '穿得最少' },
  { value: 'recent', label: '最近穿过' },
  { value: 'stale', label: '最久没穿' },
]

function wearText(c) {
  if (c.worn_today) return `今天穿了 · 共${c.wear_count}次`
  if (c.wear_count > 0) return `穿过${c.wear_count}次 · ${c.last_worn.slice(5)}`
  return '还没穿过'
}

const route = useRoute()
const items = ref([])
const categories = ref([])
const locations = ref([])
const filters = reactive({
  keyword: '', seasons: [], category_ids: [], location_ids: [],
  sort: 'newest', stale: route.query.stale === '1',
})
const page = ref(1)
const hasMore = ref(false)
const loading = ref(false)
const showForm = ref(false)
const showCategory = ref(false)
const showLocation = ref(false)
const editing = ref(null)
const wearBusy = reactive({})

let timer = null
function debouncedReload() {
  clearTimeout(timer)
  timer = setTimeout(reload, 300)
}

async function fetchCategories() {
  const res = await api.get('/categories')
  categories.value = res.data
}

async function fetchLocations() {
  const res = await api.get('/locations')
  locations.value = res.data
}

// 请求序号：筛选/排序连续变化时，丢弃过期的响应，避免旧结果覆盖新结果
let reqSeq = 0
async function loadPage(p) {
  const seq = ++reqSeq
  loading.value = true
  try {
    const res = await api.get('/clothes', {
      params: {
        page: p,
        page_size: 20,
        keyword: filters.keyword || undefined,
        season: filters.seasons.join(',') || undefined,
        category_id: filters.category_ids.join(',') || undefined,
        location_id: filters.location_ids.join(',') || undefined,
        sort: filters.sort,
        stale: filters.stale ? 1 : undefined,
      },
    })
    if (seq !== reqSeq) return
    if (p === 1) items.value = res.data.items
    else items.value.push(...res.data.items)
    hasMore.value = res.data.has_more
    page.value = p
  } catch (e) {
    if (seq === reqSeq) ElMessage.error(e.message)
  } finally {
    if (seq === reqSeq) loading.value = false
  }
}

function reload() { loadPage(1) }
function loadMore() { if (hasMore.value && !loading.value) loadPage(page.value + 1) }

function openAdd() { editing.value = null; showForm.value = true }
function openEdit(item) { editing.value = item; showForm.value = true }

// 一键记录「今天穿了」；已记录则再点一次撤销
async function toggleWear(item) {
  if (wearBusy[item.id]) return
  wearBusy[item.id] = true
  try {
    const res = item.worn_today
      ? await api.delete(`/clothes/${item.id}/wear`)
      : await api.post(`/clothes/${item.id}/wear`, {})
    Object.assign(item, {
      wear_count: res.data.wear_count,
      last_worn: res.data.last_worn,
      worn_today: res.data.worn_today,
    })
    ElMessage.success(res.data.worn_today ? '已记录今天穿过' : '已撤销')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    wearBusy[item.id] = false
  }
}

async function remove(item) {
  try {
    await ElMessageBox.confirm(`确认删除「${item.name}」？`, '提示', { type: 'warning' })
    await api.delete(`/clothes/${item.id}`)
    ElMessage.success('已删除')
    reload()
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
  }
}

function onCategoryChanged() {
  fetchCategories()
  // 分类被删除后，已选中的过滤条件里可能含有失效 id，清掉
  filters.category_ids = filters.category_ids.filter((id) => categories.value.some((c) => c.id === id))
  reload()
}

function onLocationChanged() {
  fetchLocations()
  filters.location_ids = filters.location_ids.filter((id) => locations.value.some((l) => l.id === id))
  reload()
}

onMounted(async () => {
  // 先拿到分类/位置再加载列表，这样 onCategoryChanged 之类的过滤清理不会误清
  await Promise.all([fetchCategories(), fetchLocations()])
  reload()
})
</script>

<style scoped>
.attr-text.worn { color: #7c3aed; font-weight: 600; }
.actions { flex-wrap: wrap; align-items: center; }
.toolbar .el-checkbox { margin-right: 0; }
</style>
