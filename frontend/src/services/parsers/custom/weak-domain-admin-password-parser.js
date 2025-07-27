import BaseCustomParser from './base-custom-parser.js'

export default class WeakDomainAdminPasswordParser extends BaseCustomParser {
  constructor(auditId, files, merge, dryRun, config = {}) {
    super(auditId, files, merge, dryRun, config)
    this.name = 'WeakDomainAdminPasswordParser'
    
    this.requiredFiles = [
      {
        type: 'filename',
        patterns: ['*ntds*', '*password*crack*', '*weak*password*', '*cracked*', '*hashcat*'],
        minCount: 1,
        description: 'NTDS dump or password cracking results'
      }
    ]
  }

  async parseFiles(files) {
    console.log('WeakDomainAdminPasswordParser: Starting analysis...')
    
    // Validate required files
    const errors = this.validateRequiredFiles(files)
    if (errors.length > 0) {
      throw new Error(`Missing required files: ${errors.join(', ')}`)
    }

    // Find the password file
    const passwordFile = this.findFile(files, this.requiredFiles[0])
    if (!passwordFile) {
      throw new Error('Could not identify password file')
    }

    console.log(`Processing password file: ${passwordFile.name}`)

    // Parse the password file
    const crackedPasswords = await this.parsePasswordFile(passwordFile)
    
    // Analyze for weak admin passwords
    const analysis = this.analyzeWeakPasswords(crackedPasswords)

    // Create vulnerability findings
    const findings = []
    if (analysis.hasWeakAdminPasswords) {
      findings.push(this.createWeakPasswordFinding(analysis))
    }

    this.findings = findings
    return findings
  }

  async parsePasswordFile(file) {
    console.log('Parsing password cracking results...')
    
    const content = await this.readFileAsText(file)
    const crackedPasswords = []
    
    // Try different formats
    if (content.includes(':') && content.includes('\n')) {
      // Format: username:password or username:hash:password
      const lines = content.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        const parts = line.split(':')
        if (parts.length >= 2) {
          const username = parts[0].trim()
          const password = parts.length === 2 ? parts[1].trim() : parts[2]?.trim()
          
          if (username && password && password !== 'NO PASSWORD***') {
            crackedPasswords.push({
              username,
              password,
              isWeak: this.isWeakPassword(password),
              isAdmin: this.isLikelyAdmin(username)
            })
          }
        }
      }
    } else if (content.includes(',')) {
      // CSV format
      const data = this.parseCSV(content)
      for (const row of data) {
        const username = row.Username || row.username || row.User || Object.values(row)[0]
        const password = row.Password || row.password || row.Plaintext || Object.values(row)[1]
        
        if (username && password) {
          crackedPasswords.push({
            username,
            password,
            isWeak: this.isWeakPassword(password),
            isAdmin: this.isLikelyAdmin(username)
          })
        }
      }
    }

    console.log(`Parsed ${crackedPasswords.length} cracked passwords`)
    return crackedPasswords
  }

  isWeakPassword(password) {
    if (!password || password.length < 8) return true
    
    const weakPatterns = [
      /^password/i,
      /^123456/,
      /^admin/i,
      /^welcome/i,
      /^company/i,
      /^qwerty/i,
      /^letmein/i,
      /^changeme/i,
      /^default/i,
      /^temp/i,
      /^pass/i,
      /^user/i,
      /^guest/i,
      /^root/i,
      /^\d{4,8}$/,  // Only numbers
      /^[a-zA-Z]+$/  // Only letters
    ]
    
    return weakPatterns.some(pattern => pattern.test(password))
  }

  isLikelyAdmin(username) {
    if (!username) return false
    
    const adminPatterns = [
      /admin/i,
      /administrator/i,
      /root/i,
      /sa$/i,  // SQL Server admin
      /svc/i,  // Service accounts
      /service/i,
      /domain.*admin/i,
      /enterprise.*admin/i,
      /schema.*admin/i,
      /backup/i,
      /operator/i
    ]
    
    return adminPatterns.some(pattern => pattern.test(username))
  }

  analyzeWeakPasswords(crackedPasswords) {
    console.log('Analyzing weak password patterns...')
    
    const weakAdminPasswords = crackedPasswords.filter(entry => 
      entry.isAdmin && entry.isWeak
    )
    
    const allWeakPasswords = crackedPasswords.filter(entry => entry.isWeak)
    const adminAccounts = crackedPasswords.filter(entry => entry.isAdmin)
    
    // Group by password to find reuse
    const passwordGroups = new Map()
    for (const entry of crackedPasswords) {
      if (!passwordGroups.has(entry.password)) {
        passwordGroups.set(entry.password, [])
      }
      passwordGroups.get(entry.password).push(entry.username)
    }
    
    const sharedPasswords = Array.from(passwordGroups.entries())
      .filter(([password, users]) => users.length > 1)
      .map(([password, users]) => ({ password, users, count: users.length }))
    
    const hasWeakAdminPasswords = weakAdminPasswords.length > 0
    
    console.log(`Analysis complete: ${hasWeakAdminPasswords ? 'Weak admin passwords found' : 'No weak admin passwords detected'}`)
    
    return {
      hasWeakAdminPasswords,
      weakAdminPasswords,
      allWeakPasswords,
      adminAccounts,
      sharedPasswords,
      totalCracked: crackedPasswords.length
    }
  }

  createWeakPasswordFinding(analysis) {
    const weakAdminDetails = analysis.weakAdminPasswords
      .map(entry => `• ${entry.username}: "${entry.password}"`)
      .join('\n')

    const sharedPasswordDetails = analysis.sharedPasswords.length > 0 
      ? `\n\nPassword Reuse Detected:\n${analysis.sharedPasswords.map(sp => 
          `• "${sp.password}" (${sp.count} accounts: ${sp.users.join(', ')})`
        ).join('\n')}`
      : ''

    const poc = `Weak Domain Administrator Password Analysis:

Total cracked passwords: ${analysis.totalCracked}
Administrative accounts identified: ${analysis.adminAccounts.length}
Weak administrative passwords: ${analysis.weakAdminPasswords.length}
Password reuse instances: ${analysis.sharedPasswords.length}

Weak Administrative Passwords Found:
${weakAdminDetails}${sharedPasswordDetails}

These weak passwords pose a significant security risk as they can be easily guessed or cracked by attackers, potentially leading to complete domain compromise.`

    return this.createVulnerabilityFinding({
      title: 'Weak Domain Administrator Passwords Detected',
      description: `Domain administrator accounts have been identified using weak, easily guessable passwords. This creates a critical security vulnerability as these accounts have elevated privileges across the entire domain. Weak administrative passwords can be exploited through various attack vectors including brute force attacks, credential stuffing, and social engineering, potentially leading to complete domain compromise.`,
      observation: `Password analysis revealed ${analysis.weakAdminPasswords.length} administrative accounts using weak passwords out of ${analysis.adminAccounts.length} total administrative accounts analyzed.`,
      remediation: `1. Immediately change all weak administrative passwords to strong, complex passwords\n2. Implement and enforce strong password policies for administrative accounts\n3. Enable account lockout policies to prevent brute force attacks\n4. Implement multi-factor authentication for all administrative accounts\n5. Regular password audits and strength assessments\n6. Consider implementing Privileged Access Management (PAM) solutions\n7. Use unique passwords for each administrative account\n8. Implement password rotation policies`,
      severity: 'Critical',
      cvssScore: 9.1,
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      vulnType: 'Configuration',
      scope: 'Domain Controllers',
      poc,
      references: [
        'https://attack.mitre.org/techniques/T1110/',
        'https://attack.mitre.org/techniques/T1078/',
        'https://docs.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/password-policy'
      ]
    })
  }

  getVulnerabilityTemplate() {
    return {
      title: 'Weak Domain Administrator Passwords Detected',
      description: 'Domain administrator accounts are using weak, easily guessable passwords',
      severity: 'Critical',
      vulnType: 'Configuration'
    }
  }
}
