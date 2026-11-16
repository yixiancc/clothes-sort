<template>
  <el-dialog :model-value="modelValue" title="位置管理" width="min(420px, 92vw)"
             @update:model-value="$emit('update:modelValue', $event)">
    <div style="display:flex; gap:8px; margin-bottom:12px">
      <el-input v-model="newName" placeholder="新位置名称，如：衣柜、行李箱" @keyup.enter="add" />
      <el-button type="primary" @click="add">添加</el-button>
    </div>
    <el-table :data="locations" size="small">
      <el-table-column prop="name" label="位置名" />
      <el-table-column width="140" align="right">
        <template #default="{ row }">
          <el-button size="small" @click="rename(row)">改名</el-button>
          <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!locations.length" description="暂无位置" :image-size="60" />
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'

const props = defineProps({ modelValue: Boolean, locations: Array })
const emit = defineEmits(['update:modelValue', 'changed'])
const newName = ref('')

async function add() {
  const name = newName.value.trim()
  if (!name) return
  try {
    await api.post('/locations', { name })
    newName.value = ''
    emit('changed')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function rename(row) {
  try {
    const { value } = await ElMessageBox.prompt('请输入新的位置名', '修改位置', {
      inputValue: row.name,
    })
    const name = (value || '').trim()
    if (!name || name === row.name) return
    await api.put(`/locations/${row.id}`, { name })
    emit('changed')
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('删除后该位置下的衣服将变为"未设置位置"，确认删除？', '提示', { type: 'warning' })
    await api.delete(`/locations/${row.id}`)
    emit('changed')
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
  }
}
</script>
