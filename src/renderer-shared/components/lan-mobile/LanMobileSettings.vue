<template>
  <div>
    <SettingsRow
      :label="t('lanMobile.settings.enableLabel')"
      :label-description="compact ? undefined : t('lanMobile.settings.description')"
      :label-width="400"
      :gap="compact ? 12 : 48"
      :no-x-padding="compact"
    >
      <NSwitch
        size="small"
        :value="store.settings.enabled"
        :loading="saving"
        @update:value="setEnabled"
      />
    </SettingsRow>
    <SettingsRow
      :label="t('lanMobile.settings.portLabel')"
      :label-description="compact ? undefined : t('lanMobile.settings.portDescription')"
      :label-width="400"
      :gap="compact ? 12 : 48"
      :no-x-padding="compact"
    >
      <NInputNumber
        size="small"
        class="w-36!"
        :value="store.settings.port"
        :min="1024"
        :max="65535"
        :precision="0"
        :update-value-on-input="false"
        :disabled="saving"
        @update:value="setPort"
      />
    </SettingsRow>
    <SettingsRow
      :label="t('lanMobile.settings.applyLabel')"
      :label-description="compact ? undefined : t('lanMobile.settings.applyDescription')"
      :label-width="400"
      :gap="compact ? 12 : 48"
      :no-x-padding="compact"
    >
      <NSwitch size="small" :value="store.settings.allowApply" @update:value="setAllowApply" />
    </SettingsRow>
    <SettingsRow
      :label="t('lanMobile.settings.addressLabel')"
      :label-description="t('lanMobile.settings.addressDescription')"
      :label-width="400"
      :gap="compact ? 12 : 48"
      control-full-line
      :no-x-padding="compact"
    >
      <div class="flex w-full min-w-0 flex-col gap-2">
        <div
          v-if="store.state.error"
          class="text-xs text-orange-600 dark:text-orange-300"
          role="status"
        >
          {{ t(`lanMobile.serviceErrors.${store.state.error}`) }}
        </div>
        <div v-if="!store.state.running" class="text-xs text-black/50 dark:text-white/50">
          {{ t('lanMobile.settings.stopped') }}
        </div>
        <template v-else>
          <div
            v-for="address in store.state.addresses"
            :key="address"
            class="flex flex-wrap items-center gap-2"
          >
            <span class="mr-auto font-mono text-xs">{{ addressOrigin(address) }}</span>
            <NButton size="tiny" secondary @click="copyAddress(address)">{{
              t('lanMobile.settings.copy')
            }}</NButton>
            <NPopover trigger="click" placement="top" :show-arrow="false">
              <template #trigger
                ><NButton size="tiny" secondary>{{
                  t('lanMobile.settings.qrCode')
                }}</NButton></template
              >
              <div class="flex flex-col items-center gap-2">
                <NQrCode :value="address" :size="180" :padding="16" /><span class="text-xs">{{
                  t('lanMobile.settings.scan')
                }}</span>
              </div>
            </NPopover>
          </div>
          <div v-if="loopbackOnly" class="text-xs text-orange-600 dark:text-orange-300">
            {{ t('lanMobile.settings.loopbackOnly') }}
          </div>
          <span class="text-xs text-black/50 dark:text-white/50">{{
            t(store.state.desktopAvailable ? 'lanMobile.clients' : 'lanMobile.settings.waiting', {
              count: store.state.clientCount
            })
          }}</span>
        </template>
        <NButton
          v-if="store.settings.enabled"
          size="tiny"
          secondary
          class="self-start"
          @click="restart"
          >{{ t('lanMobile.settings.restart') }}</NButton
        >
      </div>
    </SettingsRow>
  </div>
</template>

<script setup lang="ts">
import SettingsRow from '@renderer-shared/components/SettingsRow.vue'
import { useInstance } from '@renderer-shared/shards'
import { LanMobileRenderer } from '@renderer-shared/shards/lan-mobile'
import { useLanMobileStore } from '@renderer-shared/shards/lan-mobile/store'
import { useClipboard } from '@vueuse/core'
import { useTranslation } from 'i18next-vue'
import { NButton, NInputNumber, NPopover, NQrCode, NSwitch, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'

const { compact = false } = defineProps<{ compact?: boolean }>()
const { t } = useTranslation()
const store = useLanMobileStore()
const lanMobile = useInstance(LanMobileRenderer)
const message = useMessage()
const saving = ref(false)
const clipboard = useClipboard({ legacy: true })
const addressOrigin = (address: string) => new URL(address).origin
const loopbackOnly = computed(() =>
  store.state.addresses.every((address) => new URL(address).hostname === '127.0.0.1')
)
const save = async (operation: () => Promise<unknown>) => {
  saving.value = true
  try {
    await operation()
  } catch {
    message.error(t('lanMobile.settings.saveFailed'))
  } finally {
    saving.value = false
  }
}
const setEnabled = (enabled: boolean) => save(() => lanMobile.setEnabled(enabled))
const setPort = (port: number | null) => {
  if (port !== null) void save(() => lanMobile.setPort(port))
}
const setAllowApply = (allowed: boolean) => save(() => lanMobile.setAllowApply(allowed))
const restart = () => save(() => lanMobile.restart())
const copyAddress = async (address: string) => {
  try {
    await clipboard.copy(address)
    message.success(t('lanMobile.settings.copied'))
  } catch {
    message.error(t('lanMobile.settings.copyFailed'))
  }
}
</script>
