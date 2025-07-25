import { ref, computed } from 'vue'
import { Notify } from 'quasar'
import { $t } from '@/boot/i18n'
import NessusParser from '@/services/parsers/nessus-parser'
import { useFileHandling } from './useFileHandling'
import { useVulnerabilityImport } from './useVulnerabilityImport'

/**
 * Composable for Nessus parsing functionality
 */
export function useNessusParser() {
  const parsedVulnerabilities = ref([])
  const selectedVulnerabilities = ref([])
  const debugInfo = ref([])
  const parsing = ref(false)
  const totalVulnerabilities = ref(0)
  const fileFindingsMap = ref({})
  
  const {
    files: nessusFiles,
    addFiles,
    removeFile,
    clearFiles
  } = useFileHandling(['.nessus', '.xml', '.csv'], parseAllFiles)
  
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
    files: nessusFiles.value,
    acceptedFormats: ['.nessus', '.xml', '.csv'],
    title: $t('toolIntegration.nessus.dragDropTitle'),
    subtitle: $t('toolIntegration.nessus.dragDropSubtitle'),
    supportedFormats: $t('toolIntegration.nessus.supportedFormats')
  }))
  
  async function parseAllFiles() {
    if (nessusFiles.value.length === 0) {
      Notify.create({
        message: $t('toolIntegration.nessus.noFileSelected'),
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
      
      // Add cache busting parameter to ensure fresh data
      const timestamp = Date.now()
      console.log('Cache bust timestamp:', timestamp)
      
      const response = await VulnerabilityService.getVulnerabilities()
      const allDBVulns = response.data.datas || []
      console.log('Database call completed. Total vulnerabilities:', allDBVulns.length)
      console.log('Response timestamp check:', new Date().toISOString())
      
      // DEBUG: Check if the deleted vulnerability is still in the database response
      const deletedVulnCheck = allDBVulns.find(vuln => {
        if (!vuln.details || !Array.isArray(vuln.details)) return false
        return vuln.details.some(detail => 
          detail && detail.title && detail.title === "Unsupported Web Server Detection"
        )
      })
      console.log('DEBUG - "Unsupported Web Server Detection" found in DB response:', !!deletedVulnCheck)
      if (deletedVulnCheck) {
        console.log('DEBUG - Full vulnerability object:', deletedVulnCheck)
        console.log('DEBUG - Vulnerability ID:', deletedVulnCheck._id)
        console.log('DEBUG - Last updated:', deletedVulnCheck.updatedAt)
        console.log('DEBUG - Status:', deletedVulnCheck.status)
        console.log('DEBUG - Details array:', deletedVulnCheck.details)
      }

      // Clear existing data
      parsedVulnerabilities.value = []
      selectedVulnerabilities.value = []
      fileFindingsMap.value = {}
      totalVulnerabilities.value = 0
      
      // Parse each file separately to track findings by file
      const fileResults = {}
      const allFindings = []
      
      for (const file of nessusFiles.value) {
        const parser = new NessusParser(null, [file], false, true) // merge=false for individual file parsing
        await parser.parse()
        
        // Store findings for this specific file
        fileFindingsMap.value[file.name] = parser.findings
        fileResults[file.name] = parser.findings
        
        // Add to all findings for merging
        allFindings.push(...parser.findings)
      }
      
      // Create merged findings if needed
      let mergedFindings = allFindings
      if (nessusFiles.value.length > 1) {
        // Group findings by title for merging across files
        const titleGroups = {}
        for (const finding of allFindings) {
          if (!titleGroups[finding.title]) {
            titleGroups[finding.title] = []
          }
          titleGroups[finding.title].push(finding)
        }
        
        mergedFindings = []
        for (const [title, findings] of Object.entries(titleGroups)) {
          if (findings.length === 1) {
            mergedFindings.push(findings[0])
          } else {
            // Merge findings with same title
            const merged = {...findings[0]}
            const allHosts = []
            const allScopes = []
            
            for (const finding of findings) {
              if (finding.hosts) {
                allHosts.push(...finding.hosts)
              }
              if (finding.scope) {
                allScopes.push(...finding.scope.split(', '))
              }
            }
            
            // Update merged finding
            if (allHosts.length > 0) {
              merged.hosts = allHosts
              merged.poc = _createSimplePoc(allHosts)
            }
            
            if (allScopes.length > 0) {
              merged.scope = [...new Set(allScopes)].join(', ')
            }
            
            merged.allOriginalFindings = findings
            mergedFindings.push(merged)
          }
        }
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
        message: `Successfully parsed ${nessusFiles.value.length} file(s) with ${parsedVulnerabilities.value.length} unique vulnerabilities`,
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
      for (const file of nessusFiles.value) {
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
          // NOT found in database - clear any CVSS/severity from Nessus file
          console.log(`NOT found in DB - clearing CVSS/severity for "${finding.title}"`)
          const clearedFinding = {
            ...finding,
            cvssv3: null,      // Override Nessus value
            cvssScore: null,   // Override Nessus value
            severity: null,    // Override Nessus value
            category: null,    // Override Nessus value
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
  
  function _createSimplePoc(hosts) {
    if (!hosts || hosts.length === 0) {
      return ''
    }
    
    // Find the first host with plugin output to use as the detailed example
    let detailedHost = null
    for (const host of hosts) {
      if (host.pluginOutput && host.pluginOutput.length > 0) {
        detailedHost = host
        break
      }
    }
    
    // If no host has plugin output, use the first host
    if (!detailedHost) {
      detailedHost = hosts[0]
    }
    
    let poc = ''
    
    // Add the first host in bold with port
    poc += `<strong>${detailedHost.host} port ${detailedHost.port}</strong>\n\n`
    
    // Add plugin output with <pre><code> formatting
    if (detailedHost.pluginOutput && detailedHost.pluginOutput.length > 0) {
      poc += '<pre><code>'
      poc += detailedHost.pluginOutput.join('\n\n')
      poc += '</code></pre>'
    }
    
    // Add other affected systems if there are more than one host
    if (hosts.length > 1) {
      poc += '<br/>Other affected systems:'
      
      for (const host of hosts) {
        if (host.host !== detailedHost.host || host.port !== detailedHost.port) {
          poc += `<li>${host.host} port ${host.port}</li>\n\n`
        }
      }
    }
    
    return poc.trim()
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
      const parser = new NessusParser(selectedAudit.value, [], true, false)
      
      // Import all original findings and let the parser handle merging
      const result = await parser.importSelectedFindings(allOriginalFindings)
      
      if (result.success) {
        showImportSuccess('nessus', result.findingsCount)
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
  
  return {
    // State
    nessusFiles,
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
    importVulnerabilities
  }
}
