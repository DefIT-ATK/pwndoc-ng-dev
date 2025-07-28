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

        <!-- Selected Files Grid -->
        <SelectedFilesGrid
          :files="selectedFiles || []"
          @clear-all="handleClearAll"
          @remove-file="handleRemoveFile"
          class="q-mb-md"
        />

        <!-- Audit Selection -->
        <AuditSelection
          v-if="parsedVulnerabilities && parsedVulnerabilities.length > 0"
          :audits="audits"
          :selected-audit="selectedAudit"
          :loading="loadingAudits"
          @update:selected-audit="selectedAudit = $event"
        />
        
        <!-- Preview Section -->
        <VulnerabilityPreview
          v-if="parsedVulnerabilities && parsedVulnerabilities.length > 0"
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
import SelectedFilesGrid from './selected-files-grid.vue'
import { usePurpleKnightParser } from '../composables/usePurpleKnightParser'
import { useStandardParserTab, useStandardFileGrid } from '../composables/useStandardParserTab'

export default defineComponent({
  name: 'PurpleKnightTab',
  
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

  setup(props) {
    const $q = useQuasar()
    const settings = inject('$settings')
    
    const {
      purpleKnightFiles,
      parsedVulnerabilities,
      selectedVulnerabilities,
      debugInfo,
      parsing,
      importing,
      totalVulnerabilities,
      selectedAudit,
      parseAllFiles,
      handleFileChange,
      handleFileRemove,
      clearFiles,
      importVulnerabilities,
      addFiles  // Expose addFiles method for routing
    } = usePurpleKnightParser(settings)
    
    // Standard parser tab interface
    const standardInterface = useStandardParserTab('purpleknight', parseAllFiles, {
      handleFileChange,  // Pass the original handleFileChange for registration
      addFiles
    })

    // File management methods - use parser's own methods
    const handleClearAll = () => {
      if (window.confirm('Are you sure you want to remove all files? This will also clear all parsed vulnerabilities.')) {
        clearFiles()  // Use the parser's clearFiles method
      }
    }

    const handleRemoveFile = (fileToRemove) => {
      const index = purpleKnightFiles.value.findIndex(f => f.name === fileToRemove.name)
      if (index !== -1) {
        handleFileRemove(index)  // Use the parser's handleFileRemove method
      }
    }

    return {
      // File state
      purpleKnightFiles,
      selectedFiles: purpleKnightFiles, // Alias for SelectedFilesGrid
      
      // Parser-specific state and methods (explicit to ensure availability)
      parsedVulnerabilities,
      selectedVulnerabilities,
      debugInfo,
      parsing,
      importing,
      totalVulnerabilities,
      selectedAudit,
      
      // Methods - use original parser methods, not standard interface
      parseAllFiles,
      handleFileChange,
      handleFileRemove,
      handleClearAll,
      handleRemoveFile,
      importVulnerabilities,
      
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
