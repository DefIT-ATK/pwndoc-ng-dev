import axios from 'axios'

/**
 * Acunetix API service that proxies requests through the backend
 * to avoid CORS issues when accessing Acunetix directly from the browser
 */
class AcunetixApiService {
  constructor() {
    this.authHeaders = null
    this.serverAddress = null
  }

  /**
   * Authenticate with Acunetix server through backend proxy
   * @param {string} serverAddress - Acunetix server URL
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<boolean>} - Authentication success status
   */
  async authenticate(serverAddress, email, password) {
    try {
      const response = await axios.post('/api/acunetix/auth', {
        serverAddress,
        email,
        password
      })

      if (response.data.success) {
        this.sessionKey = response.data.sessionKey
        this.serverAddress = serverAddress
        console.log('Authentication successful, session key:', this.sessionKey);
        return true
      }
      
      throw new Error(response.data.message || 'Authentication failed')
    } catch (error) {
      console.error('Acunetix authentication failed:', error)
      throw error
    }
  }

  /**
   * Test connection to Acunetix server
   * @param {string} serverAddress - Acunetix server URL
   * @param {string} email - User email  
   * @param {string} password - User password
   * @returns {Promise<boolean>} - Connection test result
   */
  async testConnection(serverAddress, email, password) {
    try {
      await this.authenticate(serverAddress, email, password)
      return true
    } catch (error) {
      // Re-throw the error so the caller can handle it with specific error messages
      console.error('Test connection failed:', error)
      throw error
    }
  }

  /**
   * Get all target groups from Acunetix
   * @returns {Promise<Array>} - Array of target groups
   */
  async getTargetGroups() {
    if (!this.sessionKey || !this.serverAddress) {
      throw new Error('Not authenticated')
    }

    try {
      console.log('Making target groups request with session key:', this.sessionKey);
      console.log('Server address:', this.serverAddress);
      
      const response = await axios.get('/api/acunetix/target-groups', {
        params: {
          serverAddress: this.serverAddress,
          sessionKey: this.sessionKey
        }
      })

      console.log('Target groups response:', response.data);

      if (response.data.success) {
        return response.data.groups.map(group => ({
          group_id: group.group_id,
          name: group.name,
          description: group.description || '',
          target_count: group.target_count || 0,
          vuln_count: group.vuln_count || {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0
          }
        }))
      }
      
      throw new Error(response.data.message || 'Failed to get target groups')
    } catch (error) {
      console.error('Failed to get target groups:', error)
      console.error('Error response:', error.response?.data)
      throw error
    }
  }

  /**
   * Get vulnerability IDs for a specific target group
   * @param {string} targetGroupId - Target group ID
   * @returns {Promise<Array>} - Array of vulnerability IDs
   */
  async getVulnerabilityIds(targetGroupId) {
    if (!this.sessionKey || !this.serverAddress) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.post('/api/acunetix/vulnerabilities', {
        serverAddress: this.serverAddress,
        sessionKey: this.sessionKey,
        targetGroupId
      })

      if (response.data.success) {
        return response.data.vulnerabilityIds
      }
      
      throw new Error(response.data.message || 'Failed to get vulnerability IDs')
    } catch (error) {
      console.error('Failed to get vulnerability IDs:', error)
      throw error
    }
  }

  /**
   * Export vulnerabilities for a target group (full workflow)
   * @param {string} targetGroupId - Target group ID
   * @param {string} targetGroupName - Target group name
   * @returns {Promise<Object>} - Export report data
   */
  async exportTargetGroup(targetGroupId, targetGroupName) {
    if (!this.sessionKey || !this.serverAddress) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.post('/api/acunetix/export-target-group', {
        serverAddress: this.serverAddress,
        sessionKey: this.sessionKey,
        targetGroupId,
        targetGroupName
      })

      if (response.data.success) {
        return response.data
      }
      
      throw new Error(response.data.message || 'Failed to export target group')
    } catch (error) {
      console.error('Failed to export target group:', error)
      throw error
    }
  }

  /**
   * Generate export report for vulnerabilities
   * @param {Array} vulnerabilityIds - Array of vulnerability IDs
   * @returns {Promise<string>} - Report ID
   */
  async generateReport(vulnerabilityIds) {
    if (!this.sessionKey || !this.serverAddress) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.post('/api/acunetix/export', {
        serverAddress: this.serverAddress,
        sessionKey: this.sessionKey,
        vulnerabilityIds
      })

      if (response.data.success) {
        return response.data.reportId
      }
      
      throw new Error(response.data.message || 'Failed to generate report')
    } catch (error) {
      console.error('Failed to generate report:', error)
      throw error
    }
  }

  /**
   * Check report status and get download link
   * @param {string} reportId - Report ID
   * @returns {Promise<string|null>} - Download link or null if not ready
   */
  async getReportStatus(reportId) {
    if (!this.sessionKey || !this.serverAddress) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.post('/api/acunetix/report-status', {
        serverAddress: this.serverAddress,
        sessionKey: this.sessionKey,
        reportId
      })

      if (response.data.success) {
        return response.data.downloadLink
      }
      
      throw new Error(response.data.message || 'Failed to get report status')
    } catch (error) {
      console.error('Failed to get report status:', error)
      throw error
    }
  }

  /**
   * Download report data
   * @param {string} downloadLink - Download link from report status
   * @returns {Promise<Object>} - Report data
   */
  async downloadReport(downloadLink) {
    if (!this.sessionKey || !this.serverAddress) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.post('/api/acunetix/download', {
        serverAddress: this.serverAddress,
        sessionKey: this.sessionKey,
        downloadLink
      })

      if (response.data.success) {
        return response.data.data
      }
      
      throw new Error(response.data.message || 'Failed to download report')
    } catch (error) {
      console.error('Failed to download report:', error)
      throw error
    }
  }

  /**
   * Get export progress for the current session
   * @returns {Promise<Object|null>} - Progress data or null
   */
  async getExportProgress() {
    if (!this.sessionKey) {
      return null
    }

    try {
      // URL encode the session key to handle special characters
      const encodedSessionKey = encodeURIComponent(this.sessionKey)
      const response = await axios.get(`/api/acunetix/export-progress/${encodedSessionKey}`)
      
      if (response.data.success) {
        return response.data.progress
      }
      
      return null
    } catch (error) {
      console.error('Failed to get export progress:', error)
      return null
    }
  }

  /**
   * Export vulnerabilities for a target group with progress tracking
   * @param {string} targetGroupId - Target group ID
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<Object>} - Exported vulnerability data
   */
  async exportVulnerabilities(targetGroupId, progressCallback = () => {}) {
    try {
      // Get target group name for display  
      const targetGroupName = targetGroupId // Use ID as fallback name

      progressCallback('Starting export...', 0)
      console.log('Starting export for target group:', targetGroupId)
      console.log('Session key for progress tracking:', this.sessionKey)
      
      // Start the export process first
      const exportPromise = this.exportTargetGroup(targetGroupId, targetGroupName)
      
      // Wait a moment for the backend to initialize progress tracking
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Start polling for progress updates
      const progressInterval = setInterval(async () => {
        try {
          const progress = await this.getExportProgress()
          console.log('Progress poll result:', progress)
          if (progress) {
            const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
            console.log(`Progress update: ${progress.message} (${percentage}%)`)
            progressCallback(progress.message, percentage, progress)
            
            // Stop polling if completed or errored
            if (progress.phase === 'completed' || progress.phase === 'error') {
              console.log('Export completed or errored, stopping progress polling')
              clearInterval(progressInterval)
            }
          } else {
            console.log('No progress data available yet')
          }
        } catch (error) {
          console.error('Error fetching progress:', error)
        }
      }, 1000) // Poll every second
      
      // Wait for export to complete
      const result = await exportPromise
      
      // Clear the interval in case it's still running
      clearInterval(progressInterval)
      
      if (result.success) {
        progressCallback(`Export completed: ${result.totalVulnerabilities} vulnerabilities processed`, 100)
        return result.reportData
      } else {
        throw new Error(result.message || 'Export failed')
      }
    } catch (error) {
      console.error('Export error:', error)
      progressCallback(`Export failed: ${error.message}`, 0)
      throw error
    }
  }

  /**
   * Parse vulnerability count from target group data
   * @private
   */
  _parseVulnCount(group) {
    // Return a default structure since we don't have vuln counts from target groups API
    // In practice, this would need to be fetched separately if needed
    return {
      critical: 0,
      high: 0, 
      medium: 0,
      low: 0,
      info: 0
    }
  }

  /**
   * Clear authentication state
   */
  disconnect() {
    this.authHeaders = null
    this.serverAddress = null
  }
}

export default new AcunetixApiService()
