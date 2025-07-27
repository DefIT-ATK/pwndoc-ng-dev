import BaseCustomParser from './base-custom-parser.js'

export default class AdminPasswordSharingParser extends BaseCustomParser {
  constructor(auditId, files, merge, dryRun, config = {}) {
    super(auditId, files, merge, dryRun, config)
    this.name = 'AdminPasswordSharingParser'
  }

  /**
   * Parse files and create vulnerabilities - based on your Python process_enabled_users_and_da function
   */
  async parseFiles(files) {
    console.log('> Searching for shared passwords between enabled users and domain admins')
    
    // Find the required files based on dependency system
    const enabledUsersFile = this.findFileByType(files, ['NTDS Dump Enabled Users', 'NTDS Dump CSV'])
    const daFile = this.findFileByType(files, ['Domain Admins List'])

    if (!enabledUsersFile || !daFile) {
      throw new Error('Required files not found: NTDS Dump Enabled Users and Domain Admins List')
    }

    console.log(`Enabled Users File: ${enabledUsersFile.name}`)
    console.log(`Domain Admins File: ${daFile.name}`)

    // Process both files together - equivalent to prepare_poc function
    const { poc, scope } = await this.preparePoc(enabledUsersFile, daFile)
    
    if (!poc || !scope) {
      console.log('No shared passwords found between enabled users and domain admins')
      return []
    }

    // Add custom vulnerability - equivalent to addCustomVuln call
    const success = await this.addCustomVuln(
      "Privileged Accounts Using Same Password Standard Account", 
      poc, 
      [scope]
    )

    if (success) {
      console.log('Successfully created Admin Password Sharing vulnerability')
    }

    return this.findings || []
  }

  /**
   * Process both files together - equivalent to your Python prepare_poc function
   */
  async preparePoc(enabledUsersFile, daFile) {
    try {
      // Read both files
      const enabledUsersContent = await this.readFileAsText(enabledUsersFile)
      const daContent = await this.readFileAsText(daFile)

      const enabledUsersLines = enabledUsersContent.split('\n').filter(line => line.trim())
      const daLines = daContent.split('\n').filter(line => line.trim())

      if (enabledUsersLines.length === 0 || daLines.length === 0) {
        return { poc: null, scope: null }
      }

      // Extract the Domain from the first line
      const scope = enabledUsersLines[0].includes('\\') ? 
        enabledUsersLines[0].split('\\')[0] : 
        'DOMAIN'

      // Create a dictionary to store admin hashes
      const adminHashes = {}

      // Process each line in enabled_users_lines
      for (const line of enabledUsersLines) {
        if (!line.includes(':')) continue
        
        const parts = line.split(':')
        if (parts.length < 4) continue

        // Extract username - handle both domain\username and username formats
        const username = parts[0].includes('\\') ? 
          parts[0].split('\\')[1] : 
          parts[0]
        
        const hash = parts[3]

        // Check if the username is in DA list
        if (daLines.some(daLine => daLine.trim() === username)) {
          adminHashes[username] = hash
        }
      }

      // Find matching hashes among admins and other users
      const adminMatches = {}
      
      for (const [username, hash] of Object.entries(adminHashes)) {
        const matchingUsernames = []
        
        for (const line of enabledUsersLines) {
          if (!line.includes(':')) continue
          
          const parts = line.split(':')
          if (parts.length < 4) continue

          const lineUsername = parts[0].includes('\\') ? 
            parts[0].split('\\')[1] : 
            parts[0]
          const lineHash = parts[3]

          // Skip if same user or different hash
          if (lineUsername === username || lineHash !== hash) continue

          matchingUsernames.push(lineUsername)
        }

        if (matchingUsernames.length > 0) {
          adminMatches[username] = matchingUsernames
        }
      }

      if (Object.keys(adminMatches).length === 0) {
        console.log('No shared passwords found between enabled users and domain admins')
        return { poc: null, scope: null }
      }

      // Create PoC table
      const poc = this.createPwndocTable(
        ["Domain Admin", "Domain Users with the same password"],
        adminMatches
      )

      return { poc, scope }

    } catch (error) {
      console.error('Error processing files:', error)
      return { poc: null, scope: null }
    }
  }

  /**
   * Find file by type classification (using the enhanced file detection)
   */
  findFileByType(files, types) {
    for (const file of files) {
      // Check if file matches any of the specified types
      // This would be enhanced with the actual file classification logic
      if (types.some(type => this.matchesFileType(file, type))) {
        return file  
      }
    }
    return null
  }

  /**
   * Check if file matches a specific type - placeholder for enhanced detection
   */
  matchesFileType(file, type) {
    const fileName = file.name.toLowerCase()
    
    switch (type) {
      case 'NTDS Dump Enabled Users':
        return fileName.includes('enabled_users') || 
               fileName.includes('ntds') ||
               fileName.includes('hashcat')
      case 'NTDS Dump CSV':
        return fileName.includes('ntds') && fileName.endsWith('.csv')
      case 'Domain Admins List':
        return fileName.includes('da.txt') ||
               fileName.includes('domain_admin') ||
               fileName.includes('admin_list')
      default:
        return false
    }
  }

  getVulnerabilityTemplate() {
    return {
      title: "Privileged Accounts Using Same Password Standard Account",
      severity: "Critical",
      category: "Active Directory",
      description: "Multiple privileged accounts share identical passwords with standard user accounts.",
      remediation: "Implement unique passwords for all privileged accounts and enforce password policies."
    }
  }
}
