import { acefuAppConfig } from '@acefu-lab/app-kit/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(acefuAppConfig({ plugins: [vue()] }))
