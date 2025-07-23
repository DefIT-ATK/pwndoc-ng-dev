import { ref } from 'vue'
import { Notify } from 'quasar'
import { $t } from '@/boot/i18n'

/**
 * Composable for handling file upload, drag-drop, and file management
 */
export function useFileHandling(acceptedFormats, parseFunction) {
  const files = ref([])
  
  const addFiles = (newFiles) => {
    if (newFiles && newFiles.length > 0) {
      // Check for duplicate filenames
      const existingFilenames = files.value.map(file => file.name)
      const duplicates = []
      const uniqueFiles = []
      
      newFiles.forEach(file => {
        if (existingFilenames.includes(file.name)) {
          duplicates.push(file.name)
        } else {
          uniqueFiles.push(file)
          existingFilenames.push(file.name)
        }
      })
      
      // Show notification for duplicates
      if (duplicates.length > 0) {
        const duplicateList = duplicates.join(', ')
        Notify.create({
          message: $t('toolIntegration.duplicateFile', { files: duplicateList }),
          color: 'warning',
          position: 'top-right',
          timeout: 3000
        })
      }
      
      // Only add unique files
      if (uniqueFiles.length > 0) {
        files.value.push(...uniqueFiles)
        if (parseFunction) {
          parseFunction()
        }
      }
    }
  }
  
  const removeFile = (index) => {
    const removedFile = files.value[index]
    files.value.splice(index, 1)
    
    if (files.value.length > 0 && parseFunction) {
      parseFunction()
    }
    
    return {
      removedFile,
      remainingCount: files.value.length
    }
  }
  
  const clearFiles = () => {
    files.value = []
  }
  
  return {
    files,
    addFiles,
    removeFile,
    clearFiles
  }
}
