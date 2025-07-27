import { ref, computed } from 'vue'
import { Notify } from 'quasar'
import { $t } from '@/boot/i18n'
import PowerUpSQLParser from '@/services/parsers/powerupsql-parser'
import { useFileHandling } from './useFileHandling'
import { useVulnerabilityImport } from './useVulnerabilityImport'

/**
 * Composable for PowerUpSQL parsing functionality
 */
export function usePowerUpSQLParser() {
  const parsedVulnerabilities = ref([])
  const selectedVulnerabilities = ref([])
  const debugInfo = ref([])
  const parsing = ref(false)
  const totalVulnerabilities = ref(0)
  const fileFindingsMap = ref({})
  
  const {
    files: powerUpSQLFiles,
    addFiles,
    removeFile,
    clearFiles
  } = useFileHandling(['.csv'], parseAllFiles)
  
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
    files: powerUpSQLFiles.value,
    acceptedFormats: ['.csv'],
    title: $t('toolIntegration.powerupsql.dragDropTitle'),
    subtitle: $t('toolIntegration.powerupsql.dragDropSubtitle'),
    supportedFormats: $t('toolIntegration.powerupsql.supportedFormats')
  }))
  
  async function parseAllFiles() {
    if (powerUpSQLFiles.value.length === 0) {
      Notify.create({
        message: $t('toolIntegration.powerupsql.noFileSelected'),
        color: 'warning',
        position: 'top-right'
      })
      return
    }

    parsing.value = true
    
    try {
      // SINGLE database call at the beginning
      const VulnerabilityService = (await import('@/services/vulnerability')).default
      console.log('Making database call to get vulnerabilities...')
      
      const response = await VulnerabilityService.getVulnerabilities()
      const allDBVulns = response.data.datas || []
      console.log('Database call completed. Total vulnerabilities:', allDBVulns.length)

      // Clear existing data
      parsedVulnerabilities.value = []
      selectedVulnerabilities.value = []
      fileFindingsMap.value = {}
      totalVulnerabilities.value = 0
      
      // Parse each file separately to track findings by file
      const fileResults = {}
      const allFindings = []
      
      for (const file of powerUpSQLFiles.value) {
        const parser = new PowerUpSQLParser(null, [file], false, true) // merge=false for individual file parsing
        await parser.parse()
        
        // Store findings for this specific file
        fileFindingsMap.value[file.name] = parser.findings
        fileResults[file.name] = parser.findings
        
        // Add to all findings for merging
        allFindings.push(...parser.findings)
      }
      
      // Create merged findings using PowerUpSQL's custom merging logic
      let mergedFindings = allFindings
      if (allFindings.length > 0) {
        // Use PowerUpSQL's custom merging logic
        const parser = new PowerUpSQLParser(null, [], true, true)
        mergedFindings = parser._mergePowerUpSQLVulnGroup(allFindings)
      }
      
      // Get database values for preview - PASS the DB data
      const previewFindings = await _getDatabaseValuesForPreview(mergedFindings, allDBVulns)
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
      
      // Generate debug info - PASS the DB data
      await generateDebugInfo(fileResults, allDBVulns)
      
      Notify.create({
        message: `Successfully parsed ${powerUpSQLFiles.value.length} file(s) with ${parsedVulnerabilities.value.length} unique vulnerabilities`,
        color: 'positive',
        position: 'top-right'
      })
      
    } catch (error) {
      console.error('Error parsing files:', error)
      Notify.create({
        message: error.message || 'Error parsing files',
        color: 'negative',
        position: 'top-right'
      })
    } finally {
      parsing.value = false
    }
  }
  
  // Update generateDebugInfo to use passed DB data
  async function generateDebugInfo(fileResults, allDBVulns) {
    try {
      console.log('generateDebugInfo - using passed DB vulns:', allDBVulns.length)

      const debugInfoArray = []
      let hasNewVulns = false

      // Check each file's findings individually
      for (const file of powerUpSQLFiles.value) {
        const fileFindings = fileResults[file.name] || []
        const newVulnsForFile = []
        
        console.log(`Checking file ${file.name} with ${fileFindings.length} findings`)
        
        // Check each finding in this file to see if it's new to database
        for (const finding of fileFindings) {
          console.log(`Checking finding: "${finding.title}"`)
          
          // Use the SAME DB data that was used for preview
          const vulnFromDB = _getVulnFromPwndocDBByTitle(finding.title, allDBVulns)
          const isNewVuln = !vulnFromDB
          
          console.log(`Finding "${finding.title}" - In DB: ${!!vulnFromDB}`)
          
          if (isNewVuln) {
            newVulnsForFile.push(finding.title)
            console.log(`NEW VULNERABILITY FOUND: "${finding.title}"`)
          }
        }
        
        if (newVulnsForFile.length > 0) {
          debugInfoArray.push(`📄 ${file.name}:`)
          debugInfoArray.push(...newVulnsForFile.map(title => `  • ${title}`))
          hasNewVulns = true
        } else {
          debugInfoArray.push(`📄 ${file.name}: No new vulnerabilities`)
        }
      }

      debugInfo.value = hasNewVulns
        ? ['New vulnerabilities by file:', ...debugInfoArray]
        : ['File analysis:', ...debugInfoArray]
        
    } catch (error) {
      console.error('Error generating debug info:', error)
      debugInfo.value = ['Error generating debug information']
    }
  }
  
  async function _getDatabaseValuesForPreview(findings, allDBVulns) {
    try {
      console.log('_getDatabaseValuesForPreview - Processing', findings.length, 'findings with', allDBVulns.length, 'DB vulnerabilities')
      const previewFindings = []
      
      for (const finding of findings) {
        console.log(`Processing finding: "${finding.title}"`)
        console.log('Finding original CVSS:', finding.cvssScore, 'Severity:', finding.severity)
        
        const vulnFromDB = _getVulnFromPwndocDBByTitle(finding.title, allDBVulns)
        console.log(`Database lookup result for "${finding.title}":`, !!vulnFromDB)
        
        if (vulnFromDB) {
          // Found in database - use database values
          console.log(`Found in DB - using database values for "${finding.title}"`)
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
          console.log(`DB Preview result for "${finding.title}":`, {cvssScore, severity})
          previewFindings.push(previewFinding)
        } else {
          // NOT found in database - clear any CVSS/severity from PowerUpSQL file
          console.log(`NOT found in DB - clearing CVSS/severity for "${finding.title}"`)
          const clearedFinding = {
            ...finding,
            cvssv3: null,      // Override PowerUpSQL value
            cvssScore: null,   // Override PowerUpSQL value
            severity: null,    // Override PowerUpSQL value
            category: null,    // Override PowerUpSQL value
            originalFinding: finding.allOriginalFindings || [finding]
          }
          console.log(`Cleared Preview result for "${finding.title}":`, {cvssScore: clearedFinding.cvssScore, severity: clearedFinding.severity})
          previewFindings.push(clearedFinding)
        }
      }
      
      return previewFindings
    } catch (error) {
      console.error('Error getting database values for preview:', error)
      return findings.map(finding => ({
        ...finding,
        cvssScore: null,
        originalFinding: finding
      }))
    }
  }
  
  function _getVulnFromPwndocDBByTitle(title, allVulns) {
    if (!title || !allVulns || allVulns.length === 0) {
      console.log(`_getVulnFromPwndocDBByTitle: Invalid params - title: "${title}", vulns: ${allVulns?.length || 0}`)
      return null
    }
    
    console.log(`_getVulnFromPwndocDBByTitle: Searching for "${title}" in ${allVulns.length} vulnerabilities`)
    
    const found = allVulns.find(vuln => {
      if (!vuln.details || !Array.isArray(vuln.details)) {
        return false
      }
      
      return vuln.details.some(detail => {
        if (!detail || !detail.title) {
          return false
        }
        
        // Exact match (case-sensitive)
        if (detail.title === title) {
          console.log(`EXACT MATCH found: "${title}" === "${detail.title}"`)
          return true
        }
        
        // Case-insensitive match as fallback
        if (detail.title.toLowerCase() === title.toLowerCase()) {
          console.log(`CASE-INSENSITIVE MATCH found: "${title}" ~= "${detail.title}"`)
          return true
        }
        
        return false
      })
    })
    
    console.log(`_getVulnFromPwndocDBByTitle result for "${title}":`, !!found)
    return found || null
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
    
    console.log(`Removed file ${result.removedFile.name}, remaining files: ${result.remainingCount}`)
  }
  
  const importVulnerabilities = async (q, auditOptions) => {
    try {
      const confirmed = await confirmImport(q, selectedVulnerabilities.value, auditOptions, selectedAudit.value)
      if (!confirmed) return
      
      importing.value = true
      
      const allOriginalFindings = extractOriginalFindings(selectedVulnerabilities.value)
      
      // Create a parser with merge = true to handle POC creation properly
      const parser = new PowerUpSQLParser(selectedAudit.value, [], true, false)
      
      // Import all original findings and let the parser handle merging
      const result = await parser.importSelectedFindings(allOriginalFindings)
      
      if (result.success) {
        showImportSuccess('powerupsql', result.findingsCount)
      } else {
        throw new Error(result.error)
      }
      
      // Clear selections after successful import
      selectedVulnerabilities.value = []
      
    } catch (error) {
      showImportError(error)
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
    fileFindingsMap.value = {}
    debugInfo.value = []
  }
  
  return {
    // State
    powerUpSQLFiles,
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
