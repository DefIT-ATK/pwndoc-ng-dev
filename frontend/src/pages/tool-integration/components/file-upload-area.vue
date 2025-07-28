<template>
  <div style="flex: 1; min-width: 0;" class="q-mr-md">
    <div
      class="upload-area"
      :class="{ 'upload-area-dragover': isDragOver }"
      @drop="onFileDrop"
      @dragover.prevent="isDragOver = true"
      @dragenter.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
    >
      <div class="upload-content">
        <q-icon name="fa fa-cloud-upload-alt" size="48px" color="primary" />
        <div class="text-h6 q-mt-md">{{ title }}</div>
        <div class="text-body2 text-grey-6">{{ subtitle }}</div>
        <div class="text-caption text-grey-5 q-mt-sm">
          {{ supportedFormats }}
        </div>
        <div class="q-mt-md row q-gutter-sm justify-center">
          <q-btn 
            color="primary" 
            outline 
            label="Select Files" 
            icon="insert_drive_file"
            @click="$refs.fileInput.click()"
            size="sm"
            no-caps
          />
          <q-btn 
            color="secondary" 
            outline 
            label="Select Folder" 
            icon="folder"
            @click="$refs.folderInput.click()"
            size="sm"
            no-caps
          />
        </div>
      </div>
    </div>
    
    <input
      ref="fileInput"
      type="file"
      :accept="acceptedFormats.join(',')"
      multiple
      style="display: none"
      @change="onFileSelected"
    />
    <input
      ref="folderInput"
      type="file"
      webkitdirectory
      multiple
      style="display: none"
      @change="onFolderSelected"
    />
    
    <!-- Selected files info - Hide this since parent shows files in grid -->
    <!-- 
    <div v-if="files.length > 0" class="q-mt-md">
      <div class="text-subtitle2 q-mb-sm">Selected Files:</div>
      <div v-for="(file, index) in files" :key="index" class="q-mb-xs">
        <q-chip
          :label="file.name"
          color="primary"
          removable
          @remove="$emit('file-removed', index)"
        >
          <template v-slot:avatar>
            <q-icon name="fa fa-file" />
          </template>
        </q-chip>
      </div>
    </div>
    -->
  </div>
</template>

<script>
import { defineComponent, ref } from 'vue'
import { Notify } from 'quasar'

export default defineComponent({
  name: 'FileUploadArea',
  
  props: {
    files: {
      type: Array,
      default: () => []
    },
    acceptedFormats: {
      type: Array,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    subtitle: {
      type: String,
      required: true
    },
    supportedFormats: {
      type: String,
      required: true
    }
  },
  
  emits: ['files-changed', 'file-removed'],
  
  setup(props, { emit }) {
    const isDragOver = ref(false)
    
    const onFileSelected = (event) => {
      const newFiles = Array.from(event.target.files)
      if (newFiles.length > 0) {
        emit('files-changed', newFiles)
      }
      // Clear the input value to allow re-selecting the same file
      event.target.value = ''
    }

    const onFolderSelected = (event) => {
      const newFiles = Array.from(event.target.files)
      if (newFiles.length > 0) {
        console.log(`Selected folder with ${newFiles.length} files`)
        emit('files-changed', newFiles)
      }
      // Clear the input value to allow re-selecting the same folder
      event.target.value = ''
    }

    const processDataTransferItems = async (items) => {
      const files = []
      
      const processEntry = async (entry) => {
        if (entry.isFile) {
          return new Promise((resolve) => {
            entry.file(resolve, () => resolve(null))
          })
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader()
          const allFiles = []
          
          const readBatch = () => {
            return new Promise((resolve) => {
              dirReader.readEntries(async (entries) => {
                if (entries.length === 0) {
                  resolve([])
                  return
                }
                
                const promises = entries.map(processEntry)
                const results = await Promise.all(promises)
                const flatResults = results.flat().filter(Boolean)
                
                resolve(flatResults)
              }, () => resolve([]))
            })
          }
          
          // Keep reading batches until we get an empty batch
          let batch = await readBatch()
          while (batch.length > 0) {
            allFiles.push(...batch)
            batch = await readBatch()
          }
          
          return allFiles
        }
        return null
      }

      // Process all dropped items
      for (const item of items) {
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry()
          if (entry) {
            const result = await processEntry(entry)
            if (Array.isArray(result)) {
              files.push(...result)
            } else if (result) {
              files.push(result)
            }
          }
        } else if (item.getAsFile) {
          const file = item.getAsFile()
          if (file) {
            files.push(file)
          }
        }
      }
      
      return files
    }
    
    const onFileDrop = async (event) => {
      isDragOver.value = false
      event.preventDefault()
      
      const items = Array.from(event.dataTransfer.items)
      
      if (items.length > 0 && items[0].webkitGetAsEntry) {
        // Modern browsers with folder support
        console.log('Processing dropped items with folder support...')
        const files = await processDataTransferItems(items)
        
        const validFiles = files.filter(file => {
          const ext = '.' + file.name.split('.').pop().toLowerCase()
          return props.acceptedFormats.includes(ext) || props.acceptedFormats.includes('*')
        })
        
        if (validFiles.length > 0) {
          console.log(`Found ${validFiles.length} valid files from ${files.length} total files`)
          emit('files-changed', validFiles)
        } else {
          const formatList = props.acceptedFormats.includes('*') ? 'any format' : props.acceptedFormats.join(', ')
          Notify.create({
            message: `No valid files found in dropped folders. Please use ${formatList} files.`,
            color: 'negative',
            position: 'top-right'
          })
        }
      } else {
        // Fallback for older browsers or simple file drops
        const droppedFiles = Array.from(event.dataTransfer.files)
        const validFiles = droppedFiles.filter(file => {
          const ext = '.' + file.name.split('.').pop().toLowerCase()
          return props.acceptedFormats.includes(ext) || props.acceptedFormats.includes('*')
        })
        
        if (validFiles.length > 0) {
          emit('files-changed', validFiles)
        } else {
          const formatList = props.acceptedFormats.includes('*') ? 'any format' : props.acceptedFormats.join(', ')
          Notify.create({
            message: `No valid files found. Please use ${formatList} files.`,
            color: 'negative',
            position: 'top-right'
          })
        }
      }
    }
    
    return {
      isDragOver,
      onFileSelected,
      onFolderSelected,
      onFileDrop
    }
  }
})
</script>

<style scoped>
.upload-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  transition: all 0.3s ease;
  background-color: #fafafa;
}

.upload-area:hover {
  border-color: #1976d2;
  background-color: #f0f8ff;
}

.upload-area-dragover {
  border-color: #1976d2;
  background-color: #e3f2fd;
  transform: scale(1.02);
}

.upload-content {
  pointer-events: auto;
}
</style>
