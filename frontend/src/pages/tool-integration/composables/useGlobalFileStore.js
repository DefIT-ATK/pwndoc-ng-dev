import { ref, reactive } from 'vue'

/**
 * Global file store - holds files for each parser type
 * Files persist here regardless of whether tabs are open or closed
 */
const globalFileStore = reactive({
  nessus: ref([]),
  pingcastle: ref([]),  
  purpleknight: ref([]),
  acunetix: ref([]),
  powerupsql: ref([]),
  custom: ref([])
})

/**
 * Simple global file management
 */
export function useGlobalFileStore() {
  
  /**
   * Add files to global store for a parser type
   */
  const addFilesToStore = (parserType, files) => {
    // Defensive checks
    if (!files || !Array.isArray(files) || files.length === 0) {
      return false
    }
    
    if (!globalFileStore[parserType]) {
      globalFileStore[parserType] = ref([])
    }
    
    // Ensure the value is always an array
    if (!Array.isArray(globalFileStore[parserType].value)) {
      globalFileStore[parserType].value = []
    }
    
    // Add files (avoid duplicates by name)
    const existingNames = new Set(globalFileStore[parserType].value.map(f => f && f.name ? f.name : ''))
    const newFiles = files.filter(f => f && f.name && !existingNames.has(f.name))
    
    if (newFiles.length > 0) {
      globalFileStore[parserType].value.push(...newFiles)
      console.log(`📁 Added ${newFiles.length} files to global ${parserType} store`)
      return true
    }
    return false
  }

  /**
   * Get files from global store for a parser type
   */
  const getFilesFromStore = (parserType) => {
    if (!globalFileStore[parserType]) {
      globalFileStore[parserType] = ref([])
    }
    
    // Ensure the value is always an array
    if (!Array.isArray(globalFileStore[parserType].value)) {
      globalFileStore[parserType].value = []
    }
    
    return globalFileStore[parserType].value
  }

  /**
   * Clear files from global store for a parser type
   */
  const clearFilesFromStore = (parserType) => {
    if (globalFileStore[parserType]) {
      globalFileStore[parserType].value = []
    }
  }

  /**
   * Get debug info
   */
  const getStoreDebugInfo = () => {
    const info = {}
    Object.keys(globalFileStore).forEach(key => {
      info[key] = {
        fileCount: globalFileStore[key].value.length,
        files: globalFileStore[key].value.map(f => f.name)
      }
    })
    return info
  }

  return {
    addFilesToStore,
    getFilesFromStore,
    clearFilesFromStore,
    getStoreDebugInfo
  }
}
