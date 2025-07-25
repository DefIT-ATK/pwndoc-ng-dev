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
            <!-- Target Group Selection -->
            <div v-if="connected" class="q-mb-md">
              <div class="row items-center q-mb-md">
                <div class="col">
                  <div class="text-subtitle1">Select Target Groups</div>
                  <div class="text-body2 text-grey-6">
                    Choose one or more target groups to export vulnerabilities from
                  </div>
                </div>
                <div class="col-auto">
                  <q-btn
                    color="primary"
                    label="Refresh Groups"
                    :loading="loadingTargetGroups"
                    @click="loadTargetGroups"
                    outlined
                    icon="refresh"
                  />
                </div>
              </div>

              <!-- Target Groups Grid -->
              <div v-if="targetGroups.length > 0" class="row q-gutter-sm">
                <div 
                  v-for="group in targetGroups" 
                  :key="group.value"
                  class="col-12 col-sm-6 col-md-4 col-lg-3 col-xl-3"
                  style="min-width: 280px; max-width: 320px;"
                >
                  <q-card 
                    flat 
                    bordered
                    class="target-group-card cursor-pointer"
                    :class="{ 'selected': selectedTargetGroups.includes(group.value) }"
                    @click="toggleTargetGroup(group.value)"
                  >
                    <q-card-section class="q-pa-md">
                      <div class="row items-start no-wrap">
                        <div class="col">
                          <div class="text-subtitle1 text-weight-medium q-mb-xs">
                            {{ group.name || 'Unnamed Group' }}
                          </div>
                          <div v-if="group.description" class="text-body2 text-grey-6 q-mb-sm">
                            {{ group.description }}
                          </div>
                          <div class="q-mb-sm">
                            <div class="row items-center q-gutter-sm text-caption text-grey-7 q-mb-xs">
                              <div class="row items-center no-wrap">
                                <q-icon name="language" size="14px" class="q-mr-xs" />
                                <span>{{ group.targetCount || 0 }} targets</span>
                              </div>
                            </div>
                            <div v-if="group.vulnCount" class="row items-center q-gutter-xs text-caption">
                              <q-icon name="bug_report" size="14px" class="q-mr-xs text-grey-7" />
                              <q-chip 
                                v-if="group.vulnCount.critical > 0"
                                size="sm" 
                                color="red" 
                                text-color="white" 
                                :label="`${group.vulnCount.critical} Critical`"
                                dense
                              />
                              <q-chip 
                                v-if="group.vulnCount.high > 0"
                                size="sm" 
                                color="orange" 
                                text-color="white" 
                                :label="`${group.vulnCount.high} High`"
                                dense
                              />
                              <q-chip 
                                v-if="group.vulnCount.medium > 0"
                                size="sm" 
                                color="yellow-8" 
                                text-color="white" 
                                :label="`${group.vulnCount.medium} Medium`"
                                dense
                              />
                              <q-chip 
                                v-if="group.vulnCount.low > 0"
                                size="sm" 
                                color="green" 
                                text-color="white" 
                                :label="`${group.vulnCount.low} Low`"
                                dense
                              />
                              <q-chip 
                                v-if="group.vulnCount.info > 0"
                                size="sm" 
                                color="blue" 
                                text-color="white" 
                                :label="`${group.vulnCount.info} Info`"
                                dense
                              />
                              <span v-if="getTotalVulnCount(group) === 0" class="text-grey-6">
                                No vulnerabilities
                              </span>
                            </div>
                          </div>
                        </div>
                        <div class="col-auto">
                          <q-checkbox 
                            :model-value="selectedTargetGroups.includes(group.value)"
                            @update:model-value="toggleTargetGroup(group.value)"
                            color="primary"
                            @click.stop
                          />
                        </div>
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else-if="!loadingTargetGroups" class="text-center q-pa-lg">
                <q-icon name="folder_open" size="48px" color="grey-5" />
                <div class="text-h6 text-grey-6 q-mt-md">No Target Groups Found</div>
                <div class="text-body2 text-grey-6">
                  No target groups are available in your Acunetix instance.
                </div>
              </div>

              <!-- Loading State -->
              <div v-else class="text-center q-pa-lg">
                <q-spinner-hourglass size="40px" color="primary" />
                <div class="text-body2 text-grey-6 q-mt-md">Loading target groups...</div>
              </div>

              <!-- Selection Summary -->
              <div v-if="selectedTargetGroups.length > 0" class="q-mt-md">
                <q-banner rounded class="bg-blue-1 text-blue-8">
                  <template v-slot:avatar>
                    <q-icon name="info" color="blue" />
                  </template>
                  <div class="text-weight-medium">
                    {{ selectedTargetGroups.length }} target group{{ selectedTargetGroups.length > 1 ? 's' : '' }} selected
                  </div>
                  <div class="text-body2 q-mt-xs">
                    <span v-for="(groupId, index) in selectedTargetGroups" :key="groupId">
                      {{ getTargetGroupName(groupId) }}{{ index < selectedTargetGroups.length - 1 ? ', ' : '' }}
                    </span>
                  </div>
                </q-banner>
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
              <div v-if="exporting || exportProgress > 0" class="q-mt-md">
                <q-card flat bordered>
                  <q-card-section>
                    <div class="row items-center q-mb-sm">
                      <div class="col">
                        <div class="text-subtitle2">Export Progress</div>
                      </div>
                      <div class="col-auto">
                        <q-chip 
                          v-if="exportProgressDetails"
                          :color="exportProgressDetails.phase === 'completed' ? 'positive' : exportProgressDetails.phase === 'error' ? 'negative' : 'primary'"
                          text-color="white"
                          size="sm"
                        >
                          {{ exportProgressDetails.phase.replace('_', ' ').toUpperCase() }}
                        </q-chip>
                      </div>
                    </div>
                    
                    <q-linear-progress 
                      :value="exportProgress / 100"
                      :indeterminate="exportProgress === 0 && exporting"
                      color="primary"
                      class="q-mb-sm"
                      size="8px"
                    />
                    
                    <div class="text-body2 text-primary">
                      {{ exportProgressMessage || 'Processing...' }}
                    </div>
                    
                    <div v-if="exportProgressDetails && exportProgressDetails.batchInfo" class="text-caption text-grey-6 q-mt-xs">
                      <div v-if="exportProgressDetails.batchInfo.totalVulns">
                        Total vulnerabilities: {{ exportProgressDetails.batchInfo.totalVulns }}
                      </div>
                      <div v-if="exportProgressDetails.batchInfo.totalBatches">
                        Batches: {{ exportProgressDetails.batchInfo.totalBatches }} ({{ exportProgress }}% complete)
                      </div>
                      <div v-if="exportProgressDetails.batchInfo.currentBatch">
                        Current batch: {{ exportProgressDetails.batchInfo.currentBatch }}/{{ exportProgressDetails.total }} 
                        ({{ exportProgressDetails.batchInfo.batchVulns }} vulnerabilities)
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
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
import { Notify } from 'quasar'
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

    // Toggle target group selection
    const toggleTargetGroup = (groupId) => {
      const index = selectedTargetGroups.value.indexOf(groupId)
      if (index > -1) {
        selectedTargetGroups.value.splice(index, 1)
      } else {
        selectedTargetGroups.value.push(groupId)
      }
      console.log('Target groups updated:', selectedTargetGroups.value)
    }

    // Get target group name by ID
    const getTargetGroupName = (groupId) => {
      const group = apiIntegration.targetGroups.value.find(tg => tg.value === groupId)
      return group ? group.name : `Group ${groupId}`
    }

    // Calculate total vulnerability count for a group
    const getTotalVulnCount = (group) => {
      if (!group.vulnCount) return 0
      const counts = group.vulnCount
      return (counts.critical || 0) + (counts.high || 0) + (counts.medium || 0) + (counts.low || 0) + (counts.info || 0)
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
      exportSelectedGroups,
      toggleTargetGroup,
      getTargetGroupName,
      getTotalVulnCount
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

.target-group-card {
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.target-group-card:hover {
  border-color: var(--q-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.target-group-card.selected {
  border-color: var(--q-primary);
  background-color: rgba(25, 118, 210, 0.04);
}

.target-group-card.selected:hover {
  background-color: rgba(25, 118, 210, 0.08);
}

.target-group-card .q-card__section {
  padding: 12px;
}

.target-group-card .q-chip {
  margin: 1px;
  font-size: 10px;
  min-height: 18px;
}

.target-group-card {
  min-height: 120px;
  max-height: 140px;
}
</style>
