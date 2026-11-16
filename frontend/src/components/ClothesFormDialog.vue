<template>
  <el-dialog :model-value="modelValue" :title="isEdit ? '编辑衣服' : '添加衣服'"
             width="min(480px, 94vw)"
             @update:model-value="$emit('update:modelValue', $event)">
    <el-form label-width="70px">
      <el-form-item label="图片" required>
        <div class="upload-area">
          <img v-if="preview" :src="preview" class="preview" alt="预览" />
          <div class="upload-btns">
            <el-button @click="pick(false)">选择图片</el-button>
            <el-button class="mobile-only" @click="pick(true)">📷 拍照</el-button>
          </div>
        </div>
        <!-- 相册/文件选择；拍照入口带 capture，手机端直接调起相机 -->
        <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
        <input ref="cameraInput" type="file" accept="image/*" capture="environment" hidden @change="onFile" />
      </el-form-item>
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="给衣服取个名字" maxlength="100" />
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="form.category_id" clearable filterable allow-create
                   default-first-option placeholder="选择或输入新分类" style="width:100%">
          <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="位置">
        <el-select v-model="form.location_id" clearable filterable allow-create
                   default-first-option placeholder="选择或输入新位置，如衣柜" style="width:100%">
          <el-option v-for="l in locations" :key="l.id" :label="l.name" :value="l.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="季节">
        <el-checkbox-group v-model="form.seasons">
          <el-checkbox value="spring">春</el-checkbox>
          <el-checkbox value="summer">夏</el-checkbox>
          <el-checkbox value="autumn">秋</el-checkbox>
          <el-checkbox value="winter">冬</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../api'

const props = defineProps({
  modelValue: Boolean,
  clothes: Object,       // 编辑时传入
  categories: Array,
  locations: Array,
  adminUserId: Number,   // 管理员编辑用户衣服时传入目标用户 id
})
const emit = defineEmits(['update:modelValue', 'saved', 'category-created', 'location-created'])

const isEdit = computed(() => !!props.clothes?.id)
const loading = ref(false)
const fileInput = ref(null)
const cameraInput = ref(null)
const preview = ref('')
const file = ref(null)
const form = reactive({ name: '', category_id: null, location_id: null, seasons: [] })

watch(() => props.modelValue, (v) => {
  if (!v) return
  form.name = props.clothes?.name || ''
  form.category_id = props.clothes?.category_id ?? null
  form.location_id = props.clothes?.location_id ?? null
  form.seasons = [...(props.clothes?.seasons || [])]
  preview.value = props.clothes?.image_url || ''
  file.value = null
})

function pick(camera) {
  (camera ? cameraInput : fileInput).value.click()
}

function onFile(e) {
  const f = e.target.files[0]
  e.target.value = ''
  if (!f) return
  file.value = f
  preview.value = URL.createObjectURL(f)
}

async function save() {
  if (!form.name.trim()) return ElMessage.warning('请输入名称')
  if (!isEdit.value && !file.value) return ElMessage.warning('请上传图片')

  loading.value = true
  try {
    // 管理员模式下分类/位置要创建到目标用户名下
    const catUrl = props.adminUserId ? `/admin/users/${props.adminUserId}/categories` : '/categories'
    const locUrl = props.adminUserId ? `/admin/users/${props.adminUserId}/locations` : '/locations'

    // 分类是字符串说明是新输入的，先创建分类
    let categoryId = form.category_id
    if (typeof categoryId === 'string' && categoryId.trim()) {
      const res = await api.post(catUrl, { name: categoryId.trim() })
      categoryId = res.data.id
      emit('category-created')
    }
    // 位置同理
    let locationId = form.location_id
    if (typeof locationId === 'string' && locationId.trim()) {
      const res = await api.post(locUrl, { name: locationId.trim() })
      locationId = res.data.id
      emit('location-created')
    }

    const fd = new FormData()
    fd.append('name', form.name.trim())
    fd.append('category_id', categoryId ?? '')
    fd.append('location_id', locationId ?? '')
    fd.append('seasons', form.seasons.join(','))
    if (file.value) fd.append('image', file.value)

    if (props.adminUserId) {
      await api.put(`/admin/clothes/${props.clothes.id}`, fd)
    } else if (isEdit.value) {
      await api.put(`/clothes/${props.clothes.id}`, fd)
    } else {
      await api.post('/clothes', fd)
    }
    ElMessage.success('保存成功')
    emit('update:modelValue', false)
    emit('saved')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.upload-area { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.preview { width: 120px; max-height: 160px; object-fit: cover; border-radius: 8px; }
.upload-btns { display: flex; flex-direction: column; gap: 8px; }
.upload-btns .el-button { margin-left: 0; }
.mobile-only { display: none; }
@media (max-width: 640px) { .mobile-only { display: inline-flex; } }
</style>
