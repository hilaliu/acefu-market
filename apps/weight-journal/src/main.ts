import { startApp } from '@acefu-lab/app-kit'
import { createApp } from 'vue'
import App from './App.vue'
import '@acefu-lab/app-kit/theme.css'
import '@acefu-lab/ui/components.css'
import './style.css'

void startApp(({ api, info }) => {
  createApp(App, { api, info }).mount('#app')
})
