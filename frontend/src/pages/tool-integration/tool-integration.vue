<template>
  <q-page class="q-pa-md">
    <div class="row">
      <div class="col-12">
        <q-card>
          <q-card-section>
            <div class="text-h5">{{ $t('toolIntegration.title') }}</div>
            <div class="text-subtitle2 text-grey-7">{{ $t('toolIntegration.subtitle') }}</div>
          </q-card-section>
          
          <q-card-section>
            <q-tabs
              v-model="selectedTool"
              dense
              class="text-grey"
              active-color="primary"
              indicator-color="primary"
              align="justify"
              narrow-indicator
            >
              <q-tab name="nessus" :label="$t('toolIntegration.tools.nessus')" />
              <q-tab name="pingcastle" :label="$t('toolIntegration.tools.pingcastle')" />
              <q-tab name="custom" :label="$t('toolIntegration.tools.custom')" />
            </q-tabs>

            <q-separator />

            <q-tab-panels v-model="selectedTool" animated>
              <q-tab-panel name="nessus">
                <NessusTab 
                  :audits="auditOptions"
                  :loading-audits="loadingAudits"
                />
              </q-tab-panel>

              <q-tab-panel name="pingcastle">
                <PingCastleTab 
                  :audits="auditOptions"
                  :loading-audits="loadingAudits"
                />
              </q-tab-panel>

              <q-tab-panel name="custom">
                <CustomTab 
                  :audits="auditOptions"
                />
              </q-tab-panel>
            </q-tab-panels>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted, provide, getCurrentInstance } from 'vue'
import { Notify } from 'quasar'
import NessusTab from './components/nessus-tab.vue'
import PingCastleTab from './components/pingcastle-tab.vue'
import CustomTab from './components/custom-tab.vue'
import AuditService from '@/services/audit'

export default defineComponent({
  name: 'ToolIntegration',

  components: {
    NessusTab,
    PingCastleTab,
    CustomTab
  },

  setup() {
    const instance = getCurrentInstance()
    const selectedTool = ref('nessus')
    const auditOptions = ref([])
    const loadingAudits = ref(false)

    // Provide settings to child components
    provide('$settings', instance?.appContext.config.globalProperties.$settings)

    const loadAudits = async () => {
      loadingAudits.value = true
      try {
        const response = await AuditService.getAudits()
        auditOptions.value = response.data.datas.map(audit => ({
          label: `${audit.name} (${audit.client?.name || 'Unknown Client'})`,
          value: audit._id
        }))
      } catch (error) {
        console.error('Error loading audits:', error)
        Notify.create({
          message: 'Error loading audits',
          color: 'negative',
          position: 'top-right'
        })
      } finally {
        loadingAudits.value = false
      }
    }

    onMounted(async () => {
      // Always reload settings from backend when entering this page
      const settings = instance?.appContext.config.globalProperties.$settings
      if (settings && settings.refresh) {
        console.log('Refreshing settings')
        console.log(settings)
        await settings.refresh()
      }
      await loadAudits()
    })

    return {
      selectedTool,
      auditOptions,
      loadingAudits,
      loadAudits
    }
  }
})
</script>

<style scoped>
.q-page {
  background-color: #f5f5f5;
}
</style>