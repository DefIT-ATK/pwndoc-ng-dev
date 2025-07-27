<template>
  <div style="flex: 1; min-width: 0;" class="q-mr-md">
    <div
      class="upload-area"
      :class="{ 'upload-area-dragover': isDragOver }"
      @drop="onFileDrop"
      @dragover.prevent="isDragOver = true"
      @dragenter.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @click="$refs.fileInput.click()"
    >
      <div class="upload-content">
        <q-icon name="fa fa-cloud-upload-alt" size="48px" color="primary" />
        <div class="text-h6 q-mt-md">{{ title }}</div>
        <div class="text-body2 text-grey-6">{{ subtitle }}</div>
        <div class="text-caption text-grey-5 q-mt-sm">
          {{ supportedFormats }}
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
    
    const onFileDrop = (event) => {
      isDragOver.value = false
      event.preventDefault()
      
      const droppedFiles = Array.from(event.dataTransfer.files)
      const validFiles = droppedFiles.filter(file => {
        const ext = '.' + file.name.split('.').pop().toLowerCase()
        return props.acceptedFormats.includes(ext)
      })
      
      if (validFiles.length > 0) {
        emit('files-changed', validFiles)
      } else {
        const formatList = props.acceptedFormats.join(', ')
        Notify.create({
          message: `No valid files found. Please use ${formatList} files.`,
          color: 'negative',
          position: 'top-right'
        })
      }
    }
    
    return {
      isDragOver,
      onFileSelected,
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
  cursor: pointer;
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
  pointer-events: none;
}
</style>
