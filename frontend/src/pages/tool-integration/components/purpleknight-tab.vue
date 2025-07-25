<template>
  <div class="purpleknight-tab">
    <div class="text-h6">{{ $t('toolIntegration.purpleknight.title') }}</div>
    <div class="text-body2 q-mb-md">{{ $t('toolIntegration.purpleknight.description') }}</div>
    
    <q-card flat bordered>
      <q-card-section>
        <div style="display: flex; flex-direction: row; width: 100%;" class="q-mb-md">
          <!-- File upload area -->
          <FileUploadArea
            v-bind="uploadAreaProps"
            @files-changed="handleFileChange"
            @file-removed="handleFileRemove"
          />
          
          <!-- Debug info panel -->
          <DebugInfoPanel
            :debug-info="debugInfo"
            type="purpleknight"
          />
        </div>

        <!-- Audit Selection -->
        <AuditSelection
          v-if="parsedVulnerabilities.length > 0"
          :audits="audits"
          :selected-audit="selectedAudit"
          :loading="loadingAudits"
          @update:selected-audit="selectedAudit = $event"
        />
        
        <!-- Preview Section -->
        <VulnerabilityPreview
          v-if="parsedVulnerabilities.length > 0"
          :vulnerabilities="parsedVulnerabilities"
          :selected="selectedVulnerabilities"
          :audits="audits"
          :selected-audit="selectedAudit"
          :importing="importing"
          :total-vulnerabilities="totalVulnerabilities"
          :import-button-label="$t('toolIntegration.purpleknight.import')"
          @update:selected="selectedVulnerabilities = $event"
          @import="importSelected"
        />
      </q-card-section>
    </q-card>

    <!-- Parsing Progress -->
    <div v-if="parsing" class="q-mt-md">
      <q-card>
        <q-card-section class="text-center">
          <q-spinner-hourglass size="40px" color="primary" />
          <div class="text-h6 q-mt-md">{{ $t('toolIntegration.purpleknight.parsingFiles') }}</div>
          <div class="text-body2 text-grey-6">{{ $t('toolIntegration.parsingSubtitle') }}</div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script>
import { defineComponent, inject } from 'vue'
import { useQuasar } from 'quasar'
import FileUploadArea from './file-upload-area.vue'
import DebugInfoPanel from './debug-info-panel.vue'
import VulnerabilityPreview from './vulnerability-preview.vue'
import AuditSelection from './audit-selection.vue'
import { usePurpleKnightParser } from '../composables/usePurpleKnightParser'

export default defineComponent({
  name: 'PurpleKnightTab',
  
  components: {
    FileUploadArea,
    DebugInfoPanel,
    VulnerabilityPreview,
    AuditSelection
  },

  props: {
    audits: {
      type: Array,
      required: true
    },
    loadingAudits: {
      type: Boolean,
      default: false
    }
  },

  setup(props) {
    const $q = useQuasar()
    const settings = inject('$settings')
    
    const {
      // State
      files,
      parsedVulnerabilities,
      selectedVulnerabilities,
      debugInfo,
      parsing,
      importing,
      totalVulnerabilities,
      totalOriginalFindings,
      selectedAudit,
      uploadAreaProps,
      
      // Methods
      parseAllFiles,
      handleFileChange,
      handleFileRemove,
      clearFiles,
      importSelected
    } = usePurpleKnightParser(settings)

    return {
      // State
      files,
      parsedVulnerabilities,
      selectedVulnerabilities,
      debugInfo,
      parsing,
      importing,
      totalVulnerabilities,
      totalOriginalFindings,
      selectedAudit,
      uploadAreaProps,
      
      // Methods
      parseAllFiles,
      handleFileChange,
      handleFileRemove,
      clearFiles,
      importSelected,
      
      // Settings
      settings
    }
  }
})
</script>

<style scoped>
.purpleknight-tab {
  /* Add any PurpleKnight-specific styling here */
}
</style>
