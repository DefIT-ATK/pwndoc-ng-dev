import { ref, reactive } from 'vue'
import { useGlobalFileStore } from './useGlobalFileStore.js'

// Registry for parser instances (when tabs are open)
const registeredParsers = reactive({})

/**
 * Universal file routing system for parser tabs
 */
export function useParserDispatcher() {
  const { addFilesToStore, getFilesFromStore, getStoreDebugInfo } = useGlobalFileStore()
  
  /**
   * Register a parser instance (when tab mounts)
   */
  const registerParserInstance = (parserType, instance) => {
    registeredParsers[parserType] = instance
    console.log(`🔌 Registered parser: ${parserType}`)
    
    // When tab opens, load any files from global store
    const storedFiles = getFilesFromStore(parserType) || []
    if (storedFiles.length > 0 && instance.handleFileChange) {
      console.log(`📂 Loading ${storedFiles.length} stored files into ${parserType} tab`)
      instance.handleFileChange(storedFiles)
    }
  }

  /**
   * Unregister a parser instance (when tab unmounts)
   */
  const unregisterParserInstance = (parserType) => {
    delete registeredParsers[parserType]
    console.log(`🔌 Unregistered parser: ${parserType}`)
  }

  /**
   * Send files to a specific parser tab (or store for later)
   */
  const sendFilesToParserTab = async (parserType, files) => {
    // Defensive check for files
    if (!files || !Array.isArray(files) || files.length === 0) {
      console.log(`📦 No files to send to ${parserType}`)
      return true
    }
    
    // Always store files globally first
    addFilesToStore(parserType, files)
    
    const parser = registeredParsers[parserType]
    
    if (!parser) {
      console.log(`📦 Parser ${parserType} not open - files stored for when tab opens`)
      return true // Success - files are stored
    }

    if (!parser.handleFileChange) {
      console.warn(`❌ Parser ${parserType} has no handleFileChange method`)
      return false
    }

    try {
      // Call the parser's handleFileChange directly
      await parser.handleFileChange(files)
      console.log(`✅ Sent ${files.length} files to ${parserType} parser`)
      return true
    } catch (error) {
      console.error(`❌ Failed to send files to ${parserType}:`, error)
      return false
    }
  }

  /**
   * Route files to multiple tabs
   */
  const routeFilesToTabs = async (fileClassifications) => {
    const results = {}
    
    // Defensive check for input
    if (!fileClassifications || typeof fileClassifications !== 'object') {
      console.warn('❌ Invalid fileClassifications passed to routeFilesToTabs')
      return results
    }
    
    for (const [parserType, files] of Object.entries(fileClassifications)) {
      // Ensure files is an array
      if (!Array.isArray(files) || files.length === 0) {
        console.log(`⚠️ Skipping ${parserType} - no valid files array`)
        continue
      }
      
      console.log(`🚀 Routing ${files.length} files to ${parserType}`)
      const fileList = files.map(item => item.file || item).filter(f => f != null)
      
      if (fileList.length > 0) {
        results[parserType] = await sendFilesToParserTab(parserType, fileList)
      } else {
        console.log(`⚠️ No valid files extracted for ${parserType}`)
        results[parserType] = false
      }
    }
    
    return results
  }

  /**
   * Get registered parsers (for debugging)
   */
  const getRegisteredParsers = () => {
    return Object.keys(registeredParsers)
  }

  return {
    registerParserInstance,
    unregisterParserInstance,
    sendFilesToParserTab,
    routeFilesToTabs,
    getRegisteredParsers,
    getStoreDebugInfo
  }
}
