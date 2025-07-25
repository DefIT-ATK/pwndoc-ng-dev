import BaseParser from '../base-parser'
import * as XLSX from 'xlsx'

/**
 * Parser for PurpleKnight Excel files
 */
export default class PurpleKnightParser extends BaseParser {
  constructor(auditId, filenames, merge = true, dryRun = false) {
    super(auditId, filenames, merge, dryRun)
    this.name = 'PurpleKnight'
    this.supportedExtensions = ['.xlsx', '.xls']
  }

  /**
   * Parse PurpleKnight Excel file
   * @param {File} file - Excel file to parse
   * @returns {Promise<Array>} - Array of parsed findings
   */
  async parseFile(file) {
    try {
      console.log('Parsing PurpleKnight file:', file.name)
      
      // Read Excel file using SheetJS
      const arrayBuffer = await this._fileToArrayBuffer(file)
      const workbook = this._readExcelWorkbook(arrayBuffer)
      
      // Extract forest/domain name from Assessment summary sheet
      const assessmentSummary = this._parseAssessmentSummary(workbook)
      const forestName = this._extractForestName(assessmentSummary)
      
      // Parse Indicators results sheet
      const indicatorsResults = this._parseIndicatorsResults(workbook)
      
      // Filter for IOE Found findings (actual vulnerabilities)
      const vulnerableFindings = indicatorsResults.filter(row => row.Status === 'IOE Found')
      
      // Convert to standardized finding format
      const findings = vulnerableFindings.map(row => this._convertToFinding(row, forestName, file.name, workbook))
      
      console.log(`Parsed ${findings.length} PurpleKnight findings from ${file.name}`)
      return findings
      
    } catch (error) {
      console.error('Error parsing PurpleKnight file:', error)
      throw new Error(`Failed to parse PurpleKnight file: ${error.message}`)
    }
  }

  /**
   * Parse Assessment summary sheet to extract metadata
   */
  _parseAssessmentSummary(workbook) {
    const sheetName = 'Assessment summary'
    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error('Assessment summary sheet not found')
    }
    
    const worksheet = workbook.Sheets[sheetName]
    const data = this._worksheetToJson(worksheet)
    
    return data
  }

  /**
   * Extract forest/domain name from assessment summary
   */
  _extractForestName(assessmentData) {
    // Look for row containing "tenant" in description
    const tenantRow = assessmentData.find(row => 
      row.Description && row.Description.toString().includes(': tenant')
    )
    
    return tenantRow ? tenantRow.Value || 'Unknown Domain' : 'Unknown Domain'
  }

  /**
   * Parse Indicators results sheet
   */
  _parseIndicatorsResults(workbook) {
    const sheetName = 'Indicators results'
    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error('Indicators results sheet not found')
    }
    
    const worksheet = workbook.Sheets[sheetName]
    const data = this._worksheetToJson(worksheet)
    
    return data
  }

  /**
   * Convert PurpleKnight row to standardized finding format
   */
  _convertToFinding(row, forestName, fileName, workbook) {
    // Ensure title is never null/undefined
    const title = row.Name || 'Unknown PurpleKnight Finding'
    
    const finding = {
      title: title,
      vulnType: 'Active Directory',
      description: this._buildDescription(row),
      observation: this._buildObservation(row),
      remediation: this._sanitizeRemediation(row.Remediation),
      references: [],
      cvssv3: this._weightToCvssVector(row.Weight),
      priority: this._weightToPriority(row.Weight),
      remediationComplexity: this._weightToComplexity(row.Weight),
      category: 'PurpleKnight',
      scope: [forestName],
      hosts: [],
      customFields: [],
      // Additional metadata for parsing
      severity: this._weightToSeverity(row.Weight),
      cvssScore: this._weightToCvssScore(row.Weight),
      poc: this._buildProofOfConcept(row, workbook),
      // Metadata for tracking - store the processed finding itself, not raw row
      sourceFile: fileName,
      parser: 'PurpleKnight'
    }

    // Store the processed finding as originalFinding, not the raw row
    finding.originalFinding = finding

    return finding
  }

  /**
   * Build description from PurpleKnight data
   */
  _buildDescription(row) {
    let description = ''
    
    if (row.Description) {
      description += `<p>${this._sanitizeHtml(row.Description)}</p>`
    }
    
    if (row['Likelihood of compromise']) {
      description += `<p><strong>Likelihood of compromise:</strong> ${this._sanitizeHtml(row['Likelihood of compromise'])}</p>`
    }
    
    return description || '<p>No description available</p>'
  }

  /**
   * Build observation from PurpleKnight data
   */
  _buildObservation(row) {
    let observation = ''
    
    if (row['Result message']) {
      observation += `<p>${this._sanitizeHtml(row['Result message'])}</p>`
    }
    
    if (row.Status) {
      observation += `<p><strong>Status:</strong> ${this._sanitizeHtml(row.Status)}</p>`
    }
    
    return observation || '<p>No observation available</p>'
  }

  /**
   * Build proof of concept from result message and result sheet
   */
  _buildProofOfConcept(row, workbook) {
    let poc = ''
    
    if (row['Result message']) {
      poc += `<p>${this._sanitizeHtml(row['Result message'])}</p>`
    }
    
    // If there's a result sheet with data, parse it into an HTML table
    if (row.ShortName && row.Result && !this._isEmptyValue(row.Result)) {
      try {
        const resultTable = this._parseResultSheetToTable(workbook, row.ShortName)
        poc += resultTable
      } catch (error) {
        console.warn(`Failed to parse result sheet ${row.ShortName}:`, error)
        poc += `<p><strong>Detailed results available in sheet:</strong> ${row.ShortName}</p>`
      }
    }
    
    return poc || '<p>No proof of concept available</p>'
  }

  /**
   * Convert PurpleKnight weight to CVSS severity
   */
  _weightToSeverity(weight) {
    if (!weight || isNaN(weight)) return 'None'
    
    const numWeight = parseFloat(weight)
    
    // PurpleKnight weight mapping (based on typical AD security risk levels)
    if (numWeight >= 9.0) return 'Critical'
    if (numWeight >= 7.0) return 'High'
    if (numWeight >= 4.0) return 'Medium'
    if (numWeight >= 0.1) return 'Low'
    return 'None'
  }

  /**
   * Convert PurpleKnight weight to CVSS score
   */
  _weightToCvssScore(weight) {
    if (!weight || isNaN(weight)) return 0
    
    const numWeight = parseFloat(weight)
    // Clamp between 0 and 10
    return Math.max(0, Math.min(10, numWeight))
  }

  /**
   * Convert PurpleKnight weight to CVSS vector (simplified)
   */
  _weightToCvssVector(weight) {
    const score = this._weightToCvssScore(weight)
    
    if (score === 0) return null
    
    // Generate a basic CVSS 3.1 vector based on score
    // This is simplified - in practice you'd want more sophisticated mapping
    if (score >= 9.0) {
      return 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H'
    } else if (score >= 7.0) {
      return 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H'
    } else if (score >= 4.0) {
      return 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:L'
    } else {
      return 'CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N'
    }
  }

  /**
   * Convert PurpleKnight weight to priority (1-4 scale)
   */
  _weightToPriority(weight) {
    const severity = this._weightToSeverity(weight)
    const priorityMap = {
      'Critical': 1,
      'High': 2,
      'Medium': 3,
      'Low': 4,
      'None': 4
    }
    return priorityMap[severity] || 4
  }

  /**
   * Convert PurpleKnight weight to remediation complexity (1-3 scale)
   */
  _weightToComplexity(weight) {
    const severity = this._weightToSeverity(weight)
    const complexityMap = {
      'Critical': 1,
      'High': 1,
      'Medium': 2,
      'Low': 3,
      'None': 3
    }
    return complexityMap[severity] || 3
  }

  /**
   * Sanitize remediation text
   */
  _sanitizeRemediation(remediation) {
    if (!remediation || this._isEmptyValue(remediation)) {
      return 'No remediation information available'
    }
    
    return this._sanitizeHtml(remediation.toString())
  }

  /**
   * Check if value is empty (null, undefined, NaN, empty string)
   */
  _isEmptyValue(value) {
    return value === null || 
           value === undefined || 
           (typeof value === 'number' && isNaN(value)) ||
           (typeof value === 'string' && value.trim() === '')
  }

  /**
   * Basic HTML sanitization - escape special characters
   */
  _sanitizeHtml(text) {
    if (!text || typeof text !== 'string') {
      return ''
    }
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .trim()
  }

  /**
   * Convert file to ArrayBuffer for Excel parsing
   */
  async _fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = (e) => reject(new Error(`Failed to read file: ${e.target.error}`))
      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * Read Excel workbook from ArrayBuffer
   */
  _readExcelWorkbook(arrayBuffer) {
    try {
      return XLSX.read(arrayBuffer, { type: 'array' })
    } catch (error) {
      throw new Error(`Failed to read Excel file: ${error.message}`)
    }
  }

  /**
   * Convert worksheet to JSON array
   */
  _worksheetToJson(worksheet) {
    try {
      // Use default settings to get objects with column headers as keys
      return XLSX.utils.sheet_to_json(worksheet)
    } catch (error) {
      throw new Error(`Failed to convert worksheet to JSON: ${error.message}`)
    }
  }

  /**
   * Parse result sheet to HTML table (following your Python implementation)
   */
  _parseResultSheetToTable(workbook, sheetName, maxRows = 50, rowsNumber = 25) {
    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error(`Result sheet '${sheetName}' not found`)
    }

    const worksheet = workbook.Sheets[sheetName]
    const data = this._worksheetToJson(worksheet)

    if (!data || data.length === 0) {
      return '<p>No data available in result sheet</p>'
    }

    // Get all column names
    const allColumns = Object.keys(data[0])
    
    // Get exclusions from settings or use defaults
    const exclusions = this._getColumnExclusions()
    const columns = allColumns.filter(col => !exclusions.includes(col))

    let table = '<table><tbody>'

    // Create header row
    let headerRow = '<tr>'
    for (const column of columns) {
      headerRow += `<td colspan="1" rowspan="1"><p><strong>${this._sanitizeHtml(column)}</strong></p></td>`
    }
    headerRow += '</tr>'
    table += headerRow

    // Determine how many rows to show
    const totalRows = data.length
    const rowsToShow = totalRows >= maxRows ? rowsNumber : totalRows

    // Create data rows
    for (let i = 0; i < rowsToShow; i++) {
      const row = data[i]
      let dataRow = '<tr>'
      
      for (const column of columns) {
        const cellValue = row[column] || ''
        dataRow += `<td colspan="1" rowspan="1">${this._sanitizeHtml(cellValue.toString())}</td>`
      }
      
      dataRow += '</tr>'
      table += dataRow
    }

    table += '</tbody></table>'

    // Add prefix message if we're showing limited results
    if (totalRows >= maxRows) {
      return `<p>The first ${rowsNumber} entries are reported in the table below:</p>${table}`
    } else {
      return table
    }
  }

  /**
   * Get column exclusions from settings or return defaults
   */
  _getColumnExclusions() {
    try {
      // Try to get settings from global store or localStorage
      const settingsStr = localStorage.getItem('pwndoc-settings')
      if (settingsStr) {
        const settings = JSON.parse(settingsStr)
        const exclusions = settings.toolIntegrations?.purpleknight?.exclusions
        if (exclusions && Array.isArray(exclusions)) {
          return exclusions
        }
      }
    } catch (error) {
      console.warn('Failed to load PurpleKnight exclusions from settings:', error)
    }
    
    // Return default exclusions if settings not available
    return ['Ignored', 'EventTimestamp', 'ReplicationMetadata']
  }
}
