<template>
  <div style="flex: 1; min-width: 0;">
    <q-card flat bordered>
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="fa fa-info-circle" class="q-mr-sm" />
          Debug Info
        </div>
        <div v-if="debugInfo.length === 0" class="text-body2 text-grey-6">
          No debug information available
        </div>
        <div v-else>
          <div v-if="debugInfo[0] === 'No new vulnerabilities detected.' || debugInfo[0] === 'All risks matched the current map.'" class="q-mb-sm">
            <q-chip color="green" text-color="white" icon="fa fa-check-circle">
              {{ debugInfo[0] }}
            </q-chip>
          </div>
          <div v-else-if="debugInfo[0]?.startsWith('File analysis:')" class="q-mb-sm">
            <div class="text-subtitle2 q-mb-sm text-blue-8">
              <q-icon name="fa fa-file-alt" class="q-mr-xs" />
              {{ debugInfo[0] }}
            </div>
            <div class="debug-list">
              <div
                v-for="(info, idx) in debugInfo.slice(1)"
                :key="idx"
                class="text-body2"
                :class="{
                  'text-weight-medium q-mt-sm q-mb-xs': info.startsWith('📄'),
                  'text-grey-7 q-ml-md': !info.startsWith('📄') && !info.startsWith('⚠️'),
                  'text-orange-8 text-weight-medium q-mt-md q-mb-xs': info.startsWith('⚠️')
                }"
              >
                {{ info }}
              </div>
            </div>
          </div>
          <div v-else>
            <div class="text-subtitle2 q-mb-sm" :class="type === 'nessus' ? 'text-orange-8' : 'text-red-8'">
              <q-icon :name="type === 'nessus' ? 'fa fa-plus-circle' : 'fa fa-exclamation-triangle'" class="q-mr-xs" />
              {{ debugInfo[0] }}
            </div>
            <div class="debug-list">
              <div
                v-for="(info, idx) in debugInfo.slice(1)"
                :key="idx"
                class="text-body2"
                :class="{
                  'text-weight-medium q-mt-sm q-mb-xs': info.startsWith('📄'),
                  'text-grey-7 q-ml-md': !info.startsWith('📄') && !info.startsWith('⚠️'),
                  'text-orange-8 text-weight-medium q-mt-md q-mb-xs': info.startsWith('⚠️')
                }"
              >
                {{ info }}
              </div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'DebugInfoPanel',
  
  props: {
    debugInfo: {
      type: Array,
      required: true
    },
    type: {
      type: String,
      default: 'nessus',
      validator: (value) => ['nessus', 'pingcastle', 'purpleknight', 'acunetix', 'powerupsql', 'custom'].includes(value)
    }
  }
})
</script>

<style scoped>
.debug-list {
  background-color: #f8f9fa;
  border-radius: 4px;
  padding: 12px;
  border-left: 4px solid #dee2e6;
}

.debug-list .text-weight-medium {
  color: #495057;
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 4px;
}

.debug-list .text-grey-7 {
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
}
</style>
