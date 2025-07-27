<template>
  <div class="pingcastle-tab">
    <div class="text-h6">{{ $t('toolIntegration.pingcastle.title') }}</div>
    <div class="text-body2 q-mb-md">{{ $t('toolIntegration.pingcastle.description') }}</div>
  
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
          type="pingcastle"
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
        :import-button-label="$t('toolIntegration.pingcastle.import')"
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
        <div class="text-h6 q-mt-md">{{ $t('toolIntegration.pingcastle.parsingFiles') }}</div>
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
import SelectedFilesGrid from './selected-files-grid.vue'
import { usePingCastleParser } from '../composables/usePingCastleParser'

export default defineComponent({
  name: 'PingCastleTab',
  
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
      pingCastleFiles,
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
      importVulnerabilities
    } = usePingCastleParser(settings)

    // Methods for SelectedFilesGrid component
    const handleClearAll = () => {
      if (window.confirm('Are you sure you want to remove all files? This action cannot be undone.')) {
        clearFiles()
      }
    }

    const handleRemoveFile = (fileToRemove) => {
      const index = pingCastleFiles.value.findIndex(f => f.name === fileToRemove.name)
      if (index !== -1) {
        handleFileRemove(index)
      }
    }

    return {
      $q,
      pingCastleFiles,
      selectedFiles: pingCastleFiles, // Alias for SelectedFilesGrid
      parsedVulnerabilities,
      selectedVulnerabilities,
      debugInfo,
      parsing,
      importing,
      totalVulnerabilities,
      selectedAudit,
      uploadAreaProps,
      parseAllFiles,
      handleFileChange,
      handleFileRemove,
      handleClearAll,
      handleRemoveFile,
      importVulnerabilities
    }
  }
})
</script>

<style scoped>
.pingcastle-tab {
  max-width: 100%;
}
</style>
