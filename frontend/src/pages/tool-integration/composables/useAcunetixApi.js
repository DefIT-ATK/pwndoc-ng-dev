import { ref, computed } from 'vue'
import { Notify } from 'quasar'
import { $t } from '@/boot/i18n'
import AcunetixApiService from '@/services/acunetix-api'
import SettingsService from '@/services/settings'
import AcunetixParser from '@/services/parsers/acunetix-parser'
import { useVulnerabilityImport } from './useVulnerabilityImport'

/**
 * Composable for Acunetix API integration
 */
export function useAcunetixApi() {
  // Connection state
  const connected = ref(false)
  const connecting = ref(false)
  const connectionSettings = ref({
    serverAddress: '',
    email: '',
    password: ''
  })

  // Target groups
  const targetGroups = ref([])
  const loadingTargetGroups = ref(false)

  // Export state
  const exporting = ref(false)
  const exportProgress = ref(0)
  const exportedData = ref(null)
  const parsing = ref(false)

  // Import state
  const {
    importing,
    selectedAudit,
    confirmImport,
    showImportSuccess,
    showImportError
  } = useVulnerabilityImport()

  /**
   * Load Acunetix settings from the server
   */
  async function loadSettings() {
    try {
      const response = await SettingsService.getSettings()
      const acunetixSettings = response.data.datas.toolIntegrations?.acunetix || {}
      
      connectionSettings.value = {
        serverAddress: acunetixSettings.serverAddress || '',
        email: acunetixSettings.email || '',
        password: acunetixSettings.password || ''
      }
      
      return connectionSettings.value
    } catch (error) {
      console.error('Failed to load Acunetix settings:', error)
      Notify.create({
        message: 'Failed to load Acunetix settings',
        color: 'negative',
        position: 'top-right'
      })
      return null
    }
  }

  /**
   * Test connection to Acunetix
   */
  async function testConnection(settings = null) {
    const settingsToUse = settings || connectionSettings.value
    
    if (!settingsToUse.serverAddress || !settingsToUse.email || !settingsToUse.password) {
      Notify.create({
        message: 'Please fill in all connection settings',
        color: 'warning',
        position: 'top-right'
      })
      return false
    }

    connecting.value = true
    
    try {
      const result = await AcunetixApiService.testConnection(
        settingsToUse.serverAddress,
        settingsToUse.email,
        settingsToUse.password
      )
      
      if (result) {
        connected.value = true
        Notify.create({
          message: 'Successfully connected to Acunetix',
          color: 'positive',
          position: 'top-right'
        })
        return true
      } else {
        throw new Error('Authentication failed')
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      connected.value = false
      
      // Extract the specific error message from the response
      let errorMessage = 'Connection failed'
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.message) {
        errorMessage = error.message
      }
      
      Notify.create({
        message: errorMessage,
        color: 'negative',
        position: 'top-right'
      })
      return false
    } finally {
      connecting.value = false
    }
  }

  /**
   * Connect to Acunetix using saved settings
   */
  async function connect() {
    const settings = await loadSettings()
    if (settings) {
      const connectionResult = await testConnection(settings)
      if (connectionResult) {
        // Automatically load target groups after successful connection
        await loadTargetGroups()
      }
      return connectionResult
    }
    return false
  }

  /**
   * Disconnect from Acunetix
   */
  function disconnect() {
    connected.value = false
    targetGroups.value = []
    exportedData.value = null
    parsing.value = false
    exporting.value = false
    exportProgress.value = 0
    
    Notify.create({
      message: 'Disconnected from Acunetix',
      color: 'info',
      position: 'top-right'
    })
  }

  /**
   * Load target groups from Acunetix
   */
  async function loadTargetGroups() {
    if (!connected.value) {
      Notify.create({
        message: 'Not connected to Acunetix',
        color: 'warning',
        position: 'top-right'
      })
      return
    }

    loadingTargetGroups.value = true
    
    try {
      const groups = await AcunetixApiService.getTargetGroups()
      console.log('Raw groups from service:', groups)
      
      targetGroups.value = groups
        .filter(group => group.name && group.name.trim() !== '') // Filter out groups without names
        .map(group => ({
          label: group.name, // Just show the name, clean and simple
          value: group.group_id,
          name: group.name,
          description: group.description,
          targetCount: group.target_count || 0,
          vulnCount: group.vuln_count || { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          raw: group
        }))
      
      console.log('Processed target groups:', targetGroups.value)
      
      Notify.create({
        message: `Loaded ${targetGroups.value.length} target groups`,
        color: 'positive',
        position: 'top-right'
      })
    } catch (error) {
      console.error('Failed to load target groups:', error)
      Notify.create({
        message: `Failed to load target groups: ${error.message}`,
        color: 'negative',
        position: 'top-right'
      })
    } finally {
      loadingTargetGroups.value = false
    }
  }

  /**
   * Export vulnerabilities from selected target group
   */
  async function exportVulnerabilities(targetGroupId) {
    if (!targetGroupId) {
      Notify.create({
        message: 'No target group ID provided',
        color: 'warning',
        position: 'top-right'
      })
      return null
    }

    try {
      const reportData = await AcunetixApiService.exportVulnerabilities(
        targetGroupId
      )
      
      exportedData.value = reportData
      return reportData
    } catch (error) {
      console.error('Export failed:', error)
      
      Notify.create({
        message: `Export failed: ${error.message}`,
        color: 'negative',
        position: 'top-right'
      })
      
      throw error
    }
  }

  /**
   * Get target group name by ID
   */
  function getSelectedTargetGroupName(targetGroupId) {
    const selected = targetGroups.value.find(tg => tg.value === targetGroupId)
    return selected ? selected.name : 'unknown'
  }

  return {
    // Connection state
    connected,
    connecting,
    connectionSettings,
    
    // Target groups
    targetGroups,
    loadingTargetGroups,
    
    // Export state
    exporting,
    exportProgress,
    exportedData,
    parsing,
    
    // Import state
    importing,
    selectedAudit,
    confirmImport,
    
    // Functions
    loadSettings,
    testConnection,
    connect,
    disconnect,
    loadTargetGroups,
    exportVulnerabilities,
    getSelectedTargetGroupName
  }
}
