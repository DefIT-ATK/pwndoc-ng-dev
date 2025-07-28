<template>
  <div class="nessus-tab">
    <div class="text-h6">{{ $t('toolIntegration.nessus.title') }}</div>
    <div class="text-body2 q-mb-md">{{ $t('toolIntegration.nessus.description') }}</div>
  
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
          type="nessus"
        />
      </div>

      <!-- Selected Files Grid -->
      <SelectedFilesGrid
        :files="selectedFiles"
        @clear-all="handleClearAll"
        @remove-file="handleRemoveFile"
        class="q-mb-md"
      />

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
        :import-button-label="$t('toolIntegration.nessus.import')"
        @update:selected="selectedVulnerabilities = $event"
        @import="importVulnerabilities($q, audits)"
      />
    </q-card-section>
  </q-card>

  <!-- Parsing Progress -->
  <div v-if="parsing" class="q-mt-md">
    <q-card>
      <q-card-section class="text-center">
        <q-spinner-hourglass size="40px" color="primary" />
        <div class="text-h6 q-mt-md">{{ $t('toolIntegration.nessus.parsingFiles') }}</div>
        <div class="text-body2 text-grey-6">{{ $t('toolIntegration.parsingSubtitle') }}</div>
      </q-card-section>
    </q-card>
  </div>
  </div>
</template>

<script>
import { defineComponent, inject, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import FileUploadArea from './file-upload-area.vue'
import DebugInfoPanel from './debug-info-panel.vue'
import VulnerabilityPreview from './vulnerability-preview.vue'
import AuditSelection from './audit-selection.vue'
import SelectedFilesGrid from './selected-files-grid.vue'
import { useNessusParser } from '../composables/useNessusParser'
import { useStandardParserTab, useStandardFileGrid } from '../composables/useStandardParserTab'

export default defineComponent({
  name: 'NessusTab',
  
  components: {
    FileUploadArea,
    DebugInfoPanel,
    VulnerabilityPreview,
    AuditSelection,
    SelectedFilesGrid
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
    const $q = useQuasar()
    const settings = inject('$settings')
    
    const {
      // State
      nessusFiles,
      parsedVulnerabilities,
      selectedVulnerabilities,
      debugInfo,
      parsing,
      importing,
      totalVulnerabilities,
      selectedAudit,
      uploadAreaProps,
      
      // Methods
      parseAllFiles,
      handleFileChange,
      handleFileRemove,
      clearFiles,
      importVulnerabilities,
      addFiles  // Expose addFiles method for routing
    } = useNessusParser()

    // Use standard parser tab interface (handles registration automatically)
    const standardParser = useStandardParserTab('nessus', null, {
      handleFileChange,
      addFiles
    })

    // Standard file grid handlers
    const { handleClearAll, handleRemoveFile } = useStandardFileGrid(
      nessusFiles,
      handleFileRemove,
      clearFiles
    )

    return {
      $q,
      // File state
      nessusFiles,
      selectedFiles: nessusFiles, // Alias for SelectedFilesGrid
      
      // Parser state
      parsedVulnerabilities,
      selectedVulnerabilities,
      debugInfo,
      parsing,
      importing,
      totalVulnerabilities,
      selectedAudit,
      uploadAreaProps,
      
      // Standard interface (includes handleFileChange, registration, etc.)
      ...standardParser,
      
      // File grid handlers (now standardized)
      handleClearAll,
      handleRemoveFile,
      
      // Parser-specific methods
      parseAllFiles,
      importVulnerabilities
    }
  }
})
</script>

<style scoped>
.nessus-tab {
  max-width: 100%;
}
</style>