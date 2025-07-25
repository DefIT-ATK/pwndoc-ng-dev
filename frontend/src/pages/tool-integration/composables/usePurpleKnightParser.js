import { ref, computed } from 'vue'
import { Notify } from 'quasar'
import { $t } from '@/boot/i18n'
import PurpleKnightParser from '@/services/parsers/purpleknight-parser'
import { useFileHandling } from './useFileHandling'
import { useVulnerabilityImport } from './useVulnerabilityImport'

/**
 * Composable for PurpleKnight parsing functionality
 */
export function usePurpleKnightParser(settings = null) {
  const parsedVulnerabilities = ref([])
  const selectedVulnerabilities = ref([])
  const debugInfo = ref([])
  const parsing = ref(false)
  const totalVulnerabilities = ref(0)
  const totalOriginalFindings = ref(0)
  const fileFindingsMap = ref({})
  
  const {
    files: purpleknightFiles,
    addFiles,
    removeFile,
    clearFiles
  } = useFileHandling(['.xlsx', '.xls'], parseAllFiles)
  
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
    files: purpleknightFiles.value,
    acceptedFormats: ['.xlsx', '.xls'],
    title: $t('toolIntegration.purpleknight.dragDropTitle'),
    subtitle: $t('toolIntegration.purpleknight.dragDropSubtitle'),
    supportedFormats: $t('toolIntegration.purpleknight.supportedFormats')
  }))
  
  async function parseAllFiles() {
    if (purpleknightFiles.value.length === 0) {
      Notify.create({
        message: $t('toolIntegration.purpleknight.noFileSelected'),
        color: 'warning',
        position: 'top-right'
      })
      return
    }

    parsing.value = true
    parsedVulnerabilities.value = []
    selectedVulnerabilities.value = []
    debugInfo.value = []
    fileFindingsMap.value = {}
    totalOriginalFindings.value = 0

    try {
      // SINGLE database call at the beginning (following guide pattern)
      console.log('Making database call to get vulnerabilities...')
      const VulnerabilityService = (await import('@/services/vulnerability')).default
      const response = await VulnerabilityService.getVulnerabilities()
      const allDBVulns = response.data.datas
      console.log('Database vulnerabilities loaded:', allDBVulns.length)
      
      // Log sample database titles for debugging
      console.log('Sample database vulnerability titles:', 
        allDBVulns.slice(0, 10).map(v => v.title).filter(t => t)
      )

      // Parse each file separately to track findings by file (following guide pattern)
      const allFindings = []
      
      // Get PurpleKnight settings to pass to parser
      const purpleknightSettings = settings?.toolIntegrations?.purpleknight
      console.log('PurpleKnight settings used by parser:', purpleknightSettings)
      
      for (const file of purpleknightFiles.value) {
        try {
          console.log(`Parsing PurpleKnight file: ${file.name}`)
          
          const parser = new PurpleKnightParser(null, [], true, false, purpleknightSettings)
          const findings = await parser.parseFile(file)
          
          // Track findings per file
          fileFindingsMap.value[file.name] = findings.length
          totalOriginalFindings.value += findings.length
          
          allFindings.push(...findings)
          
          console.log(`Parsed ${findings.length} findings from ${file.name}`)
          
          // Log sample finding titles for debugging
          if (findings.length > 0) {
            console.log('Sample parsed finding titles:', 
              findings.slice(0, 5).map(f => f.title)
            )
          }
        } catch (error) {
          console.error(`Error parsing ${file.name}:`, error)
          debugInfo.value.push(`⚠️ Failed to parse ${file.name}: ${error.message}`)
        }
      }

      // Create merged findings (following guide pattern but handle intra-file duplicates)
      const mergedFindings = _mergeDuplicateFindings(allFindings)
      console.log(`Merged ${allFindings.length} findings into ${mergedFindings.length} unique findings`)

      if (mergedFindings.length === 0) {
        debugInfo.value.push('⚠️ No IOE Found findings detected in the PurpleKnight files')
        debugInfo.value.push('  Only findings with Status="IOE Found" are imported as vulnerabilities')
        return
      }

      // Get database values for preview - PASS the DB data (following guide pattern)
      const previewFindings = await _getDatabaseValuesForPreview(mergedFindings, allDBVulns)

      // Sort by CVSS score in descending order (following guide pattern)
      previewFindings.sort((a, b) => {
        const aScore = a.cvssScore || 0
        const bScore = b.cvssScore || 0
        return bScore - aScore
      })

      parsedVulnerabilities.value = previewFindings
      totalVulnerabilities.value = previewFindings.length

      // Auto-select all findings (following guide pattern)
      selectedVulnerabilities.value = [...previewFindings]

      // Generate debug info - PASS the DB data (following guide pattern)
      _generateDebugInfo(mergedFindings, allDBVulns)

      console.log(`PurpleKnight parsing completed: ${previewFindings.length} findings ready for import`)

    } catch (error) {
      console.error('PurpleKnight parsing failed:', error)
      Notify.create({
        message: `Failed to parse PurpleKnight files: ${error.message}`,
        color: 'negative',
        position: 'top-right'
      })
    } finally {
      parsing.value = false
    }
  }

  // Merge duplicate findings based on title (following guide pattern)
  function _mergeDuplicateFindings(findings) {
    const findingMap = new Map()
    
    for (const finding of findings) {
      const key = finding.title
      
      if (findingMap.has(key)) {
        const existing = findingMap.get(key)
        // Merge scope arrays
        const combinedScope = [...new Set([...existing.scope, ...finding.scope])]
        existing.scope = combinedScope
        
        // Combine POCs
        if (finding.poc && finding.poc !== existing.poc) {
          existing.poc += `<br><br><strong>Additional Evidence:</strong><br>${finding.poc}`
        }
      } else {
        findingMap.set(key, { ...finding })
      }
    }
    
    return Array.from(findingMap.values())
  }

  // Generate debug info (following guide pattern)
  function _generateDebugInfo(findings, allDBVulns) {
    debugInfo.value = []
    
    // Files parsing summary  
    const filesSummary = Object.entries(fileFindingsMap.value)
      .map(([fileName, count]) => `📄 ${fileName}: ${count} findings`)
    
    debugInfo.value.push('File analysis:')
    debugInfo.value.push(...filesSummary)
    
    // Database matching summary
    const matchedCount = findings.filter(f => 
      _getVulnFromPwndocDBByTitle(f.title, allDBVulns) !== null
    ).length
    
    debugInfo.value.push('')
    debugInfo.value.push(`Database matching: ${matchedCount}/${findings.length} findings found in database`)
    if (matchedCount < findings.length) {
      debugInfo.value.push('  New findings will be added to the database during import')
    } else {
      debugInfo.value.push('  All findings already exist in database')
    }
  }

  // Get database values for preview (following guide pattern)
  async function _getDatabaseValuesForPreview(findings, allDBVulns) {
    const previewFindings = []
    
    for (const finding of findings) {
      console.log('Processing finding:', {
        title: finding.title,
        originalCVSS: finding.cvssScore,
        severity: finding.severity
      })
      
      // Look for existing vulnerability in database (following Nessus pattern)
      const vulnFromDB = _getVulnFromPwndocDBByTitle(finding.title, allDBVulns)
      
      console.log('Database match result:', vulnFromDB ? 'FOUND' : 'NOT FOUND')
      
      if (vulnFromDB) {
        console.log(`Database CVSS data for "${finding.title}":`, {
          cvssv3: vulnFromDB.cvssv3,
          cvssScore: vulnFromDB.cvssScore,
          severity: vulnFromDB.severity
        })
        
        // Use database CVSS values directly (like Nessus parser)
        const cvssScore = _convertCvssVectorToScore(vulnFromDB.cvssv3)
        const severity = _cvssScoreToSeverity(cvssScore)
        
        console.log(`Using database values - CVSS: ${cvssScore}, Severity: ${severity}`)
        
        previewFindings.push({
          ...finding,
          // Use database values 
          description: vulnFromDB.description || finding.description,
          remediation: vulnFromDB.remediation || finding.remediation,
          cvssv3: vulnFromDB.cvssv3,
          cvssScore: cvssScore,
          severity: severity,
          category: vulnFromDB.category || finding.category,
          // Keep PurpleKnight-specific data
          vulnType: finding.vulnType,
          scope: finding.scope,
          poc: finding.poc,
          // Reference to database vulnerability
          databaseVuln: vulnFromDB
        })
      } else {
        // New vulnerability - use parsed values
        const severity = _cvssScoreToSeverity(finding.cvssScore)
        
        previewFindings.push({
          ...finding,
          severity: severity,
          databaseVuln: null
        })
      }
    }
    
    return previewFindings
  }

  // CVSS conversion (use CVSS31 global library)
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
  
  async function importSelected() {
    if (selectedVulnerabilities.value.length === 0) {
      Notify.create({
        message: $t('toolIntegration.purpleknight.noVulnerabilities'),
        color: 'warning',
        position: 'top-right'
      })
      return
    }

    if (!selectedAudit.value) {
      Notify.create({
        message: $t('toolIntegration.auditSelection.noAuditSelected'),
        color: 'warning',
        position: 'top-right'
      })
      return
    }

    importing.value = true

    try {
      // Extract original findings from selected vulnerabilities
      const originalFindings = extractOriginalFindings(selectedVulnerabilities.value)
      
      console.log('PURPLEKNIGHT IMPORT DEBUG:')
      console.log('Selected vulnerabilities count:', selectedVulnerabilities.value.length)
      console.log('Original findings count:', originalFindings.length)
      console.log('Target audit ID:', selectedAudit.value)

      // Get PurpleKnight settings to pass to parser
      const purpleknightSettings = settings?.toolIntegrations?.purpleknight

      // Create parser instance and import
      const parser = new PurpleKnightParser(selectedAudit.value, [], true, false, purpleknightSettings)
      const result = await parser.importSelectedFindings(originalFindings)
      
      if (result.success) {
        showImportSuccess('purpleknight', result.findingsCount)
        
        // Clear selections after successful import
        selectedVulnerabilities.value = []
        
        console.log('PurpleKnight import completed successfully')
      } else {
        throw new Error(result.error || 'Import failed')
      }
      
    } catch (error) {
      console.error('PurpleKnight import failed:', error)
      showImportError(error.message)
    } finally {
      importing.value = false
    }
  }

  const handleFileChange = (newFiles) => {
    addFiles(newFiles)
  }

  const handleFileRemove = (index) => {
    const result = removeFile(index)
    
    // Clean up file-specific data
    if (fileFindingsMap.value[result.removedFile.name]) {
      delete fileFindingsMap.value[result.removedFile.name]
    }
    
    // Clear everything if no files left
    if (result.remainingCount === 0) {
      parsedVulnerabilities.value = []
      selectedVulnerabilities.value = []
      debugInfo.value = []
      totalVulnerabilities.value = 0
      totalOriginalFindings.value = 0
      fileFindingsMap.value = {}
    } else if (result.removedFileProcessed) {
      // File was processed, reparse remaining files
      parseAllFiles()
    }
    
    console.log(`Removed PurpleKnight file ${result.removedFile.name}, remaining files: ${result.remainingCount}`)
  }

  return {
    // Files state
    files: purpleknightFiles,
    uploadAreaProps,
    
    // Parsing state
    parsing,
    parsedVulnerabilities,
    selectedVulnerabilities,
    totalVulnerabilities,
    totalOriginalFindings,
    debugInfo,
    
    // Import state  
    importing,
    selectedAudit,
    
    // Functions
    handleFileChange,
    handleFileRemove,
    clearFiles,
    parseAllFiles,
    importSelected
  }
}
