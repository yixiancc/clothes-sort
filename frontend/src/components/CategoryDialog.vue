<template>
  <el-dialog :model-value="modelValue" title="分类管理" width="min(420px, 92vw)"
             @update:model-value="$emit('update:modelValue', $event)">
    <div style="display:flex; gap:8px; margin-bottom:12px">
      <el-input v-model="newName" placeholder="新分类名称" @keyup.enter="add" />
      <el-button type="primary" @click="add">添加</el-button>
    </div>
    <el-table :data="categories" size="small">
      <el-table-column prop="name" label="分类名" />
      <el-table-column width="140" align="right">
        <template #default="{ row }">
          <el-button size="small" @click="rename(row)">改名</el-button>
          <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!categories.length" description="暂无分类" :image-size="60" />
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'

const props = defineProps({ modelValue: Boolean, categories: Array })
const emit = defineEmits(['update:modelValue', 'changed'])
const newName = ref('')

async function add() {
  const name = newName.value.trim()
  if (!name) return
  try {
    await api.post('/categories', { name })
    newName.value = ''
    emit('changed')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function rename(row) {
  try {
    const { value } = await ElMessageBox.prompt('请输入新的分类名', '修改分类', {
      inputValue: row.name,
    })
    const name = (value || '').trim()
    if (!name || name === row.name) return
    await api.put(`/categories/${row.id}`, { name })
    emit('changed')
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('删除后该分类下的衣服将变为"未分类"，确认删除？', '提示', { type: 'warning' })
    await api.delete(`/categories/${row.id}`)
    emit('changed')
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
  }
}
</script>
