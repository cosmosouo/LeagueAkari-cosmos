import en from '@shared/i18n/en/renderer/lan-mobile.yaml'
import zhCN from '@shared/i18n/zh-CN/renderer/lan-mobile.yaml'
import i18next from 'i18next'
import I18nextVue from 'i18next-vue'
import { createApp } from 'vue'

import App from './App.vue'
import './styles.css'

await i18next.init({
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
  resources: { en: { translation: en }, 'zh-CN': { translation: zhCN } }
})
createApp(App).use(I18nextVue, { i18next }).mount('#app')
