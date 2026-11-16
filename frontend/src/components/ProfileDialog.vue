<template>
  <el-dialog :model-value="modelValue" title="个人资料" width="min(420px, 92vw)"
             @update:model-value="$emit('update:modelValue', $event)">
    <el-form :model="form" label-width="80px">
      <el-form-item label="用户名">
        <el-input v-model="form.username" />
      </el-form-item>
      <el-form-item label="昵称">
        <el-input v-model="form.nickname" />
      </el-form-item>
      <el-divider content-position="left">修改密码（不改请留空）</el-divider>
      <el-form-item label="原密码">
        <el-input v-model="form.old_password" type="password" show-password />
      </el-form-item>
      <el-form-item label="新密码">
        <el-input v-model="form.new_password" type="password" show-password />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])
const auth = useAuthStore()
const loading = ref(false)
const form = reactive({ username: '', nickname: '', old_password: '', new_password: '' })

watch(() => props.modelValue, (v) => {
  if (v) {
    form.username = auth.user?.username || ''
    form.nickname = auth.user?.nickname || ''
    form.old_password = ''
    form.new_password = ''
  }
})

async function save() {
  loading.value = true
  try {
    await auth.updateProfile({ ...form })
    ElMessage.success('保存成功')
    emit('update:modelValue', false)
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}
</script>
