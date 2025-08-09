import { createApp } from 'vue'
import App from './App.vue'
import { createRouter, createWebHistory } from 'vue-router'

// Test view import
import PreRunTestView from './PreRunTestView.vue'

const routes = [
  {
    path: '/test-pre-run',
    name: 'TestPreRun',
    component: PreRunTestView
  },
  {
    path: '/',
    redirect: '/test-pre-run'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')
