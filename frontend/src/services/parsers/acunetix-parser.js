import BaseParser from '../base-parser'

/**
 * Acunetix parser for importing vulnerabilities from Acunetix JSON export files
 * Based on the Acunetix export format: export -> scans -> vulnerabilities & vulnerability_types
 */
export class AcunetixParser extends BaseParser {
  constructor(auditId, filenames, merge = true, dryRun = false) {
    super(auditId, filenames, merge, dryRun)
  }

  /**
   * Extract vulnerabilities from Acunetix files
   */
  async _extractVulns(filenames) {
    const allVulns = []
    
    // Ensure filenames is an array
    const files = Array.isArray(filenames) ? filenames : [filenames]
    
    for (const file of files) {
      if (!file) continue
      
      const fileExtension = file.name.split('.').pop().toLowerCase()
      const fileContent = await this.readFileAsText(file)
      
      if (fileExtension === 'json') {
        const jsonVulns = await this._extractVulnsFromJson(JSON.parse(fileContent))
        allVulns.push(...jsonVulns)
      } else if (fileExtension === 'xml') {
        // XML support for backward compatibility
        const xmlVulns = await this._parseXmlFile(fileContent)
        allVulns.push(...xmlVulns)
      } else {
        throw new Error(`Unsupported file format: ${fileExtension}. Acunetix parser supports .json and .xml formats.`)
      }
    }
    
    return allVulns
  }

  /**
   * Extract vulnerabilities from Acunetix JSON export structure
   * Matches the Python implementation: export -> scans -> vulnerabilities & vulnerability_types
   */
  _extractVulnsFromJson(jsonData) {
    const vulnerabilities = []
    
    if (!jsonData.export || !jsonData.export.scans) {
      throw new Error('Invalid Acunetix JSON format. Expected structure: export.scans')
    }
    
    const scansData = jsonData.export.scans
    
    for (const scanEntry of scansData) {
      if (!scanEntry.vulnerabilities || !scanEntry.vulnerability_types) {
        console.warn('Scan entry missing vulnerabilities or vulnerability_types')
        continue
      }
      
      const vulns = scanEntry.vulnerabilities
      const vulnTypes = scanEntry.vulnerability_types
      
      for (const vuln of vulns) {
        const newVuln = {
          app_id: vuln.info?.app_id,
          name: vuln.info?.name,
          host: vuln.info?.host,
          details: vuln.info?.details || '',
          url: vuln.info?.url,
          request: vuln.info?.request || null,
          loc_url: vuln.info?.loc_url || null,
          response: vuln.response || null
        }
        
        // Find matching vulnerability type data
        for (const vulnType of vulnTypes) {
          if (vulnType.app_id === newVuln.app_id) {
            newVuln.description = vulnType.description || ''
            newVuln.impact = vulnType.impact || ''
            newVuln.recommendation = vulnType.recommendation || ''
            newVuln.cvss3 = vulnType.cvss3 || ''
            newVuln.cvss_score = vulnType.cvss_score || 0
            newVuln.refs = vulnType.refs || []
            newVuln.severity = vulnType.severity || 0
            break
          }
        }
        
        vulnerabilities.push(newVuln)
      }
    }
    
    return vulnerabilities
  }

  /**
   * Parse vulnerabilities from Acunetix XML format (legacy support)
   */
  _parseXmlFile(xmlContent) {
    const vulnerabilities = []
    
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml')
      
      // Check for parsing errors
      const parserError = xmlDoc.querySelector('parsererror')
      if (parserError) {
        throw new Error('Invalid XML format')
      }
      
      // Note: This is a simplified XML parser for backward compatibility
      // The JSON format is preferred as it contains more detailed information
      const vulnNodes = xmlDoc.querySelectorAll('vulnerability, ReportItem')
      
      vulnNodes.forEach((vulnNode, index) => {
        const vuln = this._extractVulnFromXmlNode(vulnNode, index)
        if (vuln) {
          vulnerabilities.push(vuln)
        }
      })
      
    } catch (error) {
      console.error('Error parsing Acunetix XML:', error)
      throw new Error(`XML parsing failed: ${error.message}`)
    }
    
    return vulnerabilities
  }

  /**
   * Extract vulnerability from XML node (simplified)
   */
  _extractVulnFromXmlNode(vulnNode, index) {
    const name = this._getElementText(vulnNode, 'Name') || this._getElementText(vulnNode, 'name')
    const description = this._getElementText(vulnNode, 'Description') || this._getElementText(vulnNode, 'description')
    const details = this._getElementText(vulnNode, 'Details') || this._getElementText(vulnNode, 'details')
    const recommendation = this._getElementText(vulnNode, 'Recommendation') || this._getElementText(vulnNode, 'recommendation')
    const severity = this._getElementText(vulnNode, 'Severity') || this._getElementText(vulnNode, 'severity')
    const url = this._getElementText(vulnNode, 'Affects') || this._getElementText(vulnNode, 'url')
    const host = this._extractHostFromUrl(url)
    
    return {
      app_id: `xml_${index}`, // Generate app_id for XML format
      name: name || 'Unknown Vulnerability',
      host: host || 'Unknown Host',
      details: details,
      url: url,
      request: this._getElementText(vulnNode, 'Request'),
      response: this._getElementText(vulnNode, 'Response'),
      description: description,
      impact: '',
      recommendation: recommendation,
      cvss3: '',
      cvss_score: this._severityToScore(severity),
      refs: [],
      severity: this._mapSeverityToNumber(severity)
    }
  }

  /**
   * Create findings from extracted vulnerabilities
   * Matches Python implementation's _create_findings method
   */
  async _createFindings() {
    this.findings = []
    
    for (const vuln of this.vulns) {
      // Build description with impact (matching Python logic)
      let placeholder = '<p>' + (vuln.description || '') + '</p>'
      if (vuln.impact && vuln.impact !== "") {
        placeholder += '<p><b>Impact: </b>' + vuln.impact + '</p>'
      }
      const description = placeholder.replace(/<br\/><br\/>/g, "")
      
      const finding = {
        title: vuln.name || 'Unknown Vulnerability',
        description: description,
        remediation: vuln.recommendation || '',
        vulnType: "Web Application",
        scope: vuln.host || 'Unknown Host',
        poc: vuln.details || '',
        references: this._formatReferences(vuln.refs),
        cvssv3: vuln.cvss3 || '',
        cvssScore: vuln.cvss_score || 0,
        priority: this._severityToPriority(vuln.severity),
        remediationComplexity: this._severityToComplexity(vuln.severity),
        category: "Acunetix",
        severity: this._mapSeverityNumberToString(vuln.severity),
        // Additional Acunetix-specific fields
        url: vuln.url,
        request: vuln.request,
        response: vuln.response,
        loc_url: vuln.loc_url
      }
      
      this.findings.push(finding)
    }
  }

  /**
   * Format references array for display
   */
  _formatReferences(refs) {
    if (!refs || !Array.isArray(refs)) return []
    
    return refs.map(ref => {
      if (typeof ref === 'object') {
        return Object.values(ref).join(" - ")
      }
      return ref.toString()
    })
  }

  /**
   * Map numerical severity to string
   */
  _mapSeverityNumberToString(severityNum) {
    const severityMap = {
      0: "Informational",
      1: "Low", 
      2: "Medium",
      3: "High",
      4: "Critical"
    }
    return severityMap[severityNum] || "Low"
  }

  /**
   * Map string severity to number (for XML compatibility)
   */
  _mapSeverityToNumber(severity) {
    if (typeof severity === 'number') return severity
    
    const severityMap = {
      'informational': 0,
      'info': 0,
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    }
    return severityMap[severity?.toLowerCase()] || 1
  }

  /**
   * Convert severity to CVSS score
   */
  _severityToScore(severity) {
    const scoreMap = {
      'critical': 9.0,
      'high': 7.5,
      'medium': 5.0,
      'low': 2.5,
      'informational': 0.0,
      'info': 0.0
    }
    
    if (typeof severity === 'number') {
      const numMap = { 4: 9.0, 3: 7.5, 2: 5.0, 1: 2.5, 0: 0.0 }
      return numMap[severity] || 0.0
    }
    
    return scoreMap[severity?.toLowerCase()] || 0.0
  }

  /**
   * Convert severity to priority
   */
  _severityToPriority(severity) {
    const priorityMap = { 4: 1, 3: 2, 2: 3, 1: 4, 0: 4 }
    return priorityMap[severity] || 4
  }

  /**
   * Convert severity to remediation complexity
   */
  _severityToComplexity(severity) {
    const complexityMap = { 4: 1, 3: 1, 2: 2, 1: 3, 0: 3 }
    return complexityMap[severity] || 3
  }

  /**
   * Acunetix-specific merge method for findings with the same title
   * Implements sophisticated merging logic from Python implementation
   */
  _mergeAcunetixVulnGroup(findings) {
    if (findings.length === 1) {
      return findings[0]
    }

    const initialFinding = findings[0]
    const mergedFinding = { ...initialFinding }
    mergedFinding.poc = ""
    
    const pocScopes = {}
    const tempMergedScope = []
    
    // Merge POCs and scopes (matching Python logic)
    for (const finding of findings) {
      tempMergedScope.push(finding.scope)
      const scope = "<li>" + finding.scope + "</li>"
      const poc = finding.poc || ""
      
      if (!pocScopes[poc]) {
        pocScopes[poc] = []
      }
      pocScopes[poc].push(scope)
    }
    
    // Build merged POC
    for (const [poc, scopes] of Object.entries(pocScopes)) {
      if (poc !== "") {
        const cleanPoc = poc.replace(/<br\/><br\/>/g, "<br/>")
        const combinedPoc = Array.from(new Set(scopes)).join("") + cleanPoc
        mergedFinding.poc += "URL(s):" + combinedPoc + "<br/><br/>"
      }
    }
    
    // Set scope based on number of unique targets
    const uniqueScopes = Array.from(new Set(tempMergedScope))
    if (uniqueScopes.length > 10) {
      mergedFinding.scope = "Multiple Targets"
    } else {
      mergedFinding.scope = uniqueScopes.join(", ")
    }
    
    // Mark empty POCs (matching Python logic)
    if (mergedFinding.poc === "") {
      mergedFinding.title += " ⚠️EMPTY POC⚠️"
    }
    
    return mergedFinding
  }

  /**
   * Extract host from URL
   */
  _extractHostFromUrl(url) {
    if (!url) return null
    
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch (error) {
      // If URL parsing fails, try to extract host manually
      const match = url.match(/^https?:\/\/([^\/]+)/)
      return match ? match[1] : url
    }
  }

  /**
   * Helper method to get text content from XML element
   */
  _getElementText(parent, tagName) {
    const element = parent.getElementsByTagName(tagName)[0]
    return element ? element.textContent.trim() : ''
  }
}

export default AcunetixParser
