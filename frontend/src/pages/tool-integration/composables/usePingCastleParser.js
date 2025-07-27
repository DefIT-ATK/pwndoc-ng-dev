import { ref, computed } from 'vue'
import { Notify } from 'quasar'
import { $t } from '@/boot/i18n'
import PingCastleParser from '@/services/parsers/pingcastle-parser'
import { useFileHandling } from './useFileHandling'
import { useVulnerabilityImport } from './useVulnerabilityImport'

/**
 * Composable for PingCastle parsing functionality
 */
export function usePingCastleParser(settings = null) {
  const parsedVulnerabilities = ref([])
  const selectedVulnerabilities = ref([])
  const debugInfo = ref([])
  const parsing = ref(false)
  const totalVulnerabilities = ref(0)
  const fileFindingsMap = ref({})
  
  const {
    files: pingCastleFiles,
    addFiles,
    removeFile,
    clearFiles
  } = useFileHandling(['.xml'], parseAllFiles)
  
  const {
    importing,
    selectedAudit,
    confirmImport,
    extractOriginalFindings,
    showImportSuccess,
    showImportError
  } = useVulnerabilityImport()
  
  // Computed property for upload area props
  const uploadAreaProps = computed(() => ({
    files: pingCastleFiles.value,
    acceptedFormats: ['.xml'],
    title: $t('toolIntegration.pingcastle.dragDropTitle'),
    subtitle: $t('toolIntegration.pingcastle.dragDropSubtitle'),
    supportedFormats: $t('toolIntegration.pingcastle.supportedFormats')
  }))
  
  async function parseAllFiles() {
    if (pingCastleFiles.value.length === 0) {
      Notify.create({
        message: $t('toolIntegration.pingcastle.noFileSelected'),
        color: 'warning',
        position: 'top-right'
      })
      return
    }

    parsing.value = true
    
    try {
      // Clear existing data
      parsedVulnerabilities.value = []
      selectedVulnerabilities.value = []
      fileFindingsMap.value = {}
      totalVulnerabilities.value = 0
      
      // Get the map from global settings
      const pingcastleMap = settings?.toolIntegrations?.pingcastle?.pingcastleMap
      console.log('PingCastle map used by parser:', pingcastleMap)

      // Parse all files together with one parser to handle merging properly
      const parser = new PingCastleParser(
        null,
        pingCastleFiles.value,
        true, // merge
        true, // dryRun
        pingcastleMap
      )
      await parser.parse()

      // Generate debug info
      await generateDebugInfo(parser)

      // Store findings by file for tracking
      for (const file of pingCastleFiles.value) {
        fileFindingsMap.value[file.name] = parser.findings
      }
      
      // Use the parser's merged findings for preview
      const mergedFindings = parser.findings
      
      // Get database values for preview
      const previewFindings = await _getDatabaseValuesForPreview(mergedFindings)
      parsedVulnerabilities.value = previewFindings
      
      // Sort by CVSS score in descending order
      parsedVulnerabilities.value.sort((a, b) => {
        const aScore = a.cvssScore || 0
        const bScore = b.cvssScore || 0
        return bScore - aScore
      })
      
      // Auto-select all parsed vulnerabilities
      selectedVulnerabilities.value = [...parsedVulnerabilities.value]
      totalVulnerabilities.value = parsedVulnerabilities.value.length
      
      Notify.create({
        message: `Successfully parsed ${pingCastleFiles.value.length} PingCastle file(s) with ${parsedVulnerabilities.value.length} unique vulnerabilities`,
        color: 'positive',
        position: 'top-right'
      })
      
    } catch (error) {
      console.error('Error parsing PingCastle files:', error)
      Notify.create({
        message: error.message || 'Error parsing PingCastle files',
        color: 'negative',
        position: 'top-right'
      })
    } finally {
      parsing.value = false
    }
  }
  
  async function generateDebugInfo(parser) {
    try {
      const debugInfoArray = []
      const unmatchedRiskIds = Array.from(parser.unmatchedRiskIds || [])

      if (unmatchedRiskIds.length > 0) {
        // Show unmatched risks for all files
        for (const file of pingCastleFiles.value) {
          debugInfoArray.push(`📄 ${file.name}: Contains unmatched risks`)
        }
        debugInfoArray.push('') // Add empty line for spacing
        debugInfoArray.push('⚠️ Missing Risk Mappings:')
        debugInfoArray.push(...unmatchedRiskIds.map(riskId => `  • ${riskId}`))
        
        debugInfo.value = ['Unmatched risk IDs found:', ...debugInfoArray]
      } else {
        // Show success for all files
        for (const file of pingCastleFiles.value) {
          debugInfoArray.push(`📄 ${file.name}: All risks matched`)
        }
        
        debugInfo.value = ['File analysis:', ...debugInfoArray]
      }
    } catch (error) {
      console.error('Error generating debug info:', error)
      debugInfo.value = ['Error generating debug information']
    }
  }
  
  async function _getDatabaseValuesForPreview(findings) {
    try {
      const VulnerabilityService = (await import('@/services/vulnerability')).default
      const response = await VulnerabilityService.getVulnerabilities()
      const allPwndocDBVulns = response.data.datas || []
              
      const previewFindings = []
      
      for (const finding of findings) {
        const vulnFromDB = _getVulnFromPwndocDBByTitle(finding.title, allPwndocDBVulns)
        
        if (vulnFromDB) {
          const cvssScore = _convertCvssVectorToScore(vulnFromDB.cvssv3)
          const severity = _cvssScoreToSeverity(cvssScore)
          
          const previewFinding = {
            ...finding,
            cvssv3: cvssScore,
            cvssScore: cvssScore,
            severity: severity,
            category: vulnFromDB.category,
            originalFinding: finding.allOriginalFindings || [finding]
          }
          previewFindings.push(previewFinding)
        } else {
          previewFindings.push({
            ...finding,
            cvssScore: null,
            originalFinding: finding.allOriginalFindings || [finding]
          })
        }
      }
              
      previewFindings.sort((a, b) => {
        const aScore = a.cvssScore || 0
        const bScore = b.cvssScore || 0
        return bScore - aScore
      })
              
      return previewFindings
    } catch (error) {
      console.error('Error getting database values for PingCastle preview:', error)
      return findings.map(finding => ({
        ...finding,
        cvssScore: null,
        originalFinding: finding
      }))
    }
  }
  
  function _getVulnFromPwndocDBByTitle(title, allVulns) {
    const found = allVulns.find(vuln => 
      vuln.details.some(detail => detail.title === title)
    )     
    return found
  }
  
  function _convertCvssVectorToScore(cvssVector) {
    if (!cvssVector || typeof cvssVector !== 'string') {
      return null
    }
    
    try {
      const num = parseFloat(cvssVector)
      if (!isNaN(num)) {
        return num
      }
      
      if (cvssVector.startsWith('CVSS:3.0/') || cvssVector.startsWith('CVSS:3.1/')) {
        const result = CVSS31.calculateCVSSFromVector(cvssVector)
        
        if (result.success) {
          return parseFloat(result.baseMetricScore)
        } else {
          console.error('CVSS calculation failed:', result)
          return null
        }
      }
      
      return null
    } catch (error) {
      console.error('Error converting CVSS vector:', error)
      return null
    }
  }
  
  function _cvssScoreToSeverity(cvssScore) {
    if (cvssScore === null || cvssScore === undefined || isNaN(cvssScore)) {
      return 'None'
    }
    
    // Handle the case where CVSS score is 0 (should be "None")
    if (cvssScore === 0) {
      return 'None'
    }
    
    const severity = CVSS31.severityRating(cvssScore) || 'None'
    return severity
  }
  
  const handleFileChange = (newFiles) => {
    addFiles(newFiles)
  }
  
  const handleFileRemove = (index) => {
    const result = removeFile(index)
    
    // Remove from fileFindingsMap
    if (fileFindingsMap.value[result.removedFile.name]) {
      delete fileFindingsMap.value[result.removedFile.name]
    }
    
    // Clear everything if no files left
    if (result.remainingCount === 0) {
      parsedVulnerabilities.value = []
      selectedVulnerabilities.value = []
      totalVulnerabilities.value = 0
      fileFindingsMap.value = {}
      debugInfo.value = []
    }
    
    console.log(`Removed PingCastle file ${result.removedFile.name}, remaining files: ${result.remainingCount}`)
  }
  
  const importVulnerabilities = async (q, auditOptions) => {
    try {
      const confirmed = await confirmImport(q, selectedVulnerabilities.value, auditOptions, selectedAudit.value)
      if (!confirmed) return
      
      importing.value = true
      
      const allOriginalFindings = extractOriginalFindings(selectedVulnerabilities.value)
      
      // Create a parser with merge = true to handle POC creation properly
      const pingcastleMap = settings?.toolIntegrations?.pingcastle?.pingcastleMap
      const parser = new PingCastleParser(selectedAudit.value, [], true, false, pingcastleMap)
      
      // Import all original findings and let the parser handle merging
      const result = await parser.importSelectedFindings(allOriginalFindings)
      
      if (result.success) {
        showImportSuccess('PingCastle', result.findingsCount)
      } else {
        throw new Error(result.error)
      }
      
      // Clear selections after successful import
      selectedVulnerabilities.value = []
      
    } catch (error) {
      showImportError(error, 'PingCastle')
    } finally {
      importing.value = false
    }
  }
  
  // Custom clearFiles that also clears parsed data
  const clearAllFiles = () => {
    clearFiles()
    // Clear parsed data
    parsedVulnerabilities.value = []
    selectedVulnerabilities.value = []
    totalVulnerabilities.value = 0
    debugInfo.value = []
  }
  
  return {
    // State
    pingCastleFiles,
    parsedVulnerabilities,
    selectedVulnerabilities,
    debugInfo,
    parsing,
    importing,
    totalVulnerabilities,
    selectedAudit,
    uploadAreaProps,
    
    // Methods
    parseAllFiles,
    handleFileChange,
    handleFileRemove,
    clearFiles: clearAllFiles,
    importVulnerabilities
  }
}
