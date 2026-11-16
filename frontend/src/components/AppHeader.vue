<template>
  <header class="app-header">
    <span class="title">👗 <span class="title-text">衣服管理</span></span>
    <el-button text :type="isActive('/') " @click="$router.push('/')">衣柜</el-button>
    <el-button text :type="isActive('/outfits')" @click="$router.push('/outfits')">搭配</el-button>
    <el-button text :type="isActive('/calendar')" @click="$router.push('/calendar')">日历</el-button>
    <el-button text :type="isActive('/stats')" @click="$router.push('/stats')">统计</el-button>
    <el-button v-if="auth.isAdmin" text :type="isActive('/admin')" @click="$router.push('/admin')">
      管理后台
    </el-button>
    <div class="spacer" />
    <el-dropdown @command="onCommand">
      <span class="user-trigger">
        <span class="user-name">{{ auth.user?.nickname || auth.user?.username }}</span>
        <el-icon class="user-arrow"><arrow-down /></el-icon>
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="profile">个人资料</el-dropdown-item>
          <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <ProfileDialog v-model="showProfile" />
  </header>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'
import ProfileDialog from './ProfileDialog.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const showProfile = ref(false)

// 当前页对应的导航按钮高亮为主色，其余为默认灰
const isActive = (path) => (route.path === path ? 'primary' : '')

function onCommand(cmd) {
  if (cmd === 'profile') showProfile.value = true
  if (cmd === 'logout') {
    auth.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.el-dropdown {
  flex-shrink: 1;
  min-width: 0;
}
.user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  color: #606266;
  min-width: 0;
  max-width: 40vw;
}
.user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-arrow { flex: none; }
@media (max-width: 640px) {
  .user-trigger { max-width: 28vw; }
}
</style>
