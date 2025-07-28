/**
 * Central registry for all parsers
 * This defines the configuration for each parser type and provides
 * a single source of truth for parser metadata
 */

export const PARSER_REGISTRY = {
  nessus: {
    name: 'Nessus',
    description: 'Tenable Nessus vulnerability scanner',
    extensions: ['.nessus', '.xml'],
    acceptedFormats: 'Nessus files (.nessus, .xml)',
    component: 'NessusTab',
    composable: 'useNessusParser',
    icon: 'security',
    color: 'primary',
    classification: {
      content: ['NessusClientData_v2', '<NessusClientData', 'tenable', 'nessus'],
      mandatory: ['extension'],
      confidence: 0.9
    }
  },

  acunetix: {
    name: 'Acunetix',
    description: 'Acunetix web vulnerability scanner',
    extensions: ['.xml'],
    acceptedFormats: 'Acunetix XML files (.xml)',
    component: 'AcunetixTab',
    composable: 'useAcunetixParser',
    icon: 'web',
    color: 'secondary',
    classification: {
      content: ['acunetix', 'ScanGroup', 'WebApplicationScan'],
      mandatory: ['extension'],
      confidence: 0.8
    }
  },

  pingcastle: {
    name: 'PingCastle',
    description: 'Active Directory security assessment',
    extensions: ['.html', '.xml'],
    acceptedFormats: 'PingCastle reports (.html, .xml)',
    component: 'PingCastleTab',
    composable: 'usePingCastleParser',
    icon: 'domain',
    color: 'info',
    classification: {
      content: ['pingcastle', 'PingCastle', 'Active Directory'],
      mandatory: ['extension'],
      confidence: 0.8
    }
  },

  purpleknight: {
    name: 'Purple Knight',
    description: 'Semperis Purple Knight AD assessment',
    extensions: ['.json', '.xml', '.html'],
    acceptedFormats: 'Purple Knight reports (.json, .xml, .html)',
    component: 'PurpleKnightTab',
    composable: 'usePurpleKnightParser',
    icon: 'shield',
    color: 'purple',
    classification: {
      content: ['purple knight', 'purpleknight', 'semperis'],
      mandatory: ['extension'],
      confidence: 0.8
    }
  },

  powerupsql: {
    name: 'PowerUpSQL',
    description: 'PowerShell SQL Server assessment toolkit',
    extensions: ['.csv', '.txt'],
    acceptedFormats: 'PowerUpSQL output (.csv, .txt)',
    component: 'PowerUpSQLTab',
    composable: 'usePowerUpSQLParser',
    icon: 'storage',
    color: 'warning',
    classification: {
      content: ['powerupsql', 'ComputerName', 'Instance', 'Vulnerability'],
      mandatory: ['extension'],
      confidence: 0.8
    }
  },

  custom: {
    name: 'Custom',
    description: 'Custom file processing with manual classification',
    extensions: ['*'],
    acceptedFormats: 'All file formats supported',
    component: 'CustomTab',
    composable: 'useCustomParsers',
    icon: 'build',
    color: 'grey',
    classification: {
      content: [], // Custom parser doesn't auto-classify
      mandatory: [],
      confidence: 0.1 // Lowest priority - fallback
    }
  }
}

/**
 * Get parser configuration by type
 */
export function getParserConfig(parserType) {
  return PARSER_REGISTRY[parserType] || null
}

/**
 * Get all parser types
 */
export function getAllParserTypes() {
  return Object.keys(PARSER_REGISTRY)
}

/**
 * Get parsers that support a specific file extension
 */
export function getParsersByExtension(extension) {
  const results = []
  for (const [type, config] of Object.entries(PARSER_REGISTRY)) {
    if (config.extensions.includes(extension) || config.extensions.includes('*')) {
      results.push({ type, config })
    }
  }
  return results
}

/**
 * Get classification patterns for file routing
 */
export function getClassificationPatterns() {
  const patterns = {}
  for (const [type, config] of Object.entries(PARSER_REGISTRY)) {
    patterns[type] = config.classification
  }
  return patterns
}

/**
 * Get parser display information for UI
 */
export function getParserDisplayInfo(parserType) {
  const config = getParserConfig(parserType)
  if (!config) return null
  
  return {
    name: config.name,
    description: config.description,
    icon: config.icon,
    color: config.color,
    acceptedFormats: config.acceptedFormats
  }
}
