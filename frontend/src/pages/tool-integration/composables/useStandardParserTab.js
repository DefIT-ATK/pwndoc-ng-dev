import { ref, onMounted, onUnmounted } from 'vue'
import { useParserDispatcher } from './useParserDispatcher'
import { Notify } from 'quasar'

/**
 * Standard parser tab composable - provides consistent interface for all parser tabs
 * Eliminates duplicate code and ensures all parsers work the same way
 * 
 * @param {string} parserType - The parser identifier (e.g., 'nessus', 'acunetix')
 * @param {Function} parseFunction - The specific parsing function for this parser type
 * @param {Object} parserInstance - The specific parser instance (from useNessusParser, etc.)
 * 
 * @returns {Object} Standard interface with handleFileChange, registration, etc.
 */
export function useStandardParserTab(parserType, parseFunction, parserInstance) {
  console.log(`🔧 Initializing standard parser tab: ${parserType}`)
  
  // Get dispatcher for registration
  const { registerParserInstance, unregisterParserInstance } = useParserDispatcher()
  
  // Standard file change handler that all parsers will use
  const handleFileChange = async (files) => {
    try {
      console.log(`📂 Standard handleFileChange called for ${parserType} with ${files?.length || 0} files`)
      
      if (!files || files.length === 0) {
        console.warn(`⚠️ No files provided to ${parserType} parser`)
        return
      }

      // Call the specific parser's file handling logic if available
      if (parserInstance?.handleFileChange) {
        console.log(`🔄 Delegating to ${parserType} parser's handleFileChange method`)
        await parserInstance.handleFileChange(files)
      } else if (parseFunction) {
        console.log(`🔄 Using provided parseFunction for ${parserType}`)
        await parseFunction(files)
      } else {
        console.warn(`⚠️ No file handling method available for ${parserType}`)
        Notify.create({
          message: `Parser ${parserType} is not properly configured`,
          color: 'warning',
          position: 'top-right'
        })
      }
    } catch (error) {
      console.error(`❌ Error in ${parserType} handleFileChange:`, error)
      Notify.create({
        message: `Error processing files in ${parserType}: ${error.message}`,
        color: 'negative',
        position: 'top-right'
      })
    }
  }

  // Standard registration with dispatcher
  onMounted(() => {
    console.log(`🔌 Registering standard parser tab: ${parserType}`)
    
    // Register with the original parser's handleFileChange method, not the standard one
    const registrationObject = {
      // Use original parser's handleFileChange if available, fallback to standard
      handleFileChange: parserInstance?.handleFileChange || handleFileChange,
      // Include the original parser instance methods for advanced usage
      ...(parserInstance || {})
    }
    
    console.log(`🔌 Registering ${parserType} with handleFileChange:`, !!registrationObject.handleFileChange)
    registerParserInstance(parserType, registrationObject)
  })

  // Standard cleanup
  onUnmounted(() => {
    console.log(`🔌 Unregistering standard parser tab: ${parserType}`)
    unregisterParserInstance(parserType)
  })

  // Standard interface that all parser tabs will have
  return {
    // Core methods
    handleFileChange,
    
    // Parser-specific methods (pass-through from original instance)
    ...(parserInstance || {}),
    
    // Metadata
    parserType,
    isStandardized: true
  }
}

/**
 * Standard file grid methods - common functionality for file management UI
 */
export function useStandardFileGrid(files, removeFileCallback, clearFilesCallback) {
  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to remove all files? This action cannot be undone.')) {
      if (clearFilesCallback) {
        clearFilesCallback()
      } else {
        files.value = []
      }
    }
  }

  const handleRemoveFile = (fileToRemove) => {
    if (removeFileCallback) {
      // Find the index and call the provided callback
      const index = files.value.findIndex(f => f.name === fileToRemove.name)
      if (index !== -1) {
        removeFileCallback(index)
      }
    } else {
      // Default removal logic
      const index = files.value.findIndex(f => f.name === fileToRemove.name)
      if (index !== -1) {
        files.value.splice(index, 1)
      }
    }
  }

  return {
    handleClearAll,
    handleRemoveFile
  }
}
