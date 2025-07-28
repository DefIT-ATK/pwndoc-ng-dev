import { ref } from 'vue'
import { VulnerabilityService } from '@/services/vulnerability'

export function useUnifiedResults() {
  const parseResults = ref({})
  const aggregatedResults = ref({})
  const importing = ref(false)

  /**
   * Aggregate results from all parsers
   */
  const aggregateResults = () => {
    const unified = {
      totalVulnerabilities: 0,
      byParser: {},
      bySeverity: { 
        critical: 0, 
        high: 0, 
        medium: 0, 
        low: 0, 
        info: 0,
        none: 0
      },
      byCategory: {},
      duplicates: [],
      allFindings: [],
      executionSummary: {
        totalParsers: 0,
        successfulParsers: 0,
        failedParsers: 0,
        totalFilesProcessed: 0
      }
    }

    // Process each parser result
    for (const [parserType, result] of Object.entries(parseResults.value)) {
      unified.executionSummary.totalParsers++
      
      if (result.success) {
        unified.executionSummary.successfulParsers++
        
        // Add parser results
        unified.byParser[parserType] = {
          name: getParserDisplayName(parserType),
          findings: result.findings.length,
          status: 'success',
          executedAt: result.executedAt,
          filesProcessed: result.filesProcessed
        }

        // Process findings
        result.findings.forEach(finding => {
          unified.totalVulnerabilities++
          unified.allFindings.push({
            ...finding,
            sourceParser: parserType,
            parsedAt: result.executedAt
          })

          // Count by severity
          const severity = (finding.severity || finding.risk || 'none').toLowerCase()
          if (unified.bySeverity.hasOwnProperty(severity)) {
            unified.bySeverity[severity]++
          } else {
            unified.bySeverity.none++
          }

          // Count by category
          const category = finding.category || finding.vulnType || 'Other'
          unified.byCategory[category] = (unified.byCategory[category] || 0) + 1
        })
      } else {
        unified.executionSummary.failedParsers++
        unified.byParser[parserType] = {
          name: getParserDisplayName(parserType),
          findings: 0,
          status: 'error',
          error: result.error,
          executedAt: result.executedAt,
          filesProcessed: result.filesProcessed
        }
      }
      
      unified.executionSummary.totalFilesProcessed += result.filesProcessed
    }

    // Detect potential duplicates
    unified.duplicates = detectDuplicates(unified.allFindings)

    aggregatedResults.value = unified
    return unified
  }

  /**
   * Detect potential duplicate findings across parsers
   */
  const detectDuplicates = (findings) => {
    const duplicates = []
    const seen = new Map()

    for (let i = 0; i < findings.length; i++) {
      const finding = findings[i]
      const key = generateFindingKey(finding)
      
      if (seen.has(key)) {
        const original = seen.get(key)
        duplicates.push({
          original: original,
          duplicate: finding,
          similarity: calculateSimilarity(original, finding),
          reason: 'Similar title and target'
        })
      } else {
        seen.set(key, finding)
      }
    }

    return duplicates
  }

  /**
   * Generate a key for duplicate detection
   */
  const generateFindingKey = (finding) => {
    const title = (finding.title || finding.name || '').toLowerCase().trim()
    const target = (finding.scope || finding.host || finding.target || '').toLowerCase().trim()
    
    // Normalize title - remove common prefixes/suffixes
    const normalizedTitle = title
      .replace(/^(vulnerability|vuln|finding|issue):\s*/i, '')
      .replace(/\s*\(.*?\)$/, '') // Remove parenthetical info
      .substring(0, 50) // First 50 chars
    
    return `${normalizedTitle}|${target}`
  }

  /**
   * Calculate similarity between two findings
   */
  const calculateSimilarity = (finding1, finding2) => {
    const title1 = (finding1.title || '').toLowerCase()
    const title2 = (finding2.title || '').toLowerCase()
    
    // Simple similarity - can be enhanced
    if (title1 === title2) return 1.0
    if (title1.includes(title2) || title2.includes(title1)) return 0.8
    
    const words1 = title1.split(' ')
    const words2 = title2.split(' ')
    const commonWords = words1.filter(word => words2.includes(word))
    
    return commonWords.length / Math.max(words1.length, words2.length)
  }

  /**
   * Import selected findings to audit
   */
  const importToAudit = async (selectedFindings, targetAudit) => {
    importing.value = true
    
    try {
      // Group findings by parser type for batch import
      const findingsByParser = {}
      
      selectedFindings.forEach(finding => {
        const parser = finding.sourceParser
        if (!findingsByParser[parser]) {
          findingsByParser[parser] = []
        }
        findingsByParser[parser].push(finding)
      })

      // Import findings for each parser type
      const importResults = []
      
      for (const [parserType, findings] of Object.entries(findingsByParser)) {
        try {
          const result = await importFindingsForParser(parserType, findings, targetAudit)
          importResults.push({
            parser: parserType,
            success: true,
            imported: result.imported,
            skipped: result.skipped
          })
        } catch (error) {
          console.error(`Error importing ${parserType} findings:`, error)
          importResults.push({
            parser: parserType,
            success: false,
            error: error.message,
            imported: 0,
            skipped: findings.length
          })
        }
      }

      return importResults

    } catch (error) {
      console.error('Error in importToAudit:', error)
      throw error
    } finally {
      importing.value = false
    }
  }

  /**
   * Import findings for a specific parser type
   */
  const importFindingsForParser = async (parserType, findings, targetAudit) => {
    // Convert findings to the format expected by the backend
    const convertedFindings = findings.map(finding => convertFindingFormat(finding, parserType))
    
    // Use the appropriate service based on parser type
    let importResult
    
    switch (parserType) {
      case 'nessus':
        importResult = await VulnerabilityService.importNessusFindings(
          targetAudit.id, 
          convertedFindings
        )
        break
      
      case 'pingcastle':
        importResult = await VulnerabilityService.importPingCastleFindings(
          targetAudit.id, 
          convertedFindings
        )
        break
        
      case 'purpleknight':
        importResult = await VulnerabilityService.importPurpleKnightFindings(
          targetAudit.id, 
          convertedFindings
        )
        break
        
      case 'acunetix':
        importResult = await VulnerabilityService.importAcunetixFindings(
          targetAudit.id, 
          convertedFindings
        )
        break
        
      case 'powerupsql':
        importResult = await VulnerabilityService.importPowerUpSQLFindings(
          targetAudit.id, 
          convertedFindings
        )
        break
        
      case 'custom':
        importResult = await VulnerabilityService.importCustomFindings(
          targetAudit.id, 
          convertedFindings
        )
        break
        
      default:
        throw new Error(`Unknown parser type: ${parserType}`)
    }

    return {
      imported: importResult.imported || findings.length,
      skipped: importResult.skipped || 0
    }
  }

  /**
   * Convert finding to backend format
   */
  const convertFindingFormat = (finding, parserType) => {
    return {
      title: finding.title || finding.name,
      description: finding.description || '',
      observation: finding.observation || finding.details || '',
      remediation: finding.remediation || finding.solution || '',
      severity: normalizeSeverity(finding.severity || finding.risk),
      cvssScore: finding.cvssScore || finding.cvss_score || 0,
      cvssv3: finding.cvssv3 || finding.cvss_vector || '',
      vulnType: finding.vulnType || finding.type || 'Other',
      scope: finding.scope || finding.host || finding.target || '',
      poc: finding.poc || finding.proof || '',
      references: finding.references || [],
      category: finding.category || parserType,
      sourceParser: parserType,
      originalFinding: finding
    }
  }

  /**
   * Normalize severity values
   */
  const normalizeSeverity = (severity) => {
    if (!severity) return 'Medium'
    
    const normalized = severity.toLowerCase()
    const severityMap = {
      'critical': 'Critical',
      'high': 'High', 
      'medium': 'Medium',
      'moderate': 'Medium',
      'low': 'Low',
      'informational': 'Low',
      'info': 'Low',
      'none': 'Low'
    }
    
    return severityMap[normalized] || 'Medium'
  }

  /**
   * Get parser display name
   */
  const getParserDisplayName = (parserType) => {
    const names = {
      nessus: 'Nessus Scanner',
      pingcastle: 'PingCastle AD',
      purpleknight: 'PurpleKnight',
      acunetix: 'Acunetix Web Scanner',
      powerupsql: 'PowerUpSQL',
      custom: 'Custom Parsers'
    }
    return names[parserType] || parserType
  }

  /**
   * Get severity statistics
   */
  const getSeverityStats = () => {
    if (!aggregatedResults.value.bySeverity) return {}
    
    const total = aggregatedResults.value.totalVulnerabilities
    const stats = {}
    
    for (const [severity, count] of Object.entries(aggregatedResults.value.bySeverity)) {
      stats[severity] = {
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }
    }
    
    return stats
  }

  /**
   * Clear all results
   */
  const clearResults = () => {
    parseResults.value = {}
    aggregatedResults.value = {}
  }

  return {
    // State
    parseResults,
    aggregatedResults,
    importing,

    // Methods
    aggregateResults,
    importToAudit,
    getSeverityStats,
    clearResults,
    detectDuplicates
  }
}
