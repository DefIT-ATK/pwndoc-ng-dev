import BaseParser from '../../base-parser.js'

export default class BaseCustomParser extends BaseParser {
  constructor(auditId, files, merge, dryRun, config = {}) {
    super(auditId, files, merge, dryRun)
    this.config = config
    this.requiredFiles = []
    this.vulnerabilityTemplate = null
    this.name = 'CustomParser'
  }

  /**
   * Validate that all required files are present
   */
  validateRequiredFiles(files) {
    const errors = []
    
    this.requiredFiles.forEach((requirement, index) => {
      const matchingFiles = files.filter(file => 
        this.checkFileRequirement(file, requirement)
      )
      
      if (matchingFiles.length < (requirement.minCount || 1)) {
        errors.push(`Missing required file type: ${requirement.description || `Requirement ${index + 1}`}`)
      }
    })
    
    return errors
  }

  checkFileRequirement(file, requirement) {
    const { type, patterns } = requirement
    
    switch (type) {
      case 'filename':
        return patterns.some(pattern => this.matchPattern(file.name, pattern))
      case 'extension':
        return patterns.some(pattern => file.name.toLowerCase().endsWith(pattern.toLowerCase()))
      case 'content':
        // Would need file content checking - placeholder for now
        return file.contentSample && patterns.some(pattern => 
          file.contentSample.toLowerCase().includes(pattern.toLowerCase())
        )
      case 'regex':
        return patterns.some(pattern => {
          try {
            const regex = new RegExp(pattern, 'i')
            return regex.test(file.name) || (file.contentSample && regex.test(file.contentSample))
          } catch (error) {
            console.warn('Invalid regex pattern:', pattern)
            return false
          }
        })
      default:
        return false
    }
  }

  matchPattern(text, pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i')
    return regex.test(text)
  }

  /**
   * Create a standardized vulnerability finding
   */
  createVulnerabilityFinding(data) {
    const {
      title,
      description,
      observation = '',
      remediation,
      severity = 'Medium',
      cvssScore = 5.0,
      cvssVector = null,
      vulnType = 'Configuration',
      scope = '',
      poc = '',
      references = []
    } = data

    return {
      title,
      description,
      observation,
      remediation,
      severity,
      cvssScore,
      cvssv3: cvssVector,
      vulnType,
      scope,
      poc,
      references,
      category: this.name.replace('Parser', ''),
      originalFinding: data
    }
  }

  /**
   * Find files matching specific requirements
   */
  findFile(files, requirement) {
    return files.find(file => this.checkFileRequirement(file, requirement))
  }

  findFiles(files, requirement) {
    return files.filter(file => this.checkFileRequirement(file, requirement))
  }

  /**
   * Read file content as text
   */
  async readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
      reader.readAsText(file)
    })
  }

  /**
   * Parse CSV content into array of objects
   */
  parseCSV(content, delimiter = ',') {
    const lines = content.split('\n').filter(line => line.trim())
    if (lines.length === 0) return []

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''))
    const data = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''))
      if (values.length === headers.length) {
        const row = {}
        headers.forEach((header, index) => {
          row[header] = values[index]
        })
        data.push(row)
      }
    }

    return data
  }

  /**
   * Calculate CVSS score to severity mapping
   */
  cvssScoreToSeverity(score) {
    if (score === null || score === undefined || isNaN(score)) return 'None'
    if (score === 0) return 'None'
    if (score >= 9.0) return 'Critical'
    if (score >= 7.0) return 'High'
    if (score >= 4.0) return 'Medium'
    if (score >= 0.1) return 'Low'
    return 'None'
  }

  /**
   * Abstract method - must be implemented by subclasses
   */
  async parseFiles(files) {
    throw new Error('parseFiles method must be implemented by subclass')
  }

  /**
   * Abstract method - define vulnerability template
   */
  getVulnerabilityTemplate() {
    throw new Error('getVulnerabilityTemplate method must be implemented by subclass')
  }

  /**
   * Add custom vulnerability to audit - equivalent to Python addCustomVuln function
   * @param {string} title - Vulnerability title
   * @param {string} poc - Proof of concept content (including tables)
   * @param {Array} scope - Array of scopes
   * @param {Object} customFields - Additional custom fields
   */
  async addCustomVuln(title, poc, scope = [], customFields = {}) {
    try {
      // Get the vulnerability template from the database by title
      const vulnTemplate = await this.getVulnFromDbByTitle(title)
      
      if (!vulnTemplate) {
        console.warn(`Vulnerability template "${title}" not found in database`)
        return false
      }

      // Create new finding based on template
      const finding = this.createFindingFromTemplate(vulnTemplate)
      
      // Populate with custom data
      const observation = vulnTemplate.details?.[0]?.observation || ''
      finding.poc = observation + (poc || '')
      finding.scope = Array.isArray(scope) ? scope.join(', ') : scope || ''
      
      // Add any custom fields
      Object.assign(finding, customFields)
      
      // Add to findings array
      this.findings = this.findings || []
      this.findings.push(finding)
      
      console.log(`Added custom vulnerability: ${title}`)
      return true
      
    } catch (error) {
      console.error(`Error adding custom vulnerability "${title}":`, error)
      return false
    }
  }

  /**
   * Get vulnerability from database by title - mock implementation
   * In a real implementation, this would query the vulnerability database
   */
  async getVulnFromDbByTitle(title) {
    // Mock vulnerability templates - in real implementation, this would query the backend
    const vulnerabilityTemplates = {
      "Privileged Accounts Using Same Password Standard Account": {
        title: title,
        details: [{
          title: title,
          vulnType: "Internal",
          description: "Multiple privileged accounts are using the same password as standard user accounts, which significantly increases the risk of privilege escalation attacks.",
          observation: "During the security assessment, it was identified that several domain administrator accounts share identical password hashes with standard user accounts.\n\n",
          remediation: "1. Implement unique, complex passwords for all privileged accounts\n2. Enforce regular password rotation policies\n3. Implement privileged access management (PAM) solutions\n4. Use separate administrative accounts for privileged operations\n5. Monitor and audit privileged account activities",
          references: ["NIST SP 800-53", "CIS Controls"]
        }],
        cvssv3: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H",
        priority: 1,
        remediationComplexity: 2,
        category: "Active Directory"
      },
      "Weak Domain Administrative Passwords": {
        title: title,
        details: [{
          title: title,
          vulnType: "Internal", 
          description: "Domain administrative accounts are using weak passwords that can be easily cracked, compromising the entire Active Directory infrastructure.",
          observation: "Password cracking analysis revealed that several domain administrator accounts are using weak, easily guessable passwords.\n\n",
          remediation: "1. Enforce strong password policies for administrative accounts\n2. Implement multi-factor authentication for all privileged accounts\n3. Regular password auditing and cracking exercises\n4. Use passphrases instead of simple passwords\n5. Implement account lockout policies",
          references: ["OWASP Password Guidelines", "NIST SP 800-63"]
        }],
        cvssv3: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
        priority: 1,
        remediationComplexity: 1,
        category: "Active Directory"
      }
    }
    
    return vulnerabilityTemplates[title] || null
  }

  /**
   * Create finding from vulnerability template
   */
  createFindingFromTemplate(template) {
    const detail = template.details?.[0] || {}
    
    return {
      title: template.title || detail.title,
      vulnType: detail.vulnType || 'Internal',
      description: detail.description || '',
      observation: detail.observation || '',
      remediation: detail.remediation || '',
      references: detail.references || [],
      cvssv3: template.cvssv3 || '',
      priority: template.priority || 2,
      remediationComplexity: template.remediationComplexity || 2,
      category: template.category || 'General',
      poc: '',
      scope: '',
      status: 1,
      customFields: []
    }
  }

  /**
   * Create HTML table for PoC - equivalent to Python create_pwndoc_table
   * @param {Array} headers - Table headers
   * @param {Object|Array} data - Table data (object with keys as rows, or 2D array)
   */
  createPwndocTable(headers, data) {
    let tableRows = []
    
    if (Array.isArray(data)) {
      // Handle 2D array data
      tableRows = data
    } else if (typeof data === 'object') {
      // Handle object data - convert to array format
      tableRows = Object.entries(data).map(([key, value]) => {
        if (Array.isArray(value)) {
          return [key, value.join(', ')]
        }
        return [key, value]
      })
    }
    
    // Build HTML table
    let html = '<table border="1" style="border-collapse: collapse; width: 100%;">\n'
    
    // Add headers
    html += '  <tr style="background-color: #f2f2f2;">\n'
    headers.forEach(header => {
      html += `    <th style="padding: 8px; text-align: left;">${header}</th>\n`
    })
    html += '  </tr>\n'
    
    // Add data rows
    tableRows.forEach(row => {
      html += '  <tr>\n'
      row.forEach(cell => {
        html += `    <td style="padding: 8px;">${cell || ''}</td>\n`
      })
      html += '  </tr>\n'
    })
    
    html += '</table>\n\n'
    return html
  }

  /**
   * Override base parser methods to work with custom parsing
   */
  async _extractVulns(filenames) {
    // For custom parsers, we work directly with file objects
    return []
  }

  async _createFindings() {
    // Custom parsers handle this in parseFiles method
    return this.findings || []
  }
}
