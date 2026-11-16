<template>
  <div class="login-page">
    <div class="bubble b1">🌸</div>
    <div class="bubble b2">☁️</div>
    <div class="bubble b3">💖</div>
    <div class="bubble b4">🎀</div>
    <el-card class="login-card">
      <h2 class="login-title">👗 我的衣橱</h2>
      <p class="login-sub">把每一件衣服都收好呀 ~</p>
      <el-tabs v-model="mode" stretch @tab-change="onTabChange">
        <el-tab-pane label="登录" name="login" />
        <el-tab-pane label="注册" name="register" />
      </el-tabs>
      <el-form :model="form" label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="登录用户名" />
        </el-form-item>
        <el-form-item v-if="mode === 'register'" label="昵称（可选）">
          <el-input v-model="form.nickname" placeholder="显示名字，默认同用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password
                    placeholder="至少6位" @keyup.enter="submit" />
        </el-form-item>
        <el-form-item v-if="mode === 'login'" class="remember-item">
          <el-checkbox v-model="remember">记住账号密码</el-checkbox>
        </el-form-item>
        <el-form-item v-if="mode === 'register'" label="验证码">
          <div class="captcha-row">
            <el-input v-model="form.captcha_code" placeholder="4位数字" maxlength="4"
                      @keyup.enter="submit" />
            <img v-if="captchaImage" :src="captchaImage" class="captcha-img"
                 title="点击刷新" alt="验证码" @click="loadCaptcha" />
          </div>
        </el-form-item>
        <el-button type="primary" style="width:100%" :loading="loading" @click="submit">
          {{ mode === 'login' ? '登 录' : '注 册' }}
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '../api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const mode = ref('login')
const loading = ref(false)
const form = reactive({ username: '', password: '', nickname: '', captcha_code: '' })
const captchaId = ref('')
const captchaImage = ref('')
const remember = ref(false)

// ---------- 记住账号密码（localStorage 轻量混淆存储，与小程序端 key 保持一致） ----------
const REMEMBER_KEY = 'remember_account'
const XOR_KEY = 'clothes-sort-mp'

function xor(str) {
  let out = ''
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length))
  }
  return out
}
function saveRemembered(username, password) {
  localStorage.setItem(REMEMBER_KEY, JSON.stringify({
    username,
    password: btoa(xor(password))
  }))
}
function loadRemembered() {
  try {
    const raw = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null')
    if (!raw || !raw.username) return null
    return { username: raw.username, password: xor(atob(raw.password || '')) }
  } catch (e) {
    return null
  }
}
function clearRemembered() {
  localStorage.removeItem(REMEMBER_KEY)
}

const remembered = loadRemembered()
if (remembered) {
  form.username = remembered.username
  form.password = remembered.password
  remember.value = true
}

async function loadCaptcha() {
  try {
    const res = await api.get('/auth/captcha')
    captchaId.value = res.data.captcha_id
    captchaImage.value = res.data.image
    form.captcha_code = ''
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function onTabChange(name) {
  if (name === 'register') loadCaptcha()
}

async function submit() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    if (mode.value === 'login') {
      await auth.login(form.username, form.password)
      if (remember.value) {
        saveRemembered(form.username, form.password)
      } else {
        clearRemembered()
      }
      ElMessage.success('登录成功')
      router.push('/')
    } else {
      if (!form.captcha_code) {
        ElMessage.warning('请输入验证码')
        loading.value = false
        return
      }
      await auth.register(form.username, form.password, form.nickname,
                          captchaId.value, form.captcha_code)
      ElMessage.success('注册成功，请等待管理员审核通过后再登录')
      form.password = ''
      mode.value = 'login'
    }
  } catch (e) {
    ElMessage.error(e.message)
    if (mode.value === 'register') loadCaptcha()  // 验证码一次性，失败后刷新
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #ddd6fe 0%, #ede9fe 50%, #e0e7ff 100%);
}
.login-card {
  width: 100%;
  max-width: 400px;
  border-radius: 24px;
  box-shadow: 0 16px 44px rgba(124, 58, 237, .28);
  animation: popIn .5s ease both;
}
.login-title {
  text-align: center;
  margin: 0;
  background: linear-gradient(90deg, #8b5cf6, #7c3aed);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.login-sub {
  text-align: center;
  color: #a89bc8;
  font-size: 13px;
  margin: 4px 0 12px;
}
.remember-item {
  margin-top: -10px;
  margin-bottom: 12px;
}
.captcha-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.captcha-img {
  height: 40px;
  border-radius: 10px;
  cursor: pointer;
  flex: none;
  box-shadow: 0 2px 8px rgba(124, 58, 237, .25);
}
.bubble {
  position: absolute;
  font-size: 42px;
  opacity: .8;
  animation: floaty 4s ease-in-out infinite;
  user-select: none;
}
.b1 { top: 12%; left: 10%; animation-delay: 0s; }
.b2 { top: 20%; right: 12%; animation-delay: 1s; font-size: 56px; }
.b3 { bottom: 18%; left: 16%; animation-delay: 2s; }
.b4 { bottom: 12%; right: 18%; animation-delay: 1.5s; }
@keyframes floaty {
  0%, 100% { transform: translateY(0) rotate(-4deg); }
  50%      { transform: translateY(-16px) rotate(4deg); }
}
@keyframes popIn {
  0%   { opacity: 0; transform: scale(.92) translateY(16px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
