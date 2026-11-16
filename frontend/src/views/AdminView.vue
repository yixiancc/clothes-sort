<template>
  <div>
    <AppHeader />
    <div class="page">
      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索用户名/昵称" clearable
                  :prefix-icon="Search" @input="debouncedLoad" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新建用户</el-button>
      </div>

      <el-table :data="users" v-loading="loading" style="width:100%">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="用户名" min-width="110" />
        <el-table-column prop="nickname" label="昵称" min-width="110" />
        <el-table-column label="角色" width="90">
          <template #default="{ row }">
            <el-tag :type="row.is_admin ? 'danger' : 'info'" size="small">
              {{ row.is_admin ? '管理员' : '用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审核" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.is_approved" type="success" size="small">已通过</el-tag>
            <el-button v-else size="small" type="warning" @click="approve(row)">待审核 · 通过</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="clothes_count" label="衣服数" width="80" />
        <el-table-column prop="created_at" label="注册时间" min-width="150" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="viewClothes(row)">衣服</el-button>
            <el-button size="small" type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="removeUser(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 查看某用户的衣服 -->
      <el-drawer v-model="showClothes" :title="`「${currentUser?.nickname}」的衣服`" size="min(560px, 94vw)">
        <div class="drawer-grid">
          <div v-for="c in userClothes" :key="c.id" class="waterfall-item">
            <img :src="c.image_url" :alt="c.name" loading="lazy" />
            <div class="info">
              <div class="name">{{ c.name }}</div>
              <div class="attr-line"><span class="attr-label">分类：</span>{{ c.category_name || '未分类' }}</div>
              <div class="attr-line">
                <span class="attr-label">季节：</span>
                <template v-if="c.seasons && c.seasons.length">
                  <el-tag v-for="s in c.seasons" :key="s" size="small" effect="dark"
                          :color="seasonColor(s)" style="border:none; color:#fff; margin-right:4px">
                    {{ seasonLabel(s) }}
                  </el-tag>
                </template>
                <template v-else>未设置</template>
              </div>
              <div class="attr-line"><span class="attr-label">位置：</span>{{ c.location_name || '未设置' }}</div>
            </div>
            <div class="actions">
              <el-button size="small" text type="primary" @click="openClothesEdit(c)">编辑</el-button>
              <el-button size="small" text type="danger" @click="removeClothes(c)">删除</el-button>
            </div>
          </div>
        </div>
        <el-empty v-if="!userClothes.length" description="该用户还没有衣服" />
      </el-drawer>

      <!-- 编辑用户衣服 -->
      <ClothesFormDialog v-model="showClothesForm" :clothes="editingClothes"
                         :categories="userCategories" :locations="userLocations"
                         :admin-user-id="currentUser?.id"
                         @saved="onClothesSaved" />

      <!-- 新建/编辑用户 -->
      <el-dialog v-model="showForm" :title="editingUser ? '编辑用户' : '新建用户'" width="min(420px, 92vw)">
        <el-form label-width="80px">
          <el-form-item label="用户名" required>
            <el-input v-model="form.username" />
          </el-form-item>
          <el-form-item label="昵称">
            <el-input v-model="form.nickname" />
          </el-form-item>
          <el-form-item :label="editingUser ? '重置密码' : '密码'" :required="!editingUser">
            <el-input v-model="form.password" type="password" show-password
                      :placeholder="editingUser ? '留空则不修改' : '至少6位'" />
          </el-form-item>
          <el-form-item label="管理员">
            <el-switch v-model="form.is_admin" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showForm = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveUser">保存</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import api from '../api'
import AppHeader from '../components/AppHeader.vue'
import ClothesFormDialog from '../components/ClothesFormDialog.vue'

const SEASON_LABELS = { spring: '🌸 春', summer: '☀️ 夏', autumn: '🍂 秋', winter: '❄️ 冬' }
const SEASON_COLORS = { spring: '#7ecb92', summer: '#ffab5e', autumn: '#d9a05b', winter: '#7fb8e8' }
const seasonLabel = (s) => SEASON_LABELS[s] || s
const seasonColor = (s) => SEASON_COLORS[s] || '#c39bff'

const users = ref([])
const keyword = ref('')
const loading = ref(false)
const showClothes = ref(false)
const userClothes = ref([])
const currentUser = ref(null)
const showForm = ref(false)
const editingUser = ref(null)
const showClothesForm = ref(false)
const editingClothes = ref(null)
const userCategories = ref([])
const userLocations = ref([])
const saving = ref(false)
const form = reactive({ username: '', nickname: '', password: '', is_admin: false })

let timer = null
function debouncedLoad() {
  clearTimeout(timer)
  timer = setTimeout(load, 300)
}

async function load() {
  loading.value = true
  try {
    const res = await api.get('/admin/users', { params: { keyword: keyword.value || undefined } })
    users.value = res.data
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function viewClothes(row) {
  currentUser.value = row
  showClothes.value = true
  userClothes.value = []
  userCategories.value = []
  userLocations.value = []
  try {
    const [clothesRes, catsRes, locsRes] = await Promise.all([
      api.get(`/admin/users/${row.id}/clothes`),
      api.get(`/admin/users/${row.id}/categories`),
      api.get(`/admin/users/${row.id}/locations`),
    ])
    userClothes.value = clothesRes.data
    userCategories.value = catsRes.data
    userLocations.value = locsRes.data
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function openClothesEdit(c) {
  editingClothes.value = c
  showClothesForm.value = true
}

async function onClothesSaved() {
  const [catsRes, locsRes, clothesRes] = await Promise.all([
    api.get(`/admin/users/${currentUser.value.id}/categories`),
    api.get(`/admin/users/${currentUser.value.id}/locations`),
    api.get(`/admin/users/${currentUser.value.id}/clothes`),
  ])
  userCategories.value = catsRes.data
  userLocations.value = locsRes.data
  userClothes.value = clothesRes.data
}

async function removeClothes(c) {
  try {
    await ElMessageBox.confirm(`确认删除「${c.name}」？`, '提示', { type: 'warning' })
    await api.delete(`/admin/clothes/${c.id}`)
    ElMessage.success('已删除')
    userClothes.value = userClothes.value.filter(x => x.id !== c.id)
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
  }
}

function openCreate() {
  editingUser.value = null
  Object.assign(form, { username: '', nickname: '', password: '', is_admin: false })
  showForm.value = true
}

function openEdit(row) {
  editingUser.value = row
  Object.assign(form, { username: row.username, nickname: row.nickname, password: '', is_admin: row.is_admin })
  showForm.value = true
}

async function saveUser() {
  saving.value = true
  try {
    if (editingUser.value) {
      await api.put(`/admin/users/${editingUser.value.id}`, {
        username: form.username,
        nickname: form.nickname,
        is_admin: form.is_admin,
        new_password: form.password || undefined,
      })
    } else {
      await api.post('/admin/users', { ...form })
    }
    ElMessage.success('保存成功')
    showForm.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

async function approve(row) {
  try {
    await api.put(`/admin/users/${row.id}/approve`)
    ElMessage.success(`已通过「${row.username}」的审核`)
    load()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function removeUser(row) {
  try {
    await ElMessageBox.confirm(`确认删除用户「${row.username}」？其所有衣服和分类将一并删除！`, '警告', { type: 'warning' })
    await api.delete(`/admin/users/${row.id}`)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
  }
}

onMounted(load)
</script>

<style scoped>
.drawer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.attr-line {
  font-size: 13px;
  color: #606266;
  margin-top: 4px;
}
.attr-label {
  color: #7c3aed;
  font-weight: 600;
}
</style>
