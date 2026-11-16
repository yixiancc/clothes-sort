<template>
  <div>
    <AppHeader />
    <div class="page">
      <div class="toolbar">
        <span class="title">我的搭配 <span class="count">{{ outfits.length }} 套</span></span>
        <div class="spacer" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新建搭配</el-button>
      </div>

      <div v-if="outfits.length" class="outfit-grid">
        <div v-for="o in outfits" :key="o.id" class="outfit-card">
          <div class="o-head">
            <div class="o-name">{{ o.name }}</div>
            <div class="o-count">{{ o.clothes_count }} 件</div>
          </div>
          <div class="thumbs">
            <img v-for="t in o.items.slice(0, 4)" :key="t.clothes_id" :src="t.image_url" :alt="t.name" loading="lazy" />
            <div v-if="o.items.length > 4" class="more">+{{ o.items.length - 4 }}</div>
          </div>
          <div v-if="o.note" class="o-note">{{ o.note }}</div>
          <div class="o-wear" :class="{ worn: o.worn_today }">{{ wearText(o) }}</div>
          <div class="o-actions">
            <el-button size="small" :type="o.worn_today ? 'primary' : ''" :plain="!o.worn_today" round
                       :loading="busy[o.id]" @click="toggleWear(o)">
              {{ o.worn_today ? '✓ 今天穿了' : '今天穿这套' }}
            </el-button>
            <el-button size="small" text type="primary" @click="openEdit(o)">编辑</el-button>
            <el-button size="small" text type="danger" @click="remove(o)">删除</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else-if="!loading" description="还没有搭配，把几件衣服组成一套吧" />

      <!-- 新建 / 编辑搭配 -->
      <el-dialog v-model="showForm" :title="form.id ? '编辑搭配' : '新建搭配'" width="min(720px, 94vw)">
        <el-form label-width="70px">
          <el-form-item label="名称" required>
            <el-input v-model="form.name" maxlength="50" placeholder="如：周一通勤" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="form.note" maxlength="200" placeholder="场合、心情……（可选）" />
          </el-form-item>
          <el-form-item :label="`已选 ${form.ids.length}/${MAX_ITEMS}`">
            <div v-if="selectedList.length" class="sel-row">
              <div v-for="(c, i) in selectedList" :key="c.id" class="sel-item">
                <img :src="c.image_url" :alt="c.name" />
                <span class="no">{{ i + 1 }}</span>
                <span class="x" title="移除" @click="toggle(c.id)">×</span>
                <span v-if="i > 0" class="first" title="移到最前" @click="moveFirst(c.id)">⇤</span>
              </div>
            </div>
            <span v-else class="hint">从下面的衣服里挑 {{ MIN_ITEMS }}~{{ MAX_ITEMS }} 件</span>
          </el-form-item>
          <el-form-item label="选衣服">
            <el-input v-model="pickKeyword" placeholder="搜索衣服名称" clearable :prefix-icon="Search"
                      @input="debouncedPick" />
          </el-form-item>
        </el-form>
        <div v-loading="pickLoading" class="pick-grid">
          <div v-for="c in pickList" :key="c.id" class="pick" :class="{ on: form.ids.includes(c.id) }"
               @click="toggle(c.id)">
            <img :src="c.image_url" :alt="c.name" loading="lazy" />
            <div class="pn">{{ c.name }}</div>
            <span v-if="form.ids.includes(c.id)" class="badge">{{ form.ids.indexOf(c.id) + 1 }}</span>
          </div>
        </div>
        <div v-if="!pickLoading && !pickList.length" class="hint center">没有找到衣服</div>
        <div v-if="pickHasMore" class="center">
          <el-button text type="primary" :loading="pickLoading" @click="loadPick(pickPage + 1)">加载更多</el-button>
        </div>
        <template #footer>
          <el-button @click="showForm = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import api from '../api'
import AppHeader from '../components/AppHeader.vue'

const MIN_ITEMS = 2
const MAX_ITEMS = 8

const outfits = ref([])
const loading = ref(false)
const busy = reactive({})

function wearText(o) {
  if (o.worn_today) return `今天穿了 · 共${o.wear_count}次`
  if (o.wear_count > 0) return `穿过${o.wear_count}次 · ${o.last_worn.slice(5)}`
  return '还没穿过'
}

async function load() {
  loading.value = true
  try {
    outfits.value = (await api.get('/outfits')).data
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function toggleWear(o) {
  if (busy[o.id]) return
  busy[o.id] = true
  try {
    if (o.worn_today) await api.delete(`/outfits/${o.id}/wear`)
    else await api.post(`/outfits/${o.id}/wear`, {})
    ElMessage.success(o.worn_today ? '已撤销' : '已记录今天穿搭')
    await load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    busy[o.id] = false
  }
}

async function remove(o) {
  try {
    await ElMessageBox.confirm(`删除搭配「${o.name}」？（衣服和穿着记录不受影响）`, '提示', { type: 'warning' })
    await api.delete(`/outfits/${o.id}`)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
  }
}

// ---------- 新建 / 编辑 ----------
const showForm = ref(false)
const saving = ref(false)
const form = reactive({ id: 0, name: '', note: '', ids: [] })
const known = reactive({})        // id -> 衣服（用于已选预览，即使被搜索过滤掉也能显示）
const pickKeyword = ref('')
const pickList = ref([])
const pickPage = ref(1)
const pickHasMore = ref(false)
const pickLoading = ref(false)

const selectedList = computed(() => form.ids.map((id) => known[id]).filter(Boolean))

let pickSeq = 0
async function loadPick(p) {
  const seq = ++pickSeq
  pickLoading.value = true
  try {
    const res = await api.get('/clothes', {
      params: { page: p, page_size: 30, keyword: pickKeyword.value || undefined },
    })
    if (seq !== pickSeq) return
    res.data.items.forEach((c) => { known[c.id] = c })
    pickList.value = p === 1 ? res.data.items : pickList.value.concat(res.data.items)
    pickPage.value = p
    pickHasMore.value = res.data.has_more
  } catch (e) {
    if (seq === pickSeq) ElMessage.error(e.message)
  } finally {
    if (seq === pickSeq) pickLoading.value = false
  }
}

let timer = null
function debouncedPick() {
  clearTimeout(timer)
  timer = setTimeout(() => loadPick(1), 300)
}

function openCreate() {
  Object.assign(form, { id: 0, name: '', note: '', ids: [] })
  pickKeyword.value = ''
  showForm.value = true
  loadPick(1)
}

function openEdit(o) {
  Object.assign(form, { id: o.id, name: o.name, note: o.note || '', ids: o.items.map((i) => i.clothes_id) })
  o.items.forEach((i) => { known[i.clothes_id] = { id: i.clothes_id, name: i.name, image_url: i.image_url } })
  pickKeyword.value = ''
  showForm.value = true
  loadPick(1)
}

function toggle(id) {
  const i = form.ids.indexOf(id)
  if (i >= 0) { form.ids.splice(i, 1); return }
  if (form.ids.length >= MAX_ITEMS) return ElMessage.warning(`一套搭配最多 ${MAX_ITEMS} 件`)
  form.ids.push(id)
}

function moveFirst(id) {
  form.ids = [id, ...form.ids.filter((x) => x !== id)]
}

async function save() {
  if (!form.name.trim()) return ElMessage.warning('请给搭配起个名字')
  if (form.ids.length < MIN_ITEMS) return ElMessage.warning(`至少选 ${MIN_ITEMS} 件衣服`)
  saving.value = true
  try {
    const payload = { name: form.name.trim(), note: form.note.trim(), clothes_ids: form.ids }
    if (form.id) await api.put(`/outfits/${form.id}`, payload)
    else await api.post('/outfits', payload)
    ElMessage.success('保存成功')
    showForm.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.title { font-size: 16px; font-weight: 800; color: #46405a; }
.count { font-weight: 400; color: #9a93a8; font-size: 13px; margin-left: 6px; }
.toolbar .spacer { flex: 1; }

.outfit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.outfit-card {
  background: #fff; border-radius: 20px; padding: 16px;
  box-shadow: 0 10px 30px rgba(124, 58, 237, .10), 0 2px 8px rgba(124, 58, 237, .05);
  animation: fadeInUp .4s ease both;
}
.o-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.o-name { font-weight: 800; font-size: 16px; color: #46405a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.o-count { color: #9a93a8; font-size: 12px; flex: none; }
.thumbs { display: flex; gap: 8px; margin-top: 12px; }
.thumbs img, .thumbs .more {
  width: 64px; height: 80px; border-radius: 12px; object-fit: cover; flex: none;
  background: linear-gradient(135deg, #f4f2fa, #ede9fe);
}
.thumbs .more { display: flex; align-items: center; justify-content: center; color: #7c3aed; font-weight: 700; }
.o-note { margin-top: 10px; color: #9a93a8; font-size: 12px; }
.o-wear { margin-top: 8px; font-size: 12px; color: #b4a7d4; }
.o-wear.worn { color: #7c3aed; font-weight: 600; }
.o-actions { margin-top: 10px; display: flex; align-items: center; gap: 4px; border-top: 1px solid #f4f1fb; padding-top: 10px; }

.sel-row { display: flex; flex-wrap: wrap; gap: 10px; }
.sel-item { position: relative; width: 64px; height: 80px; }
.sel-item img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; }
.sel-item .no {
  position: absolute; left: 4px; bottom: 4px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px;
  background: rgba(124, 58, 237, .9); color: #fff; font-size: 11px; text-align: center; line-height: 18px;
}
.sel-item .x {
  position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; cursor: pointer;
  background: #e11d48; color: #fff; text-align: center; line-height: 19px; font-size: 14px;
}
.sel-item .first {
  position: absolute; top: -6px; left: -6px; width: 20px; height: 20px; border-radius: 50%; cursor: pointer;
  background: #7c3aed; color: #fff; text-align: center; line-height: 19px; font-size: 12px;
}
.hint { color: #9a93a8; font-size: 13px; }
.center { text-align: center; padding: 12px 0; }

.pick-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px;
  max-height: 320px; overflow-y: auto; padding: 4px;
}
.pick { position: relative; border-radius: 14px; overflow: hidden; cursor: pointer; background: #fff; border: 2px solid transparent; box-shadow: 0 4px 12px rgba(124, 58, 237, .08); }
.pick.on { border-color: #7c3aed; }
.pick img { width: 100%; height: 110px; object-fit: cover; display: block; background: #ede9fe; }
.pick .pn { padding: 4px 6px 6px; font-size: 12px; color: #46405a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pick .badge {
  position: absolute; top: 5px; right: 5px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
  background: #7c3aed; color: #fff; font-size: 12px; font-weight: 700; text-align: center; line-height: 20px;
}
</style>
