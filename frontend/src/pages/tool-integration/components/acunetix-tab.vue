<template>
  <div class="acunetix-tab">
    <div class="text-h6">{{ $t('toolIntegration.acunetix.title') }}</div>
    <div class="text-body2 q-mb-md">{{ $t('toolIntegration.acunetix.description') }}</div>
    
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
            type="acunetix"
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
          :total-vulnerabilities="totalOriginalFindings"
          :import-button-label="$t('toolIntegration.acunetix.import')"
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
          <div class="text-h6 q-mt-md">Parsing Acunetix files...</div>
          <div class="text-body2 text-grey-6">Please wait while we process your scan results</div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import FileUploadArea from './file-upload-area.vue'
import AuditSelection from './audit-selection.vue'
import VulnerabilityPreview from './vulnerability-preview.vue'
import DebugInfoPanel from './debug-info-panel.vue'
import { useAcunetixParser } from '../composables/useAcunetixParser'

export default defineComponent({
  name: 'AcunetixTab',

  components: {
    FileUploadArea,
    AuditSelection,
    VulnerabilityPreview,
    DebugInfoPanel
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

  setup() {
    const {
      // State
      parsedVulnerabilities,
      selectedVulnerabilities,
      debugInfo,
      parsing,
      importing,
      totalVulnerabilities,
      totalOriginalFindings,
      
      // File handling
      addFiles,
      removeFile,
      handleFileChange,
      handleFileRemove,
      
      // Upload area
      uploadAreaProps,
      
      // Actions
      importSelected,
      
      // Audit selection
      selectedAudit
    } = useAcunetixParser()

    return {
      // State
      parsedVulnerabilities,
      selectedVulnerabilities,
      debugInfo,
      parsing,
      importing,
      totalVulnerabilities,
      totalOriginalFindings,
      
      // File handling
      addFiles,
      removeFile,
      handleFileChange,
      handleFileRemove,
      
      // Upload area
      uploadAreaProps,
      
      // Actions
      importSelected,
      
      // Audit selection
      selectedAudit
    }
  }
})
</script>

<style scoped>
.acunetix-tab {
  max-width: 100%;
}
</style>
