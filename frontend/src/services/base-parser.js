import VulnerabilityService from './vulnerability'
import AuditService from './audit'
import { Notify } from 'quasar'
import { $t } from '@/boot/i18n'

/**
 * Base class for all parsers
 * Handles the common logic for importing vulnerabilities from tool outputs
 */
export class BaseParser {
  /**
   * @param {string} auditId - The audit ID to add findings to
   * @param {Array} filenames - Array of file objects to parse
   * @param {boolean} merge - Whether to merge duplicate vulnerabilities
   * @param {boolean} dryRun - Whether to perform a dry run (no actual import)
   */
  constructor(auditId, filenames, merge = true, dryRun = false) {
    this.auditId = auditId
    this.dryRun = dryRun
    this.findings = []
    this._merge = merge
    this.vulns = []
    this.parsedVulnerabilities = []
    this.filenames = filenames || [] // Store the filenames parameter
  }

  /**
   * Main entry point for parsing
   */
  async parse() {
    try {
      console.log('Starting parser with files:', this.filenames?.length || 0)
      
      // Extract vulnerabilities from files
      this.vulns = await this._extractVulns(this.filenames)
      
      // Create findings from vulnerabilities
      await this._createFindings()
      
      // Add findings to PwnDoc database
      await this._addFindingsToPwndocDB(this.findings)
      
      // Populate audit with findings and get actual count added
      const actualAddedCount = await this._populateAudit(this.findings)
      
      return {
        success: true,
        findings: this.findings, // Add this for preview
        findingsCount: actualAddedCount || this.findings.length,
        vulnsCount: this.vulns.length,
        totalFindings: this.vulns.length // Add this for total count
      }
    } catch (error) {
      console.error('Parser error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Extract vulnerabilities from files
   * Must be implemented by subclasses
   */
  async _extractVulns(filenames) {
    throw new Error('Subclasses must implement _extractVulns')
  }

  /**
   * Create findings from extracted vulnerabilities
   * Must be implemented by subclasses
   */
  async _createFindings() {
    throw new Error('Subclasses must implement _createFindings')
  }

  /**
   * Add findings to PwnDoc database
   */
  async _addFindingsToPwndocDB(findings) {
    if (this.dryRun) {
      console.log('[DRY RUN] Would add findings to database:', findings.length)
      return
    }

    try {
      // Get existing vulnerabilities from database
      const response = await VulnerabilityService.getVulnerabilities()
      const allPwndocDBVulns = response.data.datas || []
      
      const alreadyAdded = []
      const vulnsToAdd = []

      for (const finding of findings) {
        const titleExists = this._checkIfTitleMatches(allPwndocDBVulns, finding.title)
        const alreadyInBatch = alreadyAdded.includes(finding.title)
        
        if (!titleExists && !alreadyInBatch) {
          const vulnData = this._findingToPwndocDB(finding)
          vulnsToAdd.push(vulnData)
          alreadyAdded.push(finding.title)
        }
      }

      if (vulnsToAdd.length > 0) {
        console.log('Sending vulnerabilities to database:', JSON.stringify(vulnsToAdd, null, 2))
        await VulnerabilityService.createVulnerabilities(vulnsToAdd)
        
        Notify.create({
          message: `Added ${vulnsToAdd.length} new vulnerabilities to database`,
          color: 'positive',
          position: 'top-right'
        })
      }
    } catch (error) {
      console.error('Error adding findings to database:', error)
      console.error('Error response data:', error.response?.data)
      console.error('Error status:', error.response?.status)
      throw error
    }
  }

  /**
   * Populate audit with findings
   */
  async _populateAudit(findings) {
    if (this.dryRun) {
      console.log('[DRY RUN] Would add findings to audit:', findings.length)
      return findings.length
    }

    if (!this.auditId) {
      console.log('No audit ID provided, skipping audit population')
      return findings.length
    }

    try {
      // Get all vulnerabilities from database
      const response = await VulnerabilityService.getVulnerabilities()
      const allPwndocDBVulns = response.data.datas || []
      
      const vulnsToAdd = []

      for (const finding of findings) {
        const vulnFromDB = this._getVulnFromPwndocDBByTitle(finding.title, allPwndocDBVulns)
        if (vulnFromDB) {
          const toAdd = this._newFindingFromPwndocDB(vulnFromDB)
          
          // Use database values for CVSS and priority (these are the correct ones)
          // Use parsed finding values for POC, scope, and vulnType (these are specific to this instance)
          toAdd.poc = finding.poc
          toAdd.scope = finding.scope
          toAdd.vulnType = finding.vulnType
                    
          vulnsToAdd.push(toAdd)
        }
      }

      let actualAddedCount = vulnsToAdd.length

      if (this._merge) {
        console.log('Merge set to True: merging!')
        const merged = this._mergeVulns(vulnsToAdd)
        actualAddedCount = merged.length
        for (const toAdd of merged) {
          await AuditService.createFinding(this.auditId, toAdd)
        }
      } else {
        for (const toAdd of vulnsToAdd) {
          await AuditService.createFinding(this.auditId, toAdd)
        }
      }

      // Return the actual count for the success message in the composable
      return actualAddedCount
    } catch (error) {
      console.error('Error populating audit:', error)
      throw error
    }
  }

  /**
   * Check if a title matches any existing vulnerability
   */
  _checkIfTitleMatches(allVulns, title) {
    return allVulns.some(vuln => 
      vuln.details.some(detail => detail.title === title)
    )
  }

  /**
   * Get vulnerability from database by title
   */
  _getVulnFromPwndocDBByTitle(title, allVulns) {
    return allVulns.find(vuln => 
      vuln.details.some(detail => detail.title === title)
    )
  }

  /**
   * Convert finding to PwnDoc database format
   */
  _findingToPwndocDB(finding) {
    console.log('_findingToPwndocDB input finding:', finding)
    
    // Match the exact format used by the UI
    const result = {
      cvssv3: finding.cvssv3 || "",
      priority: finding.priority !== undefined ? finding.priority : "",
      remediationComplexity: finding.remediationComplexity !== undefined ? finding.remediationComplexity : "",
      category: finding.category || "",
      details: [{
        locale: "EN", // Match UI format (uppercase)
        title: finding.title,
        vulnType: finding.vulnType || "",
        updatedAt: "", // Match UI format
        description: finding.description || "",
        observation: finding.observation || "",
        remediation: finding.remediation || "",
        references: finding.references || [],
        customFields: [] // Match UI format
      }]
    }
    
    console.log('_findingToPwndocDB output:', result)
    return result
  }

  /**
   * Create new finding from PwnDoc database vulnerability
   */
  _newFindingFromPwndocDB(vulnFromDB) {
    const detail = vulnFromDB.details.find(d => d.locale === 'EN') || vulnFromDB.details[0]
    
    return {
      title: detail.title,
      vulnType: detail.vulnType,
      description: detail.description,
      observation: detail.observation,
      remediation: detail.remediation,
      references: detail.references || [],
      cvssv3: vulnFromDB.cvssv3,
      priority: vulnFromDB.priority,
      remediationComplexity: vulnFromDB.remediationComplexity,
      category: vulnFromDB.category,
      status: 1, // En cours
      customFields: []
    }
  }

  /**
   * Merge vulnerabilities
   */
  _mergeVulns(vulnsToAdd) {
    console.log(`There are ${vulnsToAdd.length} vulnerabilities to be merged`)
    
    // Group findings by title
    const uniqueTitles = {}
    for (const finding of vulnsToAdd) {
      const title = finding.title
      if (!uniqueTitles[title]) {
        uniqueTitles[title] = []
      }
      uniqueTitles[title].push(finding)
    }

    // Process each group of findings
    const result = []
    for (const [title, findings] of Object.entries(uniqueTitles)) {
      const mergedFinding = this._mergeSingleVulnGroup(findings)
      result.push(mergedFinding)
    }

    console.log(`There are ${result.length} unique title/poc combos`)
    console.log(`Sending back ${result.length} findings to be added`)
    return result
  }

  /**
   * Merge a group of findings with the same title
   */
  _mergeSingleVulnGroup(findings) {
    // Check if this parser has a Nessus-specific merge method
    if (this._mergeNessusVulnGroup) {
      return this._mergeNessusVulnGroup(findings)
    }
    
    // Get the category from the first finding
    const category = findings[0].category || 'default'
    
    // Delegate to category-specific merge method if it exists
    const mergeMethod = this[`_merge${category.charAt(0).toUpperCase() + category.slice(1)}VulnGroup`]
    if (mergeMethod) {
      return mergeMethod.call(this, findings)
    }
    
    // Fall back to default merge strategy
    return this._defaultMergeVulnGroup(findings)
  }

  /**
   * Default implementation for merging a group of findings
   */
  _defaultMergeVulnGroup(findings) {
    const initialFinding = { ...findings[0] }
    const mergedFinding = initialFinding
    mergedFinding.poc = ''
    
    // Group findings by host and collect their information
    const hostGroups = {}
    
    for (const finding of findings) {
      const host = finding.scope
      if (!hostGroups[host]) {
        hostGroups[host] = {
          ports: new Set(),
          pocs: []
        }
      }
      
      // Extract port from POC if available
      const pocMatch = finding.poc.match(/port (\d+)/)
      if (pocMatch) {
        hostGroups[host].ports.add(pocMatch[1])
      }
      
      // Collect POC content
      if (finding.poc) {
        hostGroups[host].pocs.push(finding.poc)
      }
    }
    
    // Build merged POC
    let firstHost = true
    for (const [host, info] of Object.entries(hostGroups)) {
      if (info.pocs.length > 0) {
        if (!firstHost) {
          mergedFinding.poc += '<br/><br/>'
        }
        
        // Add host header
        mergedFinding.poc += `<strong>${host}`
        if (info.ports.size > 0) {
          const ports = Array.from(info.ports).sort((a, b) => parseInt(a) - parseInt(b))
          if (ports.length === 1) {
            mergedFinding.poc += ` port ${ports[0]}`
          } else {
            mergedFinding.poc += ` ports ${ports.join(', ')}`
          }
        }
        mergedFinding.poc += '</strong>'
        
        // Add POC content (use the first one as they should be similar)
        mergedFinding.poc += info.pocs[0]
        
        firstHost = false
      }
    }
    
    // Set scope
    const hosts = Object.keys(hostGroups)
    mergedFinding.scope = hosts.length > 10 
      ? 'Multiple Targets' 
      : hosts.join(', ')

    // Mark empty POCs
    if (!mergedFinding.poc) {
      mergedFinding.title += ' ⚠EMPTY POC⚠'
    }

    return mergedFinding
  }

  /**
   * Read file as text
   */
  async readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = (e) => reject(e)
      reader.readAsText(file)
    })
  }

  /**
   * Parse XML string to DOM
   */
  parseXml(xmlString) {
    const parser = new DOMParser()
    return parser.parseFromString(xmlString, 'application/xml')
  }

  /**
   * Parse CSV string to array of objects
   */
  parseCsv(csvString) {
    const lines = csvString.split('\n')
    if (lines.length < 2) return []
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const result = []
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        const obj = {}
        headers.forEach((header, index) => {
          obj[header] = values[index] || ''
        })
        result.push(obj)
      }
    }
    
    return result
  }

  /**
   * Import selected findings directly (bypasses file parsing)
   * @param {Array} selectedFindings - Array of findings to import
   */
  async importSelectedFindings(selectedFindings) {
    try {
      console.log('Importing selected findings:', selectedFindings.length)
      
      // Add findings to PwnDoc database
      await this._addFindingsToPwndocDB(selectedFindings)
      
      // Populate audit with findings and get actual count added
      const actualAddedCount = await this._populateAudit(selectedFindings)
      
      return {
        success: true,
        findingsCount: actualAddedCount || selectedFindings.length
      }
    } catch (error) {
      console.error('Error importing selected findings:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default BaseParser 