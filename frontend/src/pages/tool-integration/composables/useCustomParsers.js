import { ref, computed } from 'vue'
import { Notify } from 'quasar'
import { $t } from '@/boot/i18n'
import { customVulnRegistry } from '@/services/custom-vulnerability-registry'
import { useVulnerabilityImport } from './useVulnerabilityImport'

export function useCustomParsers(settings = null) {
  const selectedFiles = ref([])
  const availableParsers = ref([])
  const selectedParsers = ref([])
  const parseResults = ref([])
  const parsing = ref(false)
  const analyzing = ref(false)
  
  const {
    importing,
    selectedAudit,
    confirmImport,
    extractOriginalFindings,
    showImportSuccess,
    showImportError
  } = useVulnerabilityImport()

  const uploadAreaProps = computed(() => ({
    acceptedFormats: ['*'],
    title: $t('toolIntegration.custom.dragDropTitle'),
    subtitle: $t('toolIntegration.custom.dragDropSubtitle'),
    supportedFormats: $t('toolIntegration.custom.supportedFormats'),
    files: selectedFiles.value
  }))

  const canExecuteParsers = computed(() => 
    availableParsers.value.filter(parser => parser.matchingFiles)
  )

  const allFindings = computed(() => {
    return parseResults.value
      .filter(result => result.success)
      .flatMap(result => result.findings || [])
  })

  const selectedVulnerabilities = computed(() => {
    return allFindings.value // Auto-select all findings
  })

  /**
   * Add files and analyze what parsers can be executed
   */
  async function addFiles(files) {
    // Add new files to existing ones instead of replacing
    const newFiles = Array.from(files)
    const existingFileNames = new Set(selectedFiles.value.map(f => f.name))
    
    // Only add files that aren't already in the list
    const uniqueNewFiles = newFiles.filter(file => !existingFileNames.has(file.name))
    
    if (uniqueNewFiles.length > 0) {
      selectedFiles.value = [...selectedFiles.value, ...uniqueNewFiles]
      await analyzeAvailableParsers()
    }
  }

  /**
   * Clear all files and reset state
   */
  function clearAllFiles() {
    selectedFiles.value = []
    availableParsers.value = []
    parseResults.value = []
    window.fileClassificationResult = {
      classified: {},
      matched: [],
      unmatched: [],
      summary: { totalFiles: 0, matchedCount: 0, unmatchedCount: 0 }
    }
  }

  /**
   * Remove a specific file
   */
  async function removeFile(fileToRemove) {
    selectedFiles.value = selectedFiles.value.filter(file => file.name !== fileToRemove.name)
    if (selectedFiles.value.length > 0) {
      await analyzeAvailableParsers()
    } else {
      clearAllFiles()
    }
  }

  /**
   * Get file content preview for analysis
   */
  async function getFilePreview(file, maxSize = 1024) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result.substring(0, maxSize))
      reader.onerror = () => resolve('')
      
      const slice = file.slice(0, maxSize)
      reader.readAsText(slice)
    })
  }

  /**
   * Analyze which custom parsers can be executed with current files
   */
  async function analyzeAvailableParsers() {
    if (selectedFiles.value.length === 0) {
      availableParsers.value = []
      return
    }

    analyzing.value = true
    console.log(`🔍 Analyzing ${selectedFiles.value.length} files for classification...`)
    
    try {
      // Add basic file info and content preview for analysis
      const filesWithInfo = await Promise.all(
        selectedFiles.value.map(async (file) => ({
          ...file,
          name: file.name,
          size: file.size,
          type: file.type,
          contentSample: await getFilePreview(file, 2048) // Increased sample size for better detection
        }))
      )

      // Use new getClassifiedFiles method for file recognition only
      const classificationResult = await customVulnRegistry.getClassifiedFiles(filesWithInfo)
      
      // Store classification results for UI display
      availableParsers.value = [] // No parsers for now - focusing on file recognition
      
      // Store file classification results for UI
      window.fileClassificationResult = classificationResult
      
      console.log(`✅ File Classification Complete:`)
      console.log(`  📄 Total files: ${classificationResult.summary.totalFiles}`)
      console.log(`  ✅ Matched: ${classificationResult.summary.matchedCount}`)  
      console.log(`  ❓ Unmatched: ${classificationResult.summary.unmatchedCount}`)
      
      if (classificationResult.summary.matchedCount > 0) {
        Notify.create({
          message: `File recognition complete: ${classificationResult.summary.matchedCount} files matched, ${classificationResult.summary.unmatchedCount} unmatched`,
          color: 'positive',
          position: 'top-right'
        })
      } else {
        Notify.create({
          message: 'No files matched known types - manual classification may be needed',
          color: 'info',  
          position: 'top-right'
        })
      }
      
    } catch (error) {
      console.error('File analysis failed:', error)
      Notify.create({
        message: `File analysis failed: ${error.message}`,
        color: 'negative',
        position: 'top-right'
      })
    } finally {
      analyzing.value = false
    }
  }

  /**
   * Execute selected custom parsers
   */
  async function executeSelectedParsers() {
    if (selectedParsers.value.length === 0) {
      Notify.create({
        message: 'No custom parsers selected',
        color: 'warning',
        position: 'top-right'
      })
      return
    }

    parsing.value = true
    parseResults.value = []

    try {
      for (const parserName of selectedParsers.value) {
        const parserConfig = availableParsers.value.find(p => p.name === parserName)
        if (!parserConfig) continue

        console.log(`Executing custom parser: ${parserConfig.displayName}`)

        try {
          // Get matching files for this parser
          const matchingFiles = Object.values(parserConfig.matchingFiles).flat()
          
          // Dynamically import the parser class
          const parserClassName = parserConfig.parserClass
            .replace(/([A-Z])/g, '-$1') // Insert dashes before capital letters
            .toLowerCase()
            .replace(/^-/, '') // Remove leading dash
          const parserModule = await import(`@/services/parsers/custom/${parserClassName}.js`)
          const ParserClass = parserModule.default

          // Create and execute parser
          const parser = new ParserClass(null, matchingFiles, true, true, settings)
          const findings = await parser.parseFiles(matchingFiles)

          parseResults.value.push({
            parserName,
            displayName: parserConfig.displayName,
            success: true,
            findingsCount: findings.length,
            findings,
            matchingFiles: matchingFiles.map(f => f.name),
            executionTime: Date.now()
          })

          console.log(`Custom parser ${parserConfig.displayName} completed: ${findings.length} findings`)

        } catch (error) {
          console.error(`Custom parser ${parserConfig.displayName} failed:`, error)
          parseResults.value.push({
            parserName,
            displayName: parserConfig.displayName,
            success: false,
            error: error.message,
            findings: [],
            matchingFiles: []
          })

          Notify.create({
            message: `Parser "${parserConfig.displayName}" failed: ${error.message}`,
            color: 'negative',
            position: 'top-right'
          })
        }
      }

      const totalFindings = parseResults.value.reduce((sum, result) => 
        sum + (result.findings?.length || 0), 0)

      if (totalFindings > 0) {
        Notify.create({
          message: `Custom parsing completed: ${totalFindings} vulnerabilities found`,
          color: 'positive',
          position: 'top-right'
        })
      } else {
        Notify.create({
          message: 'Custom parsing completed: No vulnerabilities found',
          color: 'info',
          position: 'top-right'
        })
      }

    } catch (error) {
      console.error('Custom parsing failed:', error)
      Notify.create({
        message: `Custom parsing failed: ${error.message}`,
        color: 'negative',
        position: 'top-right'
      })
    } finally {
      parsing.value = false
    }
  }

  /**
   * Import all findings from successful parse results
   */
  async function importAllSelected() {
    const findings = allFindings.value
    
    if (findings.length === 0) {
      Notify.create({
        message: 'No vulnerabilities to import',
        color: 'warning',
        position: 'top-right'
      })
      return
    }

    if (!selectedAudit.value) {
      Notify.create({
        message: 'Please select an audit first',
        color: 'warning',
        position: 'top-right'
      })
      return
    }

    try {
      importing.value = true
      
      // Use base parser for import (since custom parsers extend BaseParser)
      const BaseParser = (await import('@/services/base-parser')).default
      const parser = new BaseParser(selectedAudit.value, [], true, false)
      
      // Import findings directly
      const result = await parser.importSelectedFindings(findings)
      
      if (result.success) {
        showImportSuccess('custom', result.findingsCount)
        
        // Clear results after successful import
        parseResults.value = []
        
        console.log('Custom parser import completed successfully')
      } else {
        throw new Error(result.error || 'Import failed')
      }
      
    } catch (error) {
      console.error('Custom parser import failed:', error)
      showImportError(error.message)
    } finally {
      importing.value = false
    }
  }

  return {
    // State
    selectedFiles,
    availableParsers,
    canExecuteParsers,
    selectedParsers,
    parseResults,
    parsing,
    analyzing,
    importing,
    selectedAudit,
    uploadAreaProps,
    
    // Computed
    allFindings,
    selectedVulnerabilities,
    
    // Functions
    addFiles,
    removeFile,
    clearAllFiles,
    analyzeAvailableParsers,
    executeSelectedParsers,
    importAllSelected
  }
}
