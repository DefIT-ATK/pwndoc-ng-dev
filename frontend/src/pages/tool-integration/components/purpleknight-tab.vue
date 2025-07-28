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
import { defineComponent, inject, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import FileUploadArea from './file-upload-area.vue'
import DebugInfoPanel from './debug-info-panel.vue'
import VulnerabilityPreview from './vulnerability-preview.vue'
import AuditSelection from './audit-selection.vue'
import SelectedFilesGrid from './selected-files-grid.vue'
import { usePurpleKnightParser } from '../composables/usePurpleKnightParser'
import { useParserDispatcher } from '../composables/useParserDispatcher'

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

    // Get parser dispatcher for registration
    const { registerParserInstance, unregisterParserInstance } = useParserDispatcher()

    // Register this parser instance for file routing
    onMounted(() => {
      registerParserInstance('purpleknight', {
        handleFileChange  // This is the key - same method as normal file uploads
      })
    })

    // Unregister when component is unmounted
    onUnmounted(() => {
      unregisterParserInstance('purpleknight')
    })

    // Methods for SelectedFilesGrid component
    const handleClearAll = () => {
      if (window.confirm('Are you sure you want to remove all files? This action cannot be undone.')) {
        clearFiles()
      }
    }

    const handleRemoveFile = (fileToRemove) => {
      const index = files.value.findIndex(f => f.name === fileToRemove.name)
      if (index !== -1) {
        handleFileRemove(index)
      }
    }

    return {
      // State
      files,
      selectedFiles: files, // Alias for SelectedFilesGrid
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
      handleClearAll,
      handleRemoveFile,
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
