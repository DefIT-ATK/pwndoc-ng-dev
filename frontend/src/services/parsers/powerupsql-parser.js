import BaseParser from '../base-parser'

/**
 * PowerUpSQL parser for importing vulnerabilities from PowerUpSQL CSV export files
 */
export class PowerUpSQLParser extends BaseParser {
  constructor(auditId, filenames, merge = true, dryRun = false) {
    super(auditId, filenames, merge, dryRun)
  }

  /**
   * Extract vulnerabilities from PowerUpSQL files
   */
  async _extractVulns(filenames) {
    const vulns = []
    
    console.log('PowerUpSQL _extractVulns called with:', filenames)
    
    // Ensure filenames is an array
    const files = Array.isArray(filenames) ? filenames : [filenames]
    console.log('Files array:', files.map(f => f?.name))
    
    // Filter out files with '1433' in the filename (matching Python logic)
    const filteredFiles = files.filter(file => file && !file.name.includes('1433'))
    console.log('Filtered files (excluding 1433):', filteredFiles.map(f => f?.name))
    
    for (const file of filteredFiles) {
      if (!file) continue
      
      console.log(`Processing file: ${file.name}`)
      const fileExtension = file.name.split('.').pop().toLowerCase()
      console.log(`File extension: ${fileExtension}`)
      
      if (fileExtension === 'csv') {
        const fileContent = await this.readFileAsText(file)
        console.log(`File content length: ${fileContent.length}`)
        console.log('First 200 chars:', fileContent.substring(0, 200))
        
        const csvVulns = await this._parsePowerUpSQLCsv(fileContent)
        console.log(`Parsed ${csvVulns.length} vulns from ${file.name}`)
        vulns.push(...csvVulns)
      } else {
        throw new Error(`Unsupported file format: ${fileExtension}. PowerUpSQL parser only supports CSV files.`)
      }
    }
    
    console.log(`Total vulns extracted: ${vulns.length}`)
    return vulns
  }

  /**
   * Parse PowerUpSQL CSV format
   */
  async _parsePowerUpSQLCsv(csvContent) {
    const vulns = []
    console.log('_parsePowerUpSQLCsv called with content length:', csvContent.length)
    
    const lines = csvContent.split('\n')
    console.log(`Split into ${lines.length} lines`)
    
    if (lines.length < 2) {
      console.log('Not enough lines, returning empty')
      return vulns // No data
    }

    // Parse header
    const headers = this._parseCSVLine(lines[0])
    console.log('Headers found:', headers)
    
    // Validate required columns
    const requiredColumns = ['ComputerName', 'Instance', 'Vulnerability', 'Description', 'Remediation', 'Severity']
    const missingColumns = requiredColumns.filter(col => !headers.includes(col))
    
    if (missingColumns.length > 0) {
      console.warn(`Missing required columns: ${missingColumns.join(', ')}`)
      console.log('Available headers:', headers)
      return vulns
    }

    console.log('All required columns found, processing data rows...')

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const values = this._parseCSVLine(line)
        if (values.length < headers.length) {
          console.log(`Line ${i + 1}: Not enough values (${values.length} vs ${headers.length})`)
          continue
        }

        const row = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })

        // Skip empty or invalid rows
        if (!row.Vulnerability || !row.ComputerName) {
          console.log(`Line ${i + 1}: Missing Vulnerability or ComputerName`)
          continue
        }

        console.log(`Line ${i + 1}: Creating vuln "${row.Vulnerability}" for ${row.ComputerName}`)

        const vuln = {
          ComputerName: row.ComputerName,
          Instance: row.Instance || '',
          Vulnerability: row.Vulnerability,
          Description: row.Description || '',
          Remediation: row.Remediation || '',
          Severity: this._severityToCvss(row.Severity),
          IsVulnerable: row.IsVulnerable || '',
          IsExploitable: row.IsExploitable || '',
          Exploited: row.Exploited || '',
          ExploitCmd: row.ExploitCmd || '',
          Details: row.Details || '',
          Reference: row.Reference || '',
          Author: row.Author || ''
        }

        vulns.push(vuln)
      } catch (error) {
        console.warn(`Error parsing line ${i + 1}: ${error.message}`)
        continue
      }
    }

    console.log(`_parsePowerUpSQLCsv returning ${vulns.length} vulns`)
    return vulns
  }

  /**
   * Simple CSV parser that handles quoted fields
   */
  _parseCSVLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim())
    return result
  }

  /**
   * Convert severity string to CVSS score (matching Python logic)
   */
  _severityToCvss(severity) {
    if (!severity) return null
    
    const severityLower = severity.toLowerCase()
    
    // Map severity strings to CVSS scores
    if (severityLower.includes('critical') || severityLower.includes('high')) {
      return 7.5
    } else if (severityLower.includes('medium') || severityLower.includes('moderate')) {
      return 5.0
    } else if (severityLower.includes('low')) {
      return 3.0
    } else if (severityLower.includes('info') || severityLower.includes('informational')) {
      return 0.0
    }
    
    return null
  }

  /**
   * Convert CVSS score to severity string
   */
  _cvssScoreToSeverity(cvssScore) {
    if (cvssScore === null || cvssScore === undefined || isNaN(cvssScore)) {
      return 'None'
    }
    
    if (cvssScore === 0) {
      return 'None'
    }
    
    if (cvssScore >= 9.0) {
      return 'Critical'
    } else if (cvssScore >= 7.0) {
      return 'High'
    } else if (cvssScore >= 4.0) {
      return 'Medium'
    } else if (cvssScore >= 0.1) {
      return 'Low'
    } else {
      return 'None'
    }
  }

  /**
   * Convert severity to priority number
   */
  _severityToPriority(severity) {
    const priorityMap = {
      'Critical': 1,
      'High': 2,
      'Medium': 3,
      'Low': 4,
      'Info': 4,
      'None': 4
    }
    return priorityMap[severity] || 4
  }

  /**
   * Create findings from extracted vulnerabilities
   */
  async _createFindings() {
    for (const vuln of this.vulns) {
      // Monkey Patch to fix the double newline in the description (matching Python logic)
      let description = vuln.Description
      if (description) {
        description = `<p>${description}</p>`
        description = description.replace(/<br\/><br\/>/g, '')
      }

      const finding = {
        title: vuln.Vulnerability,
        description: description || '',
        observation: '', // Set to empty string as requested
        remediation: vuln.Remediation || '',
        vulnType: 'Infrastructure', // Changed from 'SQL Issue' to match other parsers
        scope: vuln.Instance || vuln.ComputerName,
        poc: vuln.Details || '',
        references: vuln.Reference ? [vuln.Reference] : [],
        cvssv3: vuln.Severity,
        cvssScore: vuln.Severity,
        priority: this._severityToPriority(this._cvssScoreToSeverity(vuln.Severity)),
        remediationComplexity: 2,
        category: 'PowerUpSQL',
        severity: this._cvssScoreToSeverity(vuln.Severity)
      }

      this.findings.push(finding)
    }
  }

  /**
   * Custom merging logic for PowerUpSQL findings (matching Python _merge_vulns logic)
   */
  _mergePowerUpSQLVulnGroup(findings) {
    console.log(`There are ${findings.length} vulnerabilities to be merged`)
    
    // Debug: Check if findings have category before merging
    console.log('First finding before merge:', findings[0])
    console.log('First finding category:', findings[0]?.category)

    // Create a dictionary to store unique titles as keys and merged findings as values
    const uniqueTitles = {}

    for (const finding of findings) {
      const title = finding.title
      if (!uniqueTitles[title]) {
        uniqueTitles[title] = []
      }
      uniqueTitles[title].push(finding)
    }

    const result = []

    for (const [title, groupedFindings] of Object.entries(uniqueTitles)) {
      // Skip certain exclusions if needed (matching Python logic)
      const exclusions = [] // Add any titles to exclude from merging
      
      if (exclusions.includes(title)) {
        continue
      }

      // Create the initial merged_finding using the structure of findings[0]
      const initialFinding = groupedFindings[0]
      const mergedFinding = { ...initialFinding }
      
      // Debug: Ensure category is preserved during merge
      console.log('Initial finding category:', initialFinding.category)
      console.log('Merged finding category after spread:', mergedFinding.category)
      
      // Explicitly ensure category is set (safety check)
      if (!mergedFinding.category) {
        console.warn('Category missing after merge, setting to PowerUpSQL')
        mergedFinding.category = 'PowerUpSQL'
      }
      
      mergedFinding.poc = ''
      mergedFinding.observation = '' // Set to empty string as requested
      
      // Store all original findings for this merged group (CRITICAL for database import)
      mergedFinding.allOriginalFindings = groupedFindings
      
      // Create a dictionary to group pocs and related scopes
      const pocScopes = {}
      const tempMergedScope = []

      for (const finding of groupedFindings) {
        tempMergedScope.push(finding.scope)
        const scope = `<li>${finding.scope}</li>`
        const poc = finding.poc || ''

        if (!pocScopes[poc]) {
          pocScopes[poc] = []
        }
        pocScopes[poc].push(scope)
      }

      // Combine related scopes with poc and add to the merged_finding
      for (const [poc, scopes] of Object.entries(pocScopes)) {
        if (poc !== '') {
          const cleanPoc = poc.replace(/<br\/><br\/>/g, '<br/>')
          const uniqueScopes = [...new Set(scopes)]
          const combinedPoc = uniqueScopes.join('') + cleanPoc
          mergedFinding.poc += `Instance(s):${combinedPoc}<br/><br/>`
        }
      }

      // Set scope - use "Multiple Targets" if more than 10 unique scopes
      const uniqueScopes = [...new Set(tempMergedScope)]
      if (uniqueScopes.length > 10) {
        mergedFinding.scope = 'Multiple Targets'
      } else {
        mergedFinding.scope = uniqueScopes.join(', ')
      }

      result.push(mergedFinding)
    }

    console.log(`There are ${result.length} unique title/poc combos`)
    console.log(`Sending back ${result.length} findings to be added`)

    // Mark findings with empty POC (matching Python logic)
    for (const finding of result) {
      if (finding.poc === '') {
        finding.title += ' ⚠️EMPTY POC⚠️'
      }
      
      // Final safety check: ensure category is always set
      if (!finding.category) {
        console.warn(`Warning: Finding "${finding.title}" missing category, setting to PowerUpSQL`)
        finding.category = 'PowerUpSQL'
      }
    }

    console.log('Final merged results with categories:', result.map(f => ({ title: f.title, category: f.category })))

    // CRITICAL FIX: Base parser expects a single object, not an array
    // Since base parser calls this method for each title group, we should return the first (and only) result
    if (result.length === 1) {
      console.log('Returning single merged finding:', result[0])
      return result[0]
    } else {
      console.log('Returning array of merged findings:', result.length)
      return result
    }
  }
}

export default PowerUpSQLParser
