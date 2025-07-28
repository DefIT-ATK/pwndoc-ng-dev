<template>
  <div class="powerupsql-tab">
    <div class="text-h6">{{ $t('toolIntegration.powerupsql.title') }}</div>
    <div class="text-body2 q-mb-md">{{ $t('toolIntegration.powerupsql.description') }}</div>
  
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
          type="powerupsql"
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
        :import-button-label="$t('toolIntegration.powerupsql.import')"
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
        <div class="text-h6 q-mt-md">{{ $t('toolIntegration.powerupsql.parsingFiles') }}</div>
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
import { usePowerUpSQLParser } from '../composables/usePowerUpSQLParser'
import { useStandardParserTab } from '../composables/useStandardParserTab'

export default defineComponent({
  name: 'PowerUpSQLTab',
  
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
    
    const powerUpSQLParser = usePowerUpSQLParser()
    
    // Standard parser tab interface
    const standardInterface = useStandardParserTab('powerupsql', powerUpSQLParser)

    return {
      // Standard interface (includes file handling, registration, etc.)
      ...standardInterface,
      
      // Parser-specific state and methods (explicit to ensure availability)
      ...powerUpSQLParser,
      selectedFiles: powerUpSQLParser.powerUpSQLFiles, // Alias for SelectedFilesGrid
      
      // Quasar instance
      $q
    }
  }
})
</script>

<style scoped>
.powerupsql-tab {
  max-width: 100%;
}
</style>