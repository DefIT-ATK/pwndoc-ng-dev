<template>
  <div class="universal-upload-hub">
    <!-- Header -->
    <div class="text-h5 q-mb-md">
      <q-icon name="upload" class="q-mr-sm" />
      Universal File Upload Hub
    </div>
    <div class="text-body2 text-grey-6 q-mb-lg">
      Upload files or folders from any security tool. They'll be automatically 
      classified and routed to the appropriate parser tabs based on their content.
    </div>

    <!-- Single Universal Upload Area -->
    <q-card flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md flex items-center">
          <q-icon name="cloud_upload" class="q-mr-sm" />
          File Upload & Classification
        </div>
        
        <file-upload-area
          :accepted-formats="['*']"
          title="Drop files or folders from any security tool"
          subtitle="Enhanced automatic detection and routing using centralized parser registry"
          supported-formats="Registry-based classification: Nessus (.nessus, .xml), Acunetix (.xml), PingCastle (.html, .xml), Purple Knight (.json, .xml, .html), PowerUpSQL (.csv, .txt), and more"
          @files-changed="handleFilesUploaded"
        />
        
        <!-- Upload Progress -->
        <div v-if="uploading" class="q-mt-md">
          <q-linear-progress :value="uploadProgress" class="q-mb-sm" />
          <div class="text-caption text-center">
            Processing {{ uploadedFiles.length }} files...
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- File Classification Results -->
    <!-- DEBUG: uploadedFiles.length = {{ uploadedFiles.length }} -->
    <div v-if="uploadedFiles.length > 0">
      <file-classification-panel
        :uploaded-files="uploadedFiles"
        :classification-results="classificationResults"
        :classifying="classifying"
        @reclassify-file="handleFileReclassification"
        @remove-file="handleFileRemoval"
        @route-to-tabs="routeToTabs"
        @send-to-tab="sendToSpecificTab"
        @debug-classification="debugClassification"
        class="q-mb-lg"
      />
    </div>

    <!-- DEBUG: Show raw file count -->
    <div v-if="uploadedFiles.length === 0" class="text-caption text-grey-5">
      No files uploaded yet (uploadedFiles.length = {{ uploadedFiles.length }})
    </div>

    <!-- Instructions for next steps -->
    <div v-if="uploadedFiles.length > 0 && !classifying" class="q-mt-lg">
      <q-card flat bordered class="bg-blue-1">
        <q-card-section>
          <div class="text-subtitle1 flex items-center q-mb-sm">
            <q-icon name="info" color="primary" class="q-mr-sm" />
            Next Steps
          </div>
          <div class="text-body2 text-grey-7">
            Your files have been classified! You can now:
            <ul class="q-mt-sm q-mb-none">
              <li><strong>Open the parser tabs</strong> you want to use (Nessus, Acunetix, etc.)</li>
              <li>Use <strong>"Route All to Tabs"</strong> to send files to the open tabs</li>
              <li>Files will appear and parse automatically, just like normal uploads!</li>
            </ul>
          </div>
          
          <!-- Debug button -->
          <div class="q-mt-md">
            <q-btn 
              size="sm" 
              flat 
              color="grey" 
              icon="bug_report" 
              label="Debug: Show Enhanced Registry"
              @click="showRegisteredParsers"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { Notify } from 'quasar'
import FileUploadArea from './file-upload-area.vue'
import FileClassificationPanel from './file-classification-panel.vue'
import { useUniversalFileClassification } from '../composables/useUniversalFileClassification'
import { useParserDispatcher } from '../composables/useParserDispatcher'
import { PARSER_REGISTRY, getParserDisplayInfo, getAllParserTypes } from '../config/parserRegistry'

export default {
  name: 'UniversalFileUploadHub',
  
  components: {
    FileUploadArea,
    FileClassificationPanel
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
    // Core state
    const uploadedFiles = ref([])
    const uploading = ref(false)
    const uploadProgress = ref(0)

    // File classification with enhanced heuristics
    const {
      classificationResults,
      classifying,
      classifyFiles,
      reclassifyFile,
      debugFileClassification
    } = useUniversalFileClassification()

    // Parser dispatcher for tab routing
    const {
      routeFilesToTabs,
      sendFilesToParserTab,
      getRegisteredParsers,
      getStoreDebugInfo
    } = useParserDispatcher()

    // Handle file uploads with enhanced classification
    const handleFilesUploaded = async (files) => {
      console.log('🔥 Universal Hub: handleFilesUploaded called with files:', files)
      console.log('🔥 Files array length:', files.length)
      console.log('🔥 Files details:', Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type })))
      
      uploading.value = true
      uploadProgress.value = 0

      try {
        // Add files to uploaded files list
        const newFiles = Array.from(files)
        console.log('🔥 New files array:', newFiles.length)
        
        const existingNames = new Set(uploadedFiles.value.map(f => f.name))
        const uniqueFiles = newFiles.filter(f => !existingNames.has(f.name))
        
        console.log('🔥 Unique files:', uniqueFiles.length)
        console.log('🔥 uploadedFiles.value before:', uploadedFiles.value.length)
        
        if (uniqueFiles.length === 0) {
          Notify.create({
            message: 'All files are already uploaded',
            color: 'info',
            position: 'top-right'
          })
          return
        }

        uploadedFiles.value.push(...uniqueFiles)
        console.log('🔥 uploadedFiles.value after push:', uploadedFiles.value.length)
        console.log('🔥 uploadedFiles.value contents:', uploadedFiles.value.map(f => f.name))
        
        uploadProgress.value = 50

        // Classify the new files
        console.log('🔥 About to classify files...')
        await classifyFiles(uniqueFiles)
        console.log('🔥 Classification complete')
        
        uploadProgress.value = 100

        Notify.create({
          message: `Successfully uploaded and classified ${uniqueFiles.length} files`,
          color: 'positive',
          position: 'top-right'
        })

      } catch (error) {
        console.error('Error uploading files:', error)
        Notify.create({
          message: 'Error uploading files: ' + error.message,
          color: 'negative',
          position: 'top-right'
        })
      } finally {
        uploading.value = false
        setTimeout(() => {
          uploadProgress.value = 0
        }, 1000)
      }
    }

    // Handle file removal
    const handleFileRemoval = (fileToRemove) => {
      const index = uploadedFiles.value.findIndex(f => f.name === fileToRemove.name)
      if (index !== -1) {
        uploadedFiles.value.splice(index, 1)
        
        // Re-classify remaining files
        if (uploadedFiles.value.length > 0) {
          classifyFiles(uploadedFiles.value)
        } else {
          // Clear classification results if no files left
          classificationResults.value = {
            nessus: [], pingcastle: [], purpleknight: [], 
            acunetix: [], powerupsql: [], custom: [], unrecognized: []
          }
        }
      }
    }

    // Handle file reclassification
    const handleFileReclassification = async (file, newParserType) => {
      await reclassifyFile(file, newParserType)
      
      Notify.create({
        message: `File "${file.name}" reclassified as ${newParserType}`,
        color: 'info',
        position: 'top-right'
      })
    }

    // Route classified files to individual parser tabs
    const routeToTabs = async () => {
      // Debug: Log current state before routing
      console.log('🔍 Route to Tabs Debug:')
      console.log('Classification results:', classificationResults.value)
      
      const results = await routeFilesToTabs(classificationResults.value)
      
      // Convert results object to routes array for compatibility
      const routes = Object.entries(results).map(([parserType, success]) => ({
        parserType,
        success,
        files: classificationResults.value[parserType]?.map(item => item.file || item) || []
      }))
      
      const successfulRoutes = routes.filter(r => r.success)
      const failedRoutes = routes.filter(r => !r.success)
      
      // Debug: Show detailed routing results
      console.log('✅ Successful routes:', successfulRoutes.map(r => `${r.parserType} (${r.files.length} files)`))
      console.log('❌ Failed routes:', failedRoutes.map(r => `${r.parserType} (${r.files.length} files)`))
      
      if (successfulRoutes.length > 0) {
        Notify.create({
          message: `Files stored/sent to ${successfulRoutes.length} parser types`,
          color: 'positive',
          position: 'top-right',
          actions: [
            {
              label: 'View Tabs',
              color: 'white',
              handler: () => {
                // Switch to first available tab with files
                const firstTabWithFiles = successfulRoutes[0]?.parserType
                if (firstTabWithFiles) {
                  // Emit event to switch tabs
                  const event = new CustomEvent('switchToTab', {
                    detail: { tabName: firstTabWithFiles }
                  })
                  document.dispatchEvent(event)
                }
              }
            }
          ]
        })
      }
      
      if (failedRoutes.length > 0) {
        const failedParserTypes = failedRoutes.map(r => r.parserType).join(', ')
        Notify.create({
          message: `Failed to route ${failedRoutes.length} parser types (${failedParserTypes})`,
          color: 'negative',
          position: 'top-right',
          timeout: 8000
        })
        console.log('Failed routes details:', failedRoutes)
      }
    }

    // Send specific parser files to their respective tabs
    const sendToSpecificTab = async (parserType) => {
      const files = classificationResults.value[parserType]
      if (!files || files.length === 0) {
        Notify.create({
          message: `No ${parserType} files to send`,
          color: 'warning',
          position: 'top-right'
        })
        return
      }

      const fileList = files.map(item => item.file)
      const success = await sendFilesToParserTab(parserType, fileList)
      
      if (success) {
        Notify.create({
          message: `${fileList.length} files stored/sent to ${parserType} parser`,
          color: 'positive',
          position: 'top-right'
        })
      } else {
        Notify.create({
          message: `Failed to send files to ${parserType} parser`,
          color: 'negative',
          position: 'top-right'
        })
      }
    }

    // Debug classification for troubleshooting
    const debugClassification = async (file) => {
      const results = await debugFileClassification(file)
      console.log('Debug classification results:', results)
      
      Notify.create({
        message: `Debug results for "${file.name}" logged to console`,
        color: 'info',
        position: 'top-right'
      })
    }

    // Show registered parsers for debugging
    const showRegisteredParsers = () => {
      const registered = getRegisteredParsers()
      const storeInfo = getStoreDebugInfo()
      
      console.log('� Debug Info:')
      console.log('📋 Registered parsers (open tabs):', registered)
      console.log('🗄️ Global file store:', storeInfo)
      
      const tabList = registered.length > 0 ? registered.join(', ') : 'None'
        
      Notify.create({
        message: `Open tabs: ${tabList}. Files are stored globally and appear when tabs open.`,
        color: 'info',
        position: 'top-right',
        timeout: 8000
      })
    }

    return {
      // State
      uploadedFiles,
      uploading,
      uploadProgress,
      classificationResults,
      classifying,
      
      // Methods
      handleFilesUploaded,
      handleFileReclassification,
      handleFileRemoval,
      
      // Tab routing methods
      routeToTabs,
      sendToSpecificTab,
      debugClassification,
      showRegisteredParsers  // Add debug method
    }
  }
}
</script>

<style lang="scss" scoped>
.universal-upload-hub {
  max-width: 100%;
  
  .q-card {
    transition: all 0.3s ease;
  }
  
  .q-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}
</style>