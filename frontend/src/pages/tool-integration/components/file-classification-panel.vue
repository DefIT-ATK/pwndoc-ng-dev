<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-subtitle1 q-mb-md flex items-center">
        <q-icon name="assignment" class="q-mr-sm" />
        File Classification Results
        <q-space />
        <q-chip 
          v-if="totalFiles > 0"
          :label="`${totalFiles} files uploaded`"
          color="info"
          text-color="white"
          icon="folder"
        />
      </div>

      <!-- Classification in progress -->
      <div v-if="classifying" class="text-center q-py-lg">
        <q-spinner size="40px" color="primary" />
        <div class="text-body2 q-mt-md">Analyzing and classifying files...</div>
      </div>

      <!-- Classification results -->
      <div v-else-if="Object.keys(classificationResults).length > 0">
        <!-- Summary stats and routing controls -->
        <div class="q-mb-md">
          <!-- Classification summary chips -->
          <div class="row q-gutter-sm q-mb-sm">
            <q-chip 
              v-for="(count, type) in classificationSummary" 
              :key="type"
              :color="getParserColor(type)"
              text-color="white"
              :icon="getParserIcon(type)"
              :label="`${getParserName(type)}: ${count}`"
            />
          </div>
          
          <!-- Tab routing controls -->
          <div class="flex items-center q-gutter-sm">
            <q-btn
              color="primary"
              icon="share"
              label="Route All to Tabs"
              @click="$emit('route-to-tabs')"
              :disable="totalRecognizedFiles === 0"
            >
              <q-tooltip>Send classified files to their respective parser tabs</q-tooltip>
            </q-btn>
            
            <q-btn
              outline
              color="secondary"
              icon="bug_report"
              label="Debug Classification"
              @click="showDebugOptions = !showDebugOptions"
              v-if="totalFiles > 0"
            >
              <q-tooltip>Show debug information for file classification</q-tooltip>
            </q-btn>
          </div>
          
          <!-- Debug options (collapsible) -->
          <q-slide-transition>
            <div v-show="showDebugOptions" class="q-mt-sm q-pa-sm bg-grey-1 rounded-borders">
              <div class="text-caption text-grey-7 q-mb-xs">Debug individual files:</div>
              <div class="row q-gutter-xs">
                <q-btn
                  v-for="file in allUploadedFiles.slice(0, 5)"
                  :key="file.name"
                  dense
                  outline
                  size="sm"
                  :label="file.name.substring(0, 20) + (file.name.length > 20 ? '...' : '')"
                  color="info"
                  @click="$emit('debug-classification', file)"
                />
              </div>
            </div>
          </q-slide-transition>
        </div>

        <!-- Classified files by parser type -->
        <div class="row q-col-gutter-md">
          <div 
            v-for="(files, parserType) in classificationResults" 
            :key="parserType"
            :class="files.length > 0 ? 'col-12 col-md-6 col-lg-4' : ''"
          >
            <div v-if="files.length > 0">
              <q-card bordered class="classification-card">
                <q-card-section class="q-pa-sm">
                  <div class="flex items-center justify-between q-mb-sm">
                    <div class="flex items-center">
                      <q-icon 
                        :name="getParserIcon(parserType)" 
                        :color="getParserColor(parserType)"
                        size="24px" 
                        class="q-mr-sm"
                      />
                      <div>
                        <div class="text-weight-medium">{{ getParserName(parserType) }}</div>
                        <div class="text-caption text-grey-6">
                          {{ files.length }} file{{ files.length > 1 ? 's' : '' }}
                        </div>
                      </div>
                    </div>
                    <q-badge 
                      :color="getParserColor(parserType)" 
                      :label="files.length"
                    />
                  </div>

                  <!-- Files in this classification -->
                  <div class="q-gutter-xs">
                    <div 
                      v-for="(item, index) in files.slice(0, 3)" 
                      :key="index"
                      class="file-item"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center q-mr-sm" style="flex: 1; min-width: 0;">
                          <q-icon name="description" size="16px" class="q-mr-xs" />
                          <span class="text-caption ellipsis" :title="item.file.name">
                            {{ item.file.name }}
                          </span>
                        </div>
                        <div class="flex items-center q-gutter-xs">
                          <!-- Confidence indicator -->
                          <q-linear-progress 
                            :value="item.confidence / 100"
                            size="4px"
                            :color="getConfidenceColor(item.confidence)"
                            class="confidence-bar"
                          />
                          <span class="text-caption text-grey-6">
                            {{ Math.round(item.confidence) }}%
                          </span>
                          
                          <!-- Reclassify button -->
                          <q-btn
                            flat
                            dense
                            round
                            icon="edit"
                            size="xs"
                            @click="showReclassifyDialog(item.file)"
                          >
                            <q-tooltip>Reclassify file</q-tooltip>
                          </q-btn>
                          
                          <!-- Remove button -->
                          <q-btn
                            flat
                            dense
                            round
                            icon="close"
                            color="negative"
                            size="xs"
                            @click="$emit('remove-file', item.file)"
                          >
                            <q-tooltip>Remove file</q-tooltip>
                          </q-btn>
                        </div>
                      </div>
                      
                      <!-- Classification reasons (show on hover or expand) -->
                      <div v-if="item.reasons && item.reasons.length > 0" class="q-mt-xs">
                        <div class="text-caption text-grey-6">
                          <q-icon name="info" size="12px" class="q-mr-xs" />
                          {{ item.reasons.slice(0, 2).join(', ') }}
                          <span v-if="item.reasons.length > 2">...</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Show more files indicator -->
                    <div v-if="files.length > 3" class="text-caption text-grey-6 q-mt-xs">
                      <q-icon name="more_horiz" class="q-mr-xs" />
                      +{{ files.length - 3 }} more files
                    </div>
                  </div>
                  
                  <!-- Parser routing action -->
                  <q-separator class="q-my-sm" />
                  <div class="flex justify-end">
                    <q-btn
                      v-if="parserType !== 'unrecognized'"
                      dense
                      outline
                      :color="getParserColor(parserType)"
                      icon="send"
                      :label="`Send to ${getParserName(parserType)} Tab`"
                      size="sm"
                      @click="$emit('send-to-tab', parserType)"
                    >
                      <q-tooltip>Send these files to the {{ getParserName(parserType) }} parser tab</q-tooltip>
                    </q-btn>
                  </div>
                </q-card-section>
              </q-card>
            </div>
          </div>
        </div>
      </div>

      <!-- No files uploaded -->
      <div v-else class="text-center q-py-lg text-grey-6">
        <q-icon name="upload_file" size="48px" />
        <div class="text-body2 q-mt-md">Upload files to see classification results</div>
      </div>
    </q-card-section>

    <!-- Reclassification Dialog -->
    <q-dialog v-model="showReclassifyModal" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Reclassify File</div>
          <div class="text-body2 text-grey-6 q-mt-sm">
            Change the parser assignment for: <strong>{{ selectedFile?.name }}</strong>
          </div>
        </q-card-section>

        <q-card-section>
          <q-select
            v-model="newParserType"
            :options="availableParserTypes"
            option-label="label"
            option-value="value"
            emit-value
            map-options
            outlined
            label="Select new parser type"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="cancelReclassification" />
          <q-btn 
            color="primary" 
            label="Reclassify" 
            @click="confirmReclassification"
            :disable="!newParserType"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script>
import { ref, computed } from 'vue'
import { useUniversalFileClassification } from '../composables/useUniversalFileClassification'

export default {
  name: 'FileClassificationPanel',
  
  props: {
    uploadedFiles: {
      type: Array,
      default: () => []
    },
    classificationResults: {
      type: Object,
      default: () => ({})
    },
    classifying: {
      type: Boolean,
      default: false
    }
  },

  emits: ['reclassify-file', 'remove-file', 'route-to-tabs', 'send-to-tab', 'debug-classification'],

  setup(props, { emit }) {
    const { getAvailableParserTypes } = useUniversalFileClassification()
    
    // Debug options
    const showDebugOptions = ref(false)
    
    // Reclassification dialog
    const showReclassifyModal = ref(false)
    const selectedFile = ref(null)
    const newParserType = ref(null)

    // Available parser types for reclassification
    const availableParserTypes = getAvailableParserTypes()

    // Computed properties
    const totalFiles = computed(() => props.uploadedFiles.length)
    
    const allUploadedFiles = computed(() => props.uploadedFiles)
    
    const totalRecognizedFiles = computed(() => {
      let count = 0
      for (const [type, files] of Object.entries(props.classificationResults)) {
        if (type !== 'unrecognized') {
          count += files.length
        }
      }
      return count
    })

    const classificationSummary = computed(() => {
      const summary = {}
      for (const [type, files] of Object.entries(props.classificationResults)) {
        if (files.length > 0) {
          summary[type] = files.length
        }
      }
      return summary
    })

    // Helper functions
    const getParserName = (type) => {
      const names = {
        nessus: 'Nessus',
        pingcastle: 'PingCastle',
        purpleknight: 'PurpleKnight',
        acunetix: 'Acunetix',
        powerupsql: 'PowerUpSQL',
        custom: 'Custom Parsers',
        unrecognized: 'Unrecognized'
      }
      return names[type] || type
    }

    const getParserIcon = (type) => {
      const icons = {
        nessus: 'security',
        pingcastle: 'domain',
        purpleknight: 'shield',
        acunetix: 'web',
        powerupsql: 'storage',
        custom: 'extension',
        unrecognized: 'help'
      }
      return icons[type] || 'description'
    }

    const getParserColor = (type) => {
      const colors = {
        nessus: 'deep-orange',
        pingcastle: 'blue',
        purpleknight: 'purple',
        acunetix: 'indigo',
        powerupsql: 'pink',
        custom: 'teal',
        unrecognized: 'grey'
      }
      return colors[type] || 'grey'
    }

    const getConfidenceColor = (confidence) => {
      if (confidence >= 80) return 'positive'
      if (confidence >= 60) return 'warning'
      return 'negative'
    }

    // Reclassification methods
    const showReclassifyDialog = (file) => {
      selectedFile.value = file
      newParserType.value = null
      showReclassifyModal.value = true
    }

    const cancelReclassification = () => {
      showReclassifyModal.value = false
      selectedFile.value = null
      newParserType.value = null
    }

    const confirmReclassification = () => {
      if (selectedFile.value && newParserType.value) {
        emit('reclassify-file', selectedFile.value, newParserType.value)
        cancelReclassification()
      }
    }

    return {
      // State
      showReclassifyModal,
      selectedFile,
      newParserType,
      availableParserTypes,
      showDebugOptions,
      
      // Computed
      totalFiles,
      allUploadedFiles,
      totalRecognizedFiles,
      classificationSummary,
      
      // Methods
      getParserName,
      getParserIcon,
      getParserColor,
      getConfidenceColor,
      showReclassifyDialog,
      cancelReclassification,
      confirmReclassification
    }
  }
}
</script>

<style lang="scss" scoped>
.classification-card {
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.file-item {
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.02);
  transition: background-color 0.2s ease;
  
  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
}

.confidence-bar {
  width: 30px;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
