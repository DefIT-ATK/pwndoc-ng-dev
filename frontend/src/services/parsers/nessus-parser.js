import BaseParser from '../base-parser'

/**
 * Nessus parser for importing vulnerabilities from Nessus scan results
 */
export class NessusParser extends BaseParser {
  constructor(auditId, filenames, merge = true, dryRun = false) {
    super(auditId, filenames, merge, dryRun)
  }

  /**
   * Extract vulnerabilities from Nessus files
   */
  async _extractVulns(filenames) {
    const vulns = []
    
    // Ensure filenames is an array
    const files = Array.isArray(filenames) ? filenames : [filenames]
    
    for (const file of files) {
      if (!file) continue
      
      const fileExtension = file.name.split('.').pop().toLowerCase()
      const fileContent = await this.readFileAsText(file)
      
      if (fileExtension === 'nessus' || fileExtension === 'xml') {
        const xmlVulns = await this._parseNessusXml(fileContent)
        vulns.push(...xmlVulns)
      } else if (fileExtension === 'csv') {
        const csvVulns = await this._parseNessusCsv(fileContent)
        vulns.push(...csvVulns)
      } else {
        throw new Error(`Unsupported file format: ${fileExtension}`)
      }
    }
    
    return vulns
  }

  /**
   * Parse Nessus XML format
   */
  async _parseNessusXml(xmlContent) {
    const vulns = []
    const xmlDoc = this.parseXml(xmlContent)
    
    // Parse ReportHost elements
    const reportHosts = xmlDoc.getElementsByTagName('ReportHost')
    
    for (const host of reportHosts) {
      const hostName = host.getAttribute('name')
      
      // Parse ReportItem elements (vulnerabilities)
      const reportItems = host.getElementsByTagName('ReportItem')
      
      for (const item of reportItems) {
        const vuln = this._parseReportItem(item, hostName)
        if (vuln) {
          vulns.push(vuln)
        }
      }
    }
    
    return vulns
  }

  /**
   * Parse individual ReportItem from Nessus XML
   */
  _parseReportItem(item, hostName) {
    const pluginId = item.getAttribute('pluginID')
    const pluginName = item.getAttribute('pluginName')
    const severity = item.getAttribute('severity')
    const port = item.getAttribute('port')
    const protocol = item.getAttribute('protocol')
    const svcName = item.getAttribute('svc_name')
    const pluginFamily = item.getAttribute('pluginFamily')
    
    // Skip informational items if desired
    if (severity === '0') {
      return null
    }
    
    // Extract text content from child elements
    const synopsis = this._getElementText(item, 'synopsis')
    const description = this._getElementText(item, 'description')
    const solution = this._getElementText(item, 'solution')
    const cvssBaseScore = this._getElementText(item, 'cvss_base_score')
    const cvssVector = this._getElementText(item, 'cvss_vector')
    const references = this._getElementText(item, 'references')
    const riskFactor = this._getElementText(item, 'risk_factor')
    
    // Extract plugin output (multiple can exist)
    const pluginOutputs = []
    const pluginOutputElements = item.getElementsByTagName('plugin_output')
    for (const output of pluginOutputElements) {
      if (output.textContent && output.textContent.trim()) {
        pluginOutputs.push(output.textContent.trim())
      }
    }
    
    return {
      pluginId,
      pluginName,
      pluginFamily,
      severity: this._mapSeverity(severity),
      riskFactor,
      hostName,
      port,
      protocol,
      svcName,
      synopsis,
      description,
      solution,
      cvssBaseScore,
      cvssVector,
      references: this._parseReferences(references),
      pluginOutput: pluginOutputs
    }
  }

  /**
   * Parse Nessus CSV format
   */
  async _parseNessusCsv(csvContent) {
    const vulns = []
    const rows = this.parseCsv(csvContent)
    
    for (const row of rows) {
      // Skip informational items
      if (row.Severity === '0') {
        continue
      }
      
      const vuln = {
        pluginId: row['Plugin ID'],
        pluginName: row['Plugin Name'],
        pluginFamily: row['Plugin Family'],
        severity: this._mapSeverity(row.Severity),
        riskFactor: row['Risk Factor'],
        hostName: row.Host,
        port: row.Port,
        protocol: row.Protocol,
        svcName: row['Service Name'],
        synopsis: row.Synopsis,
        description: row.Description,
        solution: row.Solution,
        cvssBaseScore: row['CVSS Base Score'],
        cvssVector: row['CVSS Vector'],
        references: this._parseReferences(row.References),
        pluginOutput: row['Plugin Output'] ? [row['Plugin Output']] : []
      }
      
      vulns.push(vuln)
    }
    
    return vulns
  }

  /**
   * Create findings from extracted vulnerabilities
   */
  async _createFindings() {
    this.findings = []
    
    // Group vulnerabilities by plugin ID for merging
    const vulnGroups = {}
    
    for (const vuln of this.vulns) {
      const key = `${vuln.pluginId}_${vuln.pluginName}`
      
      if (!vulnGroups[key]) {
        vulnGroups[key] = {
          title: vuln.pluginName,
          vulnType: 'Infrastructure',
          description: vuln.description || vuln.synopsis,
          observation: vuln.synopsis,
          remediation: vuln.solution,
          references: vuln.references,
          cvssv3: vuln.cvssBaseScore,
          priority: this._severityToPriority(vuln.severity),
          remediationComplexity: this._severityToComplexity(vuln.severity),
          category: 'Nessus',
          scope: [],
          hosts: []
        }
      }
      
      // Add host information
      const hostInfo = {
        host: vuln.hostName,
        port: vuln.port,
        protocol: vuln.protocol,
        service: vuln.svcName,
        pluginOutput: vuln.pluginOutput
      }
      
      vulnGroups[key].hosts.push(hostInfo)
      
      // Add to scope if not already present
      if (!vulnGroups[key].scope.includes(vuln.hostName)) {
        vulnGroups[key].scope.push(vuln.hostName)
      }
    }
    
    // Create findings with improved POC
    for (const [key, vulnData] of Object.entries(vulnGroups)) {
      vulnData.poc = this._createImprovedPoc(vulnData.hosts)
      vulnData.scope = vulnData.scope.join(', ')
      
      this.findings.push(vulnData)
    }
  }

  /**
   * Nessus-specific merge method to preserve POC formatting
   */
  _mergeNessusVulnGroup(findings) {
    const initialFinding = { ...findings[0] }
    const mergedFinding = initialFinding
    
    // Collect scopes for merging
    const tempMergedScope = []
    
    for (const finding of findings) {
      tempMergedScope.push(finding.scope)
    }

    // Set scope - combine all unique scopes
    const uniqueScopes = [...new Set(tempMergedScope)]
    mergedFinding.scope = uniqueScopes.length > 10 
      ? 'Multiple Targets' 
      : uniqueScopes.join(', ')

    // Keep the POC from the first finding (it's already properly formatted)
    // Don't manipulate the POC anymore since it's already correctly formatted
    
    return mergedFinding
  }

  /**
   * Create improved POC with one detailed example and list of other affected systems
   */
  _createImprovedPoc(hosts) {
    if (hosts.length === 0) {
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

  /**
   * Helper methods
   */
  _getElementText(parent, tagName) {
    const element = parent.getElementsByTagName(tagName)[0]
    return element ? element.textContent.trim() : ''
  }

  _mapSeverity(severity) {
    const severityMap = {
      '0': 'Info',
      '1': 'Low',
      '2': 'Medium',
      '3': 'High',
      '4': 'Critical'
    }
    return severityMap[severity] || 'Info'
  }

  _severityToPriority(severity) {
    const priorityMap = {
      'Critical': 1,
      'High': 2,
      'Medium': 3,
      'Low': 4,
      'Info': 4
    }
    return priorityMap[severity] || 4
  }

  _severityToComplexity(severity) {
    const complexityMap = {
      'Critical': 1,
      'High': 1,
      'Medium': 2,
      'Low': 3,
      'Info': 3
    }
    return complexityMap[severity] || 3
  }

  _parseReferences(references) {
    if (!references) return []
    
    // Split references by newlines or other delimiters
    return references.split(/\n|,|;/)
      .map(ref => ref.trim())
      .filter(ref => ref.length > 0)
  }

  /**
   * Import selected findings directly
   * @param {Array} selectedFindings - Array of findings to import
   */
  async importSelectedFindings(selectedFindings) {
    return await super.importSelectedFindings(selectedFindings)
  }
}

export default NessusParser