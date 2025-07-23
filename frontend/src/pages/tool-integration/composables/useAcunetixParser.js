import { ref, computed } from 'vue'
import { Notify } from 'quasar'
import { $t } from '@/boot/i18n'
import AcunetixParser from '@/services/parsers/acunetix-parser'
import { useFileHandling } from './useFileHandling'
import { useVulnerabilityImport } from './useVulnerabilityImport'

/**
 * Composable for Acunetix parsing functionality
 */
export function useAcunetixParser() {
  const parsedVulnerabilities = ref([])
  const selectedVulnerabilities = ref([])
  const debugInfo = ref([])
  const parsing = ref(false)
  const totalVulnerabilities = ref(0)
  const totalOriginalFindings = ref(0)  // Track original count before merging
  const fileFindingsMap = ref({})
  
  const {
    files: acunetixFiles,
    addFiles,
    removeFile,
    clearFiles
  } = useFileHandling(['.xml', '.json'], parseAllFiles)
  
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
    files: acunetixFiles.value,
    acceptedFormats: ['.xml', '.json'],
    title: $t('toolIntegration.acunetix.dragDropTitle'),
    subtitle: $t('toolIntegration.acunetix.dragDropSubtitle'),
    supportedFormats: $t('toolIntegration.acunetix.supportedFormats')
  }))
  
  async function parseAllFiles() {
    if (acunetixFiles.value.length === 0) {
      Notify.create({
        message: $t('toolIntegration.acunetix.noFileSelected'),
        color: 'warning',
        position: 'top-right'
      })
      return
    }

    parsing.value = true
    
    try {
      // SINGLE database call at the beginning (following Nessus pattern)
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
      
      // Parse each file separately to track findings by file (following Nessus pattern)
      const fileResults = {}
      const allFindings = []
      
      for (const file of acunetixFiles.value) {
        console.log(`Parsing file: ${file.name}`)
        const parser = new AcunetixParser(null, [file], false, true) // merge=false for individual file parsing
        await parser.parse()
        
        // Store findings for this specific file
        fileFindingsMap.value[file.name] = parser.findings
        fileResults[file.name] = parser.findings
        
        // Add to all findings for merging
        allFindings.push(...parser.findings)
      }
      
      // Create merged findings (following Nessus pattern but also handle intra-file duplicates)
      console.log('Merging findings (both intra-file and cross-file)...')
      // Group ALL findings by title for merging (regardless of file count)
      const titleGroups = {}
      for (const finding of allFindings) {
        if (!titleGroups[finding.title]) {
          titleGroups[finding.title] = []
        }
        titleGroups[finding.title].push(finding)
      }
      
      const mergedFindings = []
      for (const [title, findings] of Object.entries(titleGroups)) {
        if (findings.length === 1) {
          mergedFindings.push(findings[0])
        } else {
          // Merge findings with same title using Acunetix-specific logic
          const merged = _mergeAcunetixFindingsGroup(findings)
          merged.allOriginalFindings = findings
          mergedFindings.push(merged)
        }
      }
      
      console.log(`Total findings after merging: ${mergedFindings.length}`)
      console.log(`Original findings before merging: ${allFindings.length}`)
      
      // Track counts
      totalOriginalFindings.value = allFindings.length
      
      // Get database values for preview - PASS the DB data (following Nessus pattern)
      const previewFindings = await _getDatabaseValuesForPreview(mergedFindings, allDBVulns)
      parsedVulnerabilities.value = previewFindings
      
      // Sort by CVSS score in descending order (following Nessus pattern)
      parsedVulnerabilities.value.sort((a, b) => {
        const aScore = a.cvssScore || 0
        const bScore = b.cvssScore || 0
        return bScore - aScore
      })
      
      selectedVulnerabilities.value = [...parsedVulnerabilities.value]
      totalVulnerabilities.value = parsedVulnerabilities.value.length
      
      // Generate debug info - PASS the DB data (following Nessus pattern)
      await generateDebugInfo(fileResults, allDBVulns)
      
      Notify.create({
        message: $t('toolIntegration.acunetix.parseSuccess', { 
          unique: parsedVulnerabilities.value.length, 
          total: totalOriginalFindings.value 
        }),
        color: 'positive',
        position: 'top-right'
      })
      
    } catch (error) {
      console.error('Acunetix parsing error:', error)
      Notify.create({
        message: $t('toolIntegration.acunetix.parseError') + ': ' + error.message,
        color: 'negative',
        position: 'top-right'
      })
    } finally {
      parsing.value = false
    }
  }
  
  // Merge findings group for Acunetix (similar to Nessus pattern but with Acunetix-specific logic)
  function _mergeAcunetixFindingsGroup(findings) {
    const merged = {...findings[0]}
    const allHosts = []
    const allScopes = []
    const allUrls = []
    
    for (const finding of findings) {
      // Collect hosts
      if (finding.scope) {
        allScopes.push(...finding.scope.split(', '))
      }
      
      // Collect URLs from POC or other fields
      if (finding.url) {
        allUrls.push(finding.url)
      }
      
      // Extract hosts from URLs
      if (finding.url) {
        try {
          const urlObj = new URL(finding.url)
          allHosts.push(urlObj.hostname)
        } catch (e) {
          // If URL parsing fails, use the whole URL
          allHosts.push(finding.url)
        }
      }
    }
    
    // Update merged finding
    const uniqueHosts = [...new Set(allHosts)]
    const uniqueScopes = [...new Set(allScopes)]
    const uniqueUrls = [...new Set(allUrls)]
    
    if (uniqueScopes.length > 0) {
      merged.scope = uniqueScopes.join(', ')
    }
    
    // Create POC with all URLs (Acunetix-specific)
    if (uniqueUrls.length > 0) {
      merged.poc = uniqueUrls.map(url => `<li>${url}</li>`).join('\n')
      if (uniqueUrls.length > 1) {
        merged.poc = 'Affected URLs:\n' + merged.poc
      }
    }
    
    return merged
  }
  
  // Generate debug info (following Nessus pattern)
  async function generateDebugInfo(fileResults, allDBVulns) {
    try {
      console.log('generateDebugInfo - using passed DB vulns:', allDBVulns.length)

      const debugInfoArray = []
      let hasNewVulns = false

      // Check each file's findings individually
      for (const file of acunetixFiles.value) {
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
  
  // Get database values for preview (following Nessus pattern)
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
          console.log(`Database CVSS data for "${finding.title}":`, {
            cvssv3: vulnFromDB.cvssv3,
            cvssScore: vulnFromDB.cvssScore,
            severity: vulnFromDB.severity
          })
          
          // Try to get CVSS score from vector first, fallback to stored score
          let cvssScore = _convertCvssVectorToScore(vulnFromDB.cvssv3)
          if (cvssScore === null && vulnFromDB.cvssScore !== undefined && vulnFromDB.cvssScore !== null) {
            cvssScore = parseFloat(vulnFromDB.cvssScore)
            console.log(`Using fallback cvssScore from database: ${cvssScore}`)
          }
          
          const severity = _cvssScoreToSeverity(cvssScore)
          console.log(`Final CVSS data for "${finding.title}":`, {cvssScore, severity})
          
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
          // NOT found in database - clear any CVSS/severity from Acunetix file
          console.log(`NOT found in DB - clearing CVSS/severity for "${finding.title}"`)
          const clearedFinding = {
            ...finding,
            cvssv3: null,      // Override Acunetix value
            cvssScore: null,   // Override Acunetix value
            severity: null,    // Override Acunetix value
            category: null,    // Override Acunetix value
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
  
  // Database lookup function (following Nessus pattern)
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
  
  // CVSS conversion functions (following Nessus pattern)
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
  
  // Convert CVSS score to severity string (following Nessus pattern)
  function _cvssScoreToSeverity(cvssScore) {
    if (cvssScore === null || cvssScore === undefined || isNaN(cvssScore)) {
      return 'Low'
    }
    
    const severity = CVSS31.severityRating(cvssScore) || 'Low'
    return severity
  }
  
  async function importSelected() {
    if (selectedVulnerabilities.value.length === 0) {
      Notify.create({
        message: $t('toolIntegration.acunetix.noVulnerabilities'),
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
      
      console.log('ACUNETIX IMPORT DEBUG:')
      console.log('Selected vulnerabilities count:', selectedVulnerabilities.value.length)
      console.log('Selected vulnerabilities sample:', selectedVulnerabilities.value.slice(0, 2).map(v => ({
        title: v.title,
        originalFinding: Array.isArray(v.originalFinding) ? `Array[${v.originalFinding.length}]` : typeof v.originalFinding
      })))
      console.log('Extracted original findings count:', originalFindings.length)
      console.log('Original findings sample:', originalFindings.slice(0, 2).map(f => ({ title: f?.title, type: typeof f })))
      
      console.log('Importing', originalFindings.length, 'Acunetix findings to audit:', selectedAudit.value)
      
      const parser = new AcunetixParser(selectedAudit.value, acunetixFiles.value, true, false)
      const result = await parser.importSelectedFindings(originalFindings)
      
      if (result.success) {
        showImportSuccess('acunetix', result.findingsCount)
        
        // Clear selected files and reset state
        clearFiles()
        parsedVulnerabilities.value = []
        selectedVulnerabilities.value = []
        debugInfo.value = []
        totalVulnerabilities.value = 0
        totalOriginalFindings.value = 0
      } else {
        throw new Error(result.error)
      }
      
    } catch (error) {
      console.error('Acunetix import error:', error)
      showImportError('acunetix', error.message)
    } finally {
      importing.value = false
    }
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
    
    // Clear parsed data if no files
    if (acunetixFiles.value.length === 0) {
      parsedVulnerabilities.value = []
      selectedVulnerabilities.value = []
      debugInfo.value = []
      totalVulnerabilities.value = 0
      totalOriginalFindings.value = 0
    }
  }

  return {
    // State
    parsedVulnerabilities,
    selectedVulnerabilities,
    debugInfo,
    parsing,
    importing,
    totalVulnerabilities,
    totalOriginalFindings,
    fileFindingsMap,
    
    // File handling
    acunetixFiles,
    addFiles,
    removeFile,
    clearFiles,
    handleFileChange,
    handleFileRemove,
    
    // Upload area
    uploadAreaProps,
    
    // Actions
    parseAllFiles,
    importSelected,
    
    // Audit selection
    selectedAudit,
    confirmImport
  }
}
