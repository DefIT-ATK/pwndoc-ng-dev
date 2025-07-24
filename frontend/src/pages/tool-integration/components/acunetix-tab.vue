<template>
  <div class="acunetix-tab">
    <div class="text-h6">{{ $t('toolIntegration.acunetix.title') }}</div>
    <div class="text-body2 q-mb-md">{{ $t('toolIntegration.acunetix.description') }}</div>
    
    <!-- Integration Method Selection -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">Import Method</div>
        <q-tabs
          v-model="activeTab"
          dense
          class="text-grey"
          active-color="primary"
          indicator-color="primary"
        >
          <q-tab name="file" label="File Upload" />
          <q-tab name="api" label="API Integration" />
        </q-tabs>
      </q-card-section>
    </q-card>
    
    <q-tab-panels v-model="activeTab" animated>
      <!-- File Upload Tab -->
      <q-tab-panel name="file" class="q-pa-none">
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
              @update:selected-audit="selectedAuditFile = $event"
            />
            
            <!-- Preview Section -->
            <VulnerabilityPreview
              v-if="parsedVulnerabilities.length > 0"
              :vulnerabilities="parsedVulnerabilities"
              :selected="selectedVulnerabilities"
              :audits="audits"
              :selected-audit="selectedAuditFile"
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
              <div class="text-h6 q-mt-md">{{ $t('toolIntegration.acunetix.parsingFiles') }}</div>
              <div class="text-body2 text-grey-6">{{ $t('toolIntegration.parsingSubtitle') }}</div>
            </q-card-section>
          </q-card>
        </div>
      </q-tab-panel>

      <!-- API Integration Tab -->
      <q-tab-panel name="api" class="q-pa-none">
        <q-card flat bordered>
          <q-card-section>
            <!-- Connection Status -->
            <div class="row q-mb-md">
              <div class="col-12">
                <q-banner
                  :class="connected ? 'bg-positive text-white' : 'bg-grey-3'"
                  rounded
                >
                  <template v-slot:avatar>
                    <q-icon 
                      :name="connected ? 'check_circle' : 'radio_button_unchecked'" 
                      :color="connected ? 'white' : 'grey'" 
                    />
                  </template>
                  
                  <div class="text-subtitle1">
                    {{ connected ? 'Connected to Acunetix' : 'Not connected to Acunetix' }}
                  </div>
                  
                  <template v-slot:action>
                    <q-btn
                      v-if="!connected"
                      :loading="connecting"
                      color="primary"
                      label="Connect"
                      @click="connect"
                      flat
                    />
                    <q-btn
                      v-else
                      color="white"
                      text-color="positive"
                      label="Disconnect"
                      @click="disconnect"
                      flat
                    />
                  </template>
                </q-banner>
              </div>
            </div>

                        <!-- Target Group Selection -->
            <div v-if="connected" class="q-mb-md">
              <div class="text-subtitle1 q-mb-md">Select Target Groups</div>
              
              <div class="row q-gutter-md">
                <div class="col-12 col-md-8">
                  <q-select
                    v-model="selectedTargetGroups"
                    :options="targetGroups"
                    :loading="loadingTargetGroups"
                    label="Target Groups"
                    outlined
                    multiple
                    use-chips
                    map-options
                    emit-value
                    clearable
                    @update:model-value="onTargetGroupsChange"
                  >
                    <template v-slot:option="scope">
                      <q-item v-bind="scope.itemProps">
                        <q-item-section>
                          <q-item-label>{{ scope.opt.label }}</q-item-label>
                          <q-item-label caption v-if="scope.opt.description">
                            {{ scope.opt.description }}
                          </q-item-label>
                        </q-item-section>
                        <q-item-section side>
                          <q-checkbox v-model="scope.selected" />
                        </q-item-section>
                      </q-item>
                    </template>
                    <template v-slot:no-option>
                      <q-item>
                        <q-item-section class="text-grey">
                          No target groups found
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-select>
                </div>
                <div class="col-12 col-md-3">
                  <q-btn
                    color="primary"
                    label="Refresh Groups"
                    :loading="loadingTargetGroups"
                    @click="loadTargetGroups"
                    outlined
                  />
                </div>
              </div>
            </div>

            <!-- Export Controls -->
            <div v-if="connected && selectedTargetGroups && selectedTargetGroups.length > 0" class="q-mb-md">
              <div class="text-subtitle1 q-mb-md">Export Vulnerabilities</div>
              
              <div class="row q-gutter-md q-mb-md">
                <div class="col-auto">
                  <q-btn
                    color="primary"
                    :label="`Export ${selectedTargetGroups.length} Target Group${selectedTargetGroups.length > 1 ? 's' : ''}`"
                    :loading="exporting"
                    :disable="!selectedTargetGroups || selectedTargetGroups.length === 0"
                    @click="exportSelectedGroups"
                    icon="download"
                  />
                </div>
              </div>

              <!-- Export Progress -->
              <div v-if="exporting || exportProgress">
                <q-linear-progress 
                  :indeterminate="exporting"
                  color="primary"
                  class="q-mb-sm"
                />
                <div class="text-body2 text-grey-6">{{ exportProgress }}</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script>
import { defineComponent, ref } from 'vue'
import FileUploadArea from './file-upload-area.vue'
import AuditSelection from './audit-selection.vue'
import VulnerabilityPreview from './vulnerability-preview.vue'
import DebugInfoPanel from './debug-info-panel.vue'
import { useAcunetixParser } from '../composables/useAcunetixParser'
import { useAcunetixApi } from '../composables/useAcunetixApi'

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
    // Active tab for switching between file upload and API integration
    const activeTab = ref('file')
    
    // File Upload Parser (existing functionality)
    const fileParser = useAcunetixParser()
    
    // API Integration (new functionality)
    const apiIntegration = useAcunetixApi()
    
    // Separate audit selections for each method
    const selectedAuditFile = ref(null)
    
    // API-specific state (simplified)
    const selectedTargetGroups = ref([])

    // Handle target groups change
    const onTargetGroupsChange = (newValues) => {
      console.log('Target groups changed to:', newValues)
      selectedTargetGroups.value = newValues || []
    }
    
    // Export selected target groups and simulate file uploads
    const exportSelectedGroups = async () => {
      if (!selectedTargetGroups.value || selectedTargetGroups.value.length === 0) {
        Notify.create({
          message: 'Please select at least one target group',
          color: 'warning',
          position: 'top-right'
        })
        return
      }

      try {
        apiIntegration.exporting.value = true
        const exportedFiles = []
        const totalGroups = selectedTargetGroups.value.length
        
        // Clear any existing files in the file parser first
        fileParser.clearFiles()
        
        // Export each target group
        for (let i = 0; i < selectedTargetGroups.value.length; i++) {
          const targetGroupId = selectedTargetGroups.value[i]
          const targetGroup = apiIntegration.targetGroups.value.find(tg => tg.value === targetGroupId)
          const groupName = targetGroup ? targetGroup.label : `group_${i + 1}`
          
          console.log(`Exporting target group ${i + 1}/${totalGroups}: ${groupName}`)
          
          // Update progress
          apiIntegration.exportProgress.value = Math.round(((i + 1) / totalGroups) * 100)
          
          try {
            // Export the target group
            const reportData = await apiIntegration.exportVulnerabilities(targetGroupId)
            
            if (reportData) {
              // Create a proper File object from the exported data
              const jsonString = JSON.stringify(reportData, null, 2)
              const blob = new Blob([jsonString], { type: 'application/json' })
              const fileName = `acunetix_${groupName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.json`
              const file = new File([blob], fileName, {
                type: 'application/json'
              })
              
              exportedFiles.push(file)
            }
          } catch (error) {
            console.error(`Error exporting target group ${groupName}:`, error)
            Notify.create({
              message: `Failed to export ${groupName}: ${error.message}`,
              color: 'negative',
              position: 'top-right'
            })
          }
        }
        
        if (exportedFiles.length > 0) {
          // Switch to file upload tab first
          activeTab.value = 'file'
          
          // Wait a bit for the tab to switch
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Simulate file uploads by adding all files at once to trigger parsing
          console.log('Simulating file uploads with', exportedFiles.length, 'files')
          await fileParser.handleFileChange(exportedFiles)
          
          Notify.create({
            message: `Successfully exported ${exportedFiles.length} target group(s) and switched to file upload`,
            color: 'positive',
            position: 'top-right'
          })
          
          // Clear API state
          selectedTargetGroups.value = []
          apiIntegration.exportedData.value = null
        } else {
          Notify.create({
            message: 'No data was exported from the selected target groups',
            color: 'warning',
            position: 'top-right'
          })
        }
        
      } catch (error) {
        console.error('Export failed:', error)
        Notify.create({
          message: `Export failed: ${error.message}`,
          color: 'negative',
          position: 'top-right'
        })
      } finally {
        apiIntegration.exporting.value = false
        apiIntegration.exportProgress.value = 0
      }
    }

    // Auto-connect on mount
    apiIntegration.connect()

    return {
      // Tab state
      activeTab,
      
      // File parser (existing)
      ...fileParser,
      selectedAuditFile,
      
      // API integration (simplified)
      ...apiIntegration,
      selectedTargetGroups,
      onTargetGroupsChange,
      exportSelectedGroups
    }
  }
})
</script>

<style scoped>
.acunetix-tab {
  max-width: 100%;
}

.q-tab-panel {
  padding: 0 !important;
}
</style>
