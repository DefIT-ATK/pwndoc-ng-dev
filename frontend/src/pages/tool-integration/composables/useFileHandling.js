import { ref } from 'vue'

/**
 * Composable for handling file upload, drag-drop, and file management
 */
export function useFileHandling(acceptedFormats, parseFunction) {
  const files = ref([])
  
  const addFiles = (newFiles) => {
    if (newFiles && newFiles.length > 0) {
      files.value.push(...newFiles)
      if (parseFunction) {
        parseFunction()
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
