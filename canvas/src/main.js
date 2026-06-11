/**
 * Main entry point | 主入口
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import './studio-gradient.css'
import '../../studio/studio-user-badge.css'
import '../../studio/studio-api-settings.css'
import '../../studio/studio-api-models-catalog.js'
import '../../studio/studio-api-settings.js'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
