<template>
  <div class="custom-parsers-tab">
    <div class="text-h6">{{ $t('toolIntegration.custom.title') }}</div>
    <div class="text-body2 q-mb-md">{{ $t('toolIntegration.custom.description') }}</div>
    
    <!-- File Upload Section -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="flex items-center justify-between q-mb-sm" v-if="selectedFiles.length > 0">
          <div class="text-subtitle1">
            Selected Files ({{ selectedFiles.length }})
          </div>
          <q-btn
            flat
            dense
            color="negative"
            icon="clear_all"
            label="Clear All"
            @click="handleClearAll"
          />
        </div>
        
        <file-upload-area
          v-bind="uploadAreaProps"
          @files-changed="handleFileChange"
          @file-removed="handleFileRemoved"
        />
        
        <!-- Empty State -->
        <div v-if="selectedFiles.length === 0" class="text-center q-py-md">
          <q-icon name="upload_file" size="48px" color="grey-5" />
          <div class="text-body2 text-grey-6 q-mt-sm">
            Upload files to get started
          </div>
        </div>
        
        <!-- Selected Files Grid -->
        <div v-if="selectedFiles.length > 0" class="q-mt-md">
          <div class="row q-gutter-sm">
            <div 
              v-for="(file, index) in selectedFiles" 
              :key="file.name"
              class="col-12 col-sm-6 col-md-4 col-lg-3"
            >
              <q-card bordered class="selected-file-card">
                <q-card-section class="q-pa-xs">
                  <div class="flex items-center justify-between">
                    <div class="text-caption ellipsis q-mr-xs" :title="file.name">
                      {{ file.name }}
                    </div>
                    <q-btn
                      flat
                      dense
                      round
                      icon="close"
                      color="negative"
                      size="xs"
                      @click="handleRemoveFile(file)"
                    >
                      <q-tooltip>Remove file</q-tooltip>
                    </q-btn>
                  </div>
                </q-card-section>
              </q-card>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- File Classification Section -->
    <q-card flat bordered class="q-mb-md" v-if="selectedFiles.length > 0">
      <q-card-section>
        <div class="text-h6 flex items-center q-mb-md">
          <q-icon name="assessment" class="q-mr-sm" />
          File Classification
        </div>
        
        <!-- Analysis Loading -->
        <div v-if="analyzing" class="text-center q-py-md">
          <q-spinner size="40px" color="primary" />
          <div class="text-body2 q-mt-sm">Analyzing files for classification...</div>
        </div>
        
        <!-- Classification Results -->
        <div v-else-if="fileClassificationResult">
          <!-- Summary Stats -->
          <div class="row q-gutter-md q-mb-md">
            <q-chip 
              color="positive" 
              text-color="white" 
              icon="check_circle"
              :label="`${totalMatchedCount} Matched`"
            />
            <q-chip 
              color="warning" 
              text-color="white" 
              icon="help"
              :label="`${totalUnmatchedCount} Unmatched`"
            />
            <q-chip 
              color="info" 
              text-color="white" 
              icon="folder"
              :label="`${totalFilesCount} Total`"
            />
          </div>

          <!-- Matched and Unmatched Files Side by Side -->
          <div class="flex q-gutter-md">
            <!-- Recognized Files Section -->
            <div style="flex: 1; min-width: 0;">
              <div class="text-subtitle1 text-positive q-mb-sm flex items-center">
                <q-icon name="check_circle" class="q-mr-xs" />
                Recognized Files ({{ fileClassificationResult.matched.length + Object.keys(manuallyAssignedFiles).length }})
              </div>
              
              <div class="q-gutter-sm">
                <!-- Automatically Matched Files -->
                <div 
                  v-for="match in fileClassificationResult.matched" 
                  :key="`auto-${match.file.name}-${match.type}`"
                >
                  <q-card bordered class="file-match-card bg-green-1">
                    <q-card-section class="q-pa-sm">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center">
                          <q-icon 
                            :name="getFileTypeIcon(match.type)" 
                            :color="getFileTypeColor(match.type)"
                            size="24px" 
                            class="q-mr-sm"
                          />
                          <div>
                            <div class="text-weight-medium">{{ match.file.name }}</div>
                            <div class="text-caption text-grey-7">{{ match.type }}</div>
                          </div>
                        </div>
                        <div class="flex items-center q-gutter-xs">
                          <q-badge color="positive" label="Matched" />
                          <q-btn
                            flat
                            dense
                            round
                            icon="close"
                            color="negative"
                            size="sm"
                            @click="handleRemoveFile(match.file)"
                          >
                            <q-tooltip>Remove file</q-tooltip>
                          </q-btn>
                        </div>
                      </div>
                      <div class="text-caption text-grey-6 q-mt-xs">
                        {{ getFileTypeDescription(match.type) }}
                      </div>
                    </q-card-section>
                  </q-card>
                </div>

                <!-- Manually Assigned Files -->
                <div 
                  v-for="(assignedFile, fileName) in manuallyAssignedFiles" 
                  :key="`manual-${fileName}-${assignedFile.type}`"
                >
                  <q-card bordered class="file-match-card bg-blue-1">
                    <q-card-section class="q-pa-sm">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center">
                          <q-icon 
                            :name="getFileTypeIcon(assignedFile.type)" 
                            :color="getFileTypeColor(assignedFile.type)"
                            size="24px" 
                            class="q-mr-sm"
                          />
                          <div>
                            <div class="text-weight-medium">{{ fileName }}</div>
                            <div class="text-caption text-grey-7">{{ assignedFile.type }}</div>
                          </div>
                        </div>
                        <div class="flex items-center q-gutter-xs">
                          <q-badge color="info" label="Manual" />
                          <q-btn
                            flat
                            dense
                            round
                            icon="close"
                            color="negative"
                            size="sm"
                            @click="handleRemoveFile(assignedFile.file)"
                          >
                            <q-tooltip>Remove file</q-tooltip>
                          </q-btn>
                        </div>
                      </div>
                      <div class="text-caption text-grey-6 q-mt-xs">
                        {{ getFileTypeDescription(assignedFile.type) }}
                      </div>
                      <!-- Manual Classification Dropdown for Reassignment -->
                      <q-select
                        :model-value="assignedFile.type"
                        :options="availableFileTypes"
                        option-label="label"
                        option-value="value"
                        emit-value
                        map-options
                        outlined
                        dense
                        label="Reassign type"
                        class="q-mt-sm"
                        @update:model-value="(value) => handleReassignFile(fileName, value)"
                      >
                        <template v-slot:prepend>
                          <q-icon name="edit" />
                        </template>
                      </q-select>
                    </q-card-section>
                  </q-card>
                </div>

                <!-- Empty State for Recognized -->
                <div v-if="fileClassificationResult.matched.length === 0 && Object.keys(manuallyAssignedFiles).length === 0" class="text-center q-py-md">
                  <q-icon name="sentiment_neutral" size="32px" color="grey-5" />
                  <div class="text-caption text-grey-6 q-mt-sm">
                    No recognized files yet
                  </div>
                </div>
              </div>
            </div>

            <!-- Unrecognized Files Section -->
            <div style="flex: 1; min-width: 0;">
              <div class="text-subtitle1 text-warning q-mb-sm flex items-center">
                <q-icon name="help" class="q-mr-xs" />
                Unrecognized Files ({{ getUnrecognizedFiles().length }})
              </div>
              <div class="text-caption text-grey-6 q-mb-sm">
                Select the appropriate type to move files to the recognized section.
              </div>
              
              <div class="q-gutter-sm">
                <div 
                  v-for="(unmatch, index) in getUnrecognizedFiles()" 
                  :key="`unmatched-${unmatch.file.name}`"
                >
                  <q-card bordered class="file-unmatch-card bg-orange-1">
                    <q-card-section class="q-pa-sm">
                      <div class="flex items-center justify-between q-mb-sm">
                        <div class="flex items-center">
                          <q-icon 
                            name="help" 
                            color="warning"
                            size="24px" 
                            class="q-mr-sm"
                          />
                          <div>
                            <div class="text-weight-medium">{{ unmatch.file.name }}</div>
                            <div class="text-caption text-grey-7">{{ unmatch.file.size }} bytes</div>
                          </div>
                        </div>
                        <div class="flex items-center q-gutter-xs">
                          <q-badge color="warning" label="Unknown" />
                          <q-btn
                            flat
                            dense
                            round
                            icon="close"
                            color="negative"
                            size="sm"
                            @click="handleRemoveFile(unmatch.file)"
                          >
                            <q-tooltip>Remove file</q-tooltip>
                          </q-btn>
                        </div>
                      </div>
                      
                      <!-- Manual Classification Dropdown -->
                      <q-select
                        :model-value="null"
                        :options="availableFileTypes"
                        option-label="label"
                        option-value="value"
                        emit-value
                        map-options
                        outlined
                        dense
                        label="Select file type"
                        class="q-mt-sm"
                        @update:model-value="(value) => handleManualClassification(unmatch.file, value)"
                      >
                        <template v-slot:prepend>
                          <q-icon name="category" />
                        </template>
                      </q-select>
                    </q-card-section>
                  </q-card>
                </div>

                <!-- Empty State for Unrecognized -->
                <div v-if="getUnrecognizedFiles().length === 0" class="text-center q-py-md">
                  <q-icon name="sentiment_satisfied" size="32px" color="positive" />
                  <div class="text-caption text-grey-6 q-mt-sm">
                    All files recognized!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Parse Results Section -->
    <q-card flat bordered class="q-mb-md" v-if="parseResults.length > 0">
      <q-card-section>
        <div class="text-h6 flex items-center justify-between q-mb-md">
          <div class="flex items-center">
            <q-icon name="assessment" class="q-mr-sm" />
            Parse Results
          </div>
          <q-chip 
            :color="allFindings.length > 0 ? 'positive' : 'grey-5'"
            text-color="white"
            dense
          >
            {{ allFindings.length }} Vulnerabilities
          </q-chip>
        </div>
        
        <!-- Results Summary -->
        <div class="row q-gutter-md q-mb-md">
          <div 
            v-for="result in parseResults" 
            :key="result.parserName"
            class="col-12 col-md-6"
          >
            <q-card 
              bordered 
              :class="result.success ? 'bg-green-1 border-green' : 'bg-red-1 border-red'"
            >
              <q-card-section class="q-pa-sm">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-weight-medium">{{ result.displayName }}</div>
                    <div class="text-caption">
                      {{ result.success ? `${result.findingsCount} findings` : result.error }}
                    </div>
                  </div>
                  <q-icon 
                    :name="result.success ? 'check_circle' : 'error'"
                    :color="result.success ? 'positive' : 'negative'"
                    size="24px"
                  />
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Audit Selection -->
    <audit-selection
      v-if="allFindings.length > 0"
      :audits="audits"
      :selected-audit="selectedAudit"
      :loading="loadingAudits"
      @update:selected-audit="selectedAudit = $event"
    />
    
    <!-- Vulnerability Preview -->
    <vulnerability-preview
      v-if="allFindings.length > 0"
      :vulnerabilities="allFindings"
      :selected="selectedVulnerabilities"
      :audits="audits"
      :selected-audit="selectedAudit"
      :importing="importing"
      :total-vulnerabilities="allFindings.length"
      :import-button-label="$t('toolIntegration.custom.import')"
      @import="importAllSelected"
    />
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useCustomParsers } from '../composables/useCustomParsers'
import { customVulnRegistry } from '@/services/custom-vulnerability-registry'
import FileUploadArea from './file-upload-area.vue'
import AuditSelection from './audit-selection.vue'
import VulnerabilityPreview from './vulnerability-preview.vue'
import { useStandardParserTab } from '../composables/useStandardParserTab'

export default {
  name: 'CustomTab',
  components: {
    FileUploadArea,
    AuditSelection,
    VulnerabilityPreview
  },
  props: {
    audits: {
      type: Array,
      required: true
    },
    loadingAudits: {
      type: Boolean,
      default: false
    },
    settings: {
      type: Object,
      default: () => ({})
    }
  },
  setup(props) {
    const customParsers = useCustomParsers(props.settings)
    
    // Standard parser tab interface
    const standardInterface = useStandardParserTab('custom', null, customParsers)
    
    // File classification state
    const fileClassificationResult = ref(window.fileClassificationResult || {
      classified: {},
      matched: [],
      unmatched: [],
      summary: { totalFiles: 0, matchedCount: 0, unmatchedCount: 0 }
    })
    const manualClassifications = ref({})
    const manuallyAssignedFiles = ref({}) // Track manually assigned files
    
    // Available file types for manual classification
    const availableFileTypes = computed(() => {
      const fileTypes = customVulnRegistry.getFileTypeDefinitions()
      return Object.entries(fileTypes).map(([key, definition]) => ({
        label: `${key} - ${definition.description}`,
        value: key
      }))
    })

    // Reactive computed properties for summary counters
    const totalMatchedCount = computed(() => {
      if (!fileClassificationResult.value) return 0
      return fileClassificationResult.value.matched.length + Object.keys(manuallyAssignedFiles.value).length
    })

    const totalUnmatchedCount = computed(() => {
      return getUnrecognizedFiles().length
    })

    const totalFilesCount = computed(() => {
      if (!fileClassificationResult.value) return 0
      return fileClassificationResult.value.summary.totalFiles
    })

    // Get parser dispatcher for registration
    const handleFileChangeCustom = async (files) => {
      customParsers.addFiles(files)
      // Get classification result from global storage (set by useCustomParsers)
      setTimeout(() => {
        fileClassificationResult.value = window.fileClassificationResult || null
        // Reset manual classifications but preserve existing assignments
        manualClassifications.value = {}
      }, 100)
    }

    // Override the standard handleFileChange with our custom logic
    standardInterface.handleFileChange = handleFileChangeCustom

    const handleFileRemoved = (index) => {
      customParsers.removeFile(index)
      // Clear classification results when files are removed
      fileClassificationResult.value = null
      manualClassifications.value = {}
    }
    
    const handleClearAll = () => {
      // Show confirmation dialog
      if (window.confirm('Are you sure you want to remove all files? This action cannot be undone.')) {
        customParsers.clearAllFiles()
        fileClassificationResult.value = null
        manualClassifications.value = {}
        manuallyAssignedFiles.value = {}
      }
    }
    
    const handleRemoveFile = async (fileToRemove) => {
      await customParsers.removeFile(fileToRemove)
      
      // Also remove from manually assigned files if it exists
      const fileName = fileToRemove.name
      if (manuallyAssignedFiles.value[fileName]) {
        delete manuallyAssignedFiles.value[fileName]
      }
      
      // Update classification results
      setTimeout(() => {
        fileClassificationResult.value = window.fileClassificationResult || null
        manualClassifications.value = {}
      }, 100)
    }
    
    const handleManualClassification = (file, selectedType) => {
      console.log(`Manually classified file ${file.name} as: ${selectedType}`)
      
      // Move file from unmatched to manually assigned
      manuallyAssignedFiles.value[file.name] = {
        file: file,
        type: selectedType,
        assignedAt: new Date().toISOString()
      }
    }
    
    const handleReassignFile = (fileName, newType) => {
      console.log(`Reassigning file ${fileName} to: ${newType}`)
      
      if (manuallyAssignedFiles.value[fileName]) {
        manuallyAssignedFiles.value[fileName].type = newType
        manuallyAssignedFiles.value[fileName].reassignedAt = new Date().toISOString()
      }
    }
    
    const getUnrecognizedFiles = () => {
      if (!fileClassificationResult.value || !fileClassificationResult.value.unmatched) {
        return []
      }
      
      // Filter out files that have been manually assigned
      return fileClassificationResult.value.unmatched.filter(unmatch => 
        !manuallyAssignedFiles.value[unmatch.file.name]
      )
    }
    
    const getFileTypeIcon = (type) => {
      const iconMap = {
        'Nessus': 'security',
        'PingCastle': 'domain',
        'PurpleKnight': 'shield',
        'SAM File': 'computer',
        'Cracked Passwords File': 'key',
        'NTDS Dump Enabled Users': 'people',
        'Domain Admins List': 'group',
        'Domain Policy Info': 'policy',
        'Acunetix': 'web',
        'ScoutSuite': 'cloud',
        'PowerUpSQL': 'storage'
      }
      return iconMap[type] || 'description'
    }
    
    const getFileTypeColor = (type) => {
      const colorMap = {
        'Nessus': 'deep-orange',
        'PingCastle': 'blue',
        'PurpleKnight': 'purple',
        'SAM File': 'grey',
        'Cracked Passwords File': 'red',
        'NTDS Dump Enabled Users': 'green',
        'Domain Admins List': 'amber',
        'Domain Policy Info': 'teal',
        'Acunetix': 'indigo',
        'ScoutSuite': 'cyan',
        'PowerUpSQL': 'pink'
      }
      return colorMap[type] || 'grey'
    }
    
    const getFileTypeDescription = (type) => {
      const fileTypes = customVulnRegistry.getFileTypeDefinitions()
      return fileTypes[type]?.description || 'Unknown file type'
    }

    return {
      // Standard interface (includes file handling, registration, etc.)
      ...standardInterface,
      
      // Parser-specific state and methods (explicit to ensure availability)
      ...customParsers,
      selectedFiles: customParsers.selectedFiles, // Alias for SelectedFilesGrid
      
      // Custom tab specific state
      fileClassificationResult,
      manualClassifications,
      manuallyAssignedFiles,
      availableFileTypes,
      totalMatchedCount,
      totalUnmatchedCount,
      totalFilesCount,
      
      // Custom tab specific methods
      handleManualClassification,
      handleReassignFile,
      getUnrecognizedFiles,
      getFileTypeIcon,
      getFileTypeColor,
      getFileTypeDescription
    }
  }
}
</script>

<style lang="scss" scoped>
.selected-file-card {
  transition: transform 0.2s, box-shadow 0.2s;
  min-height: 36px;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.file-match-card, .file-unmatch-card {
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.file-match-card {
  border-left: 4px solid #4caf50;
  
  &.bg-blue-1 {
    border-left: 4px solid #2196f3;
  }
}

.file-unmatch-card {
  border-left: 4px solid #ff9800;
}

.border-green {
  border: 1px solid #4caf50;
}

.border-red {
  border: 1px solid #f44336;
}

// File type specific styling
.q-chip {
  font-weight: 500;
}

.q-select {
  .q-field__control {
    min-height: 32px;
  }
}

// Text ellipsis for long filenames
.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
