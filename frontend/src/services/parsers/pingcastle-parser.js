import BaseParser from '../base-parser'

/**
 * PingCastle parser for importing vulnerabilities from PingCastle AD Health Check reports
 */
export class PingCastleParser extends BaseParser {
  constructor(auditId, filenames, merge = true, dryRun = false, pingcastleMap = null) {
    super(auditId, filenames, merge, dryRun)
    this.domainName = null
    this.risks = {}
    // Use the provided map, or fall back to the default
    this.pingcastleMap = pingcastleMap || {
      "A-Krbtgt" : "Kerberos password last change",
      "P-Delegated":"Administrator Accounts without the \"this account is sensitive and cannot be delegated\" flag",
      "P-Kerberoasting":"Admin users vulnerable to Kerberoast attack",
      "S-PwdLastSet-DC":"DC without password change",
      "S-PwdLastSet-90":"Computer(s) without password change for at least 3 months",
      "P-ServiceDomainAdmin":"Presence of service accounts in the domain admin group",
      "P-UnkownDelegation" : "Presence of unknown delegation",
      "S-SMB-v1":"SMB Version 1 Activated",
      "P-AdminPwdTooOld":"Admin users with password older than 3 years",
      "P-ProtectedUsers":"Privileged accounts not in the \"Protected Group\"",
      "P-ControlPathIndirectMany":"Large Number of Privileged Accounts",
      "A-PreWin2000Anonymous":"Everyone and/or Anonymous present in the Pre-Windows 2000 group",
      "S-PwdNeverExpires":"Accounts with never-expiring password",
      "A-NoGPOLLMNR":"No GPO has been found which disables LLMNR",
      "T-Inactive":"At least one inactive trust has been found",
      "A-MinPwdLen":"Password policy length is less than 8 characters",
      "S-ADRegistration":"Non-admin users can add up to 10 computers to a domain",
      "P-DelegationFileDeployed":"Files can be modified by everyone (GPO)",
      "A-PwdGPO":"Password(s) found in GPO",
      "P-AdminLogin":"Native administrator usage",
      "S-PwdNotRequired":"Password not required",
      "T-SIDHistoryUnknownDomain":"Unknown domain(s) used in SIDHistory",
      "P-DelegationLoginScript":"Login scripts can be modified by any user",
      "P-AdminNum":"Large Number of users in Admins group",
      "P-PrivilegeEveryone":"Privileges granted to everyone by GPO",
      "P-ExchangePrivEsc":"Exchange Windows Permissions group can change security descriptor",
      "A-CertTempAgent":"Certificate template can be used to issue agent certiticates to everyone",
      "S-NoPreAuth":"Kerberos Preauthentication Not Required",
      "P-Inactive":"Inactive Domain Administrators",
      "S-Inactive":"Inactive User or Computers",
      "P-UnconstrainedDelegation":"Unconstrained delegation",
      "S-DesEnabled":"Presence of DES Enabled Account",
      "A-DnsZoneAUCreateChild":"Authenticated Users can create DNS records",
      "S-WSUS-HTTP":"WSUS configuration using HTTP instead of HTTPS",
      "A-BackupMetadata":"AD last backup date",
      "S-ADRegistrationSchema":"Vulnerable Schema Class",
      "S-DC-2003": "Obsolete Domain Controller (Windows 2003)",
      "A-DnsZoneUpdate1": "DNS Zones are configured with unsecure update",
      "S-DCRegistration": "Domain Controllers are misconfigured",
      "S-DC-Inactive":"Inactive Domain Controllers",
      "P-DCOwner": "Domain Controller not owned correctly",
      "A-DCLdapSign": "LDAP Authentication without signature enforcement",
      "S-DC-NotUpdated": "Domain Controller not updated",
      "A-CertTempAnyone": "Certificate template can be modified by everyone",
      "P-DelegationGPOData": "Any user can modify GPO items",
      "T-SIDFiltering":"Trusts without SID filtering",
      "S-SIDHistory":"Domain(s) used in SID history",
      "A-DsHeuristicsAnonymous": "Access without any account via a forest wide setting",
      "A-MD5IntermediateCert": "Intermediate Certificates using unsafe hashing algorithm (MD5)",
      "S-OldNtlm":"The LAN Manager Authentication Level allows the use of NTLMv1 or LM",
      "A-AdminSDHolder": "Check for suspicious account(s) used in administrator activities",
      "A-HardenedPaths":"Hardened UNC Paths weakness",
      "A-DCLdapsProtocolAdvanced":"Domain Controller(s) using TLS1.0 or TLS1.1",
      "S-PrimaryGroup":"Users and computers with non-default Primary Group IDs",
      "P-SchemaAdmin":"The Schema Admin group is not empty",
      "A-LAPS-Not-Installed":"Local Administration Password Solution (LAPS) not implemented",
      "A-AuditDC":"Audit Policy on the Domain Controller does not Collect Key Events",
      "S-C-Inactive":"Inactive Computers Check",
      "S-OS-W10":"Presence of non-supported version of Windows 10 or Windows 11",
      "A-CertEnrollHttp":"Certificate Enrollment Interface Accessible via HTTP",
      "P-LogonDenied":"No GPO Preventing the Logon of Administrators",
      "A-WeakRSARootCert2":"Trusted Certificate with Weak RSA Key",
      "A-DnsZoneUpdate2":"DNS Zone Configured with Unsecure Updates",
      "A-SHA1IntermediateCert":"Intermediate Certificate Using Unsafe Hashing Algorithm (SHA1)",
      "A-MD5RootCert":"Root Certificate Using MD5 Signature",
      "A-NoNetSessionHardening":"No GPO Found which Implements NetCease",
      "A-AuditPowershell":"Powershell Audit Configuration Not Fully Enabled",
      "A-SHA1RootCert":"ROOT Certificate Using SHA1 Signature",
      "A-PreWin2000AuthenticatedUsers":"Pre-Windows 2000 Compatible Group Contains Authenticated Users",
      "A-DCLdapsChannelBinding":"Channel binding is not enabled for all DC for LDAPS"
    }
  }

  /**
   * Extract vulnerabilities from PingCastle XML files
   */
  async _extractVulns(files) {
    const vulns = []
    this.unmatchedRiskIds = new Set() // Track unmatched risks

    for (const file of files) {
      try {
        const content = await this.readFileAsText(file)
        const xmlDoc = this.parseXml(content)
        
        // Parse domain name
        this.domainName = this._getElementText(xmlDoc, 'DomainFQDN')
        
        // Parse risks
        this._parseRisks(xmlDoc)
        
        // Convert risks to vulnerabilities
        for (const [riskId, riskData] of Object.entries(this.risks)) {
          if (this.pingcastleMap[riskId]) {
            const vuln = {
              riskId,
              title: this.pingcastleMap[riskId],
              model: riskData.Model,
              rationale: riskData.Rationale,
              details: riskData.Details,
              domainName: this.domainName,
              fileName: file.name
            }
            vulns.push(vuln)
          } else {
            this.unmatchedRiskIds.add(riskId)
          }
        }

      } catch (error) {
        console.error(`Error parsing PingCastle file ${file.name}:`, error)
        throw new Error(`Failed to parse PingCastle file ${file.name}: ${error.message}`)
      }
    }
    
    return vulns
  }

  /**
   * Parse risks from PingCastle XML
   */
  _parseRisks(xmlDoc) {
    const riskRules = xmlDoc.getElementsByTagName('RiskRules')[0]
    if (!riskRules) return
    
    for (const rule of riskRules.children) {
      const riskId = this._getElementText(rule, 'RiskId')
      if (!riskId) continue
      
      const model = this._getElementText(rule, 'Model')
      const rationale = this._getElementText(rule, 'Rationale')
      const details = rule.getElementsByTagName('Details')[0]
      
      let pocDetails = []
      if (details && details.children.length > 0) {
        for (const detail of details.children) {
          if (detail.textContent) {
            pocDetails.push(detail.textContent)
          }
        }
      } else {
        // Get specific details for certain risk types
        pocDetails = this._getSpecificDetails(riskId, xmlDoc)
      }
      
      this.risks[riskId] = {
        Model: model,
        Rationale: rationale,
        Details: [rationale, pocDetails]
      }
    }
  }

  /**
   * Get specific details for certain risk types
   */
  _getSpecificDetails(riskId, xmlDoc) {
    switch (riskId) {
      case 'P-Delegated':
        return this._getDelegatedAccounts(xmlDoc)
      case 'A-Krbtgt':
        return [this._getElementText(xmlDoc, 'KrbtgtLastChangeDate')]
      case 'T-AzureADSSO':
        return [this._getElementText(xmlDoc, 'AzureADSSOLastPwdChange')]
      case 'P-ServiceDomainAdmin':
        return this._getServiceDomainAdmins(xmlDoc)
      case 'S-PwdNeverExpires':
        return this._getPwdNeverExpires(xmlDoc)
      case 'S-PwdNotRequired':
        return this._getPwdNotRequired(xmlDoc)
      case 'P-SchemaAdmin':
        return this._getSchemaAdmins(xmlDoc)
      case 'S-PrimaryGroup':
        return this._getBadPrimaryGroups(xmlDoc)
      case 'A-AdminSDHolder':
        return this._getAdminSDHolderNotOK(xmlDoc)
      case 'A-BackupMetadata':
        return [this._getElementText(xmlDoc, 'LastADBackup')]
      case 'S-DC-2003':
        return this._getDC2003(xmlDoc)
      case 'A-DCLdapsChannelBinding':
        return this._getDCLdapsChannelBinding(xmlDoc)
      case 'S-DesEnabled':
        return this._getDesEnabled(xmlDoc)
      default:
        return []
    }
  }

  /**
   * Get delegated accounts
   */
  _getDelegatedAccounts(xmlDoc) {
    const accounts = []
    const privilegedMembers = xmlDoc.getElementsByTagName('AllPrivilegedMembers')[0]
    if (!privilegedMembers) return accounts
    
    const members = privilegedMembers.getElementsByTagName('HealthCheckGroupMemberData')
    for (const member of members) {
      const canBeDelegated = this._getElementText(member, 'CanBeDelegated')
      if (canBeDelegated === 'true') {
        const name = this._getElementText(member, 'Name')
        if (name) accounts.push(name)
      }
    }
    return [...new Set(accounts)].sort()
  }

  /**
   * Get service domain admins
   */
  _getServiceDomainAdmins(xmlDoc) {
    const accounts = []
    const privilegedMembers = xmlDoc.getElementsByTagName('AllPrivilegedMembers')[0]
    if (!privilegedMembers) return accounts
    
    const members = privilegedMembers.getElementsByTagName('HealthCheckGroupMemberData')
    for (const member of members) {
      const isService = this._getElementText(member, 'IsService')
      const pwdNeverExpires = this._getElementText(member, 'DoesPwdNeverExpires')
      if (isService === 'true' || pwdNeverExpires === 'true') {
        const name = this._getElementText(member, 'Name')
        if (name) accounts.push(name)
      }
    }
    return [...new Set(accounts)].sort()
  }

  /**
   * Get passwords never expire
   */
  _getPwdNeverExpires(xmlDoc) {
    const accounts = []
    const userData = xmlDoc.getElementsByTagName('UserAccountData')[0]
    if (!userData) return accounts
    
    const listPwdNeverExpires = userData.getElementsByTagName('ListPwdNeverExpires')[0]
    if (!listPwdNeverExpires) return accounts
    
    const names = listPwdNeverExpires.getElementsByTagName('Name')
    for (const name of names) {
      if (name.textContent) accounts.push(name.textContent)
    }
    return [...new Set(accounts)].sort()
  }

  /**
   * Get passwords not required
   */
  _getPwdNotRequired(xmlDoc) {
    const accounts = []
    const userData = xmlDoc.getElementsByTagName('UserAccountData')[0]
    if (!userData) return accounts
    
    const listPwdNotRequired = userData.getElementsByTagName('ListPwdNotRequired')[0]
    if (!listPwdNotRequired) return accounts
    
    const names = listPwdNotRequired.getElementsByTagName('Name')
    for (const name of names) {
      if (name.textContent) accounts.push(name.textContent)
    }
    return [...new Set(accounts)].sort()
  }

  /**
   * Get schema administrators
   */
  _getSchemaAdmins(xmlDoc) {
    const accounts = []
    const groups = xmlDoc.getElementsByTagName('HealthCheckGroupData')
    for (const group of groups) {
      const groupName = this._getElementText(group, 'GroupName')
      if (groupName === 'Schema Administrators') {
        const members = group.getElementsByTagName('HealthCheckGroupMemberData')
        for (const member of members) {
          const name = this._getElementText(member, 'Name')
          if (name) accounts.push(name)
        }
      }
    }
    return accounts
  }

  /**
   * Get bad primary groups
   */
  _getBadPrimaryGroups(xmlDoc) {
    const accounts = []
    const listBadPrimaryGroup = xmlDoc.getElementsByTagName('ListBadPrimaryGroup')[0]
    if (!listBadPrimaryGroup) return accounts
    
    const groups = listBadPrimaryGroup.getElementsByTagName('HealthcheckAccountDetailData')
    for (const group of groups) {
      const name = this._getElementText(group, 'Name')
      if (name) accounts.push(name)
    }
    return accounts
  }

  /**
   * Get AdminSDHolder not OK
   */
  _getAdminSDHolderNotOK(xmlDoc) {
    const accounts = []
    const adminSDHolderNotOK = xmlDoc.getElementsByTagName('AdminSDHolderNotOK')[0]
    if (!adminSDHolderNotOK) return accounts
    
    const names = adminSDHolderNotOK.getElementsByTagName('Name')
    for (const name of names) {
      if (name.textContent) accounts.push(name.textContent)
    }
    return [...new Set(accounts)].sort()
  }

  /**
   * Get Windows 2003 DCs
   */
  _getDC2003(xmlDoc) {
    const dcs = []
    const domainControllers = xmlDoc.getElementsByTagName('DomainControllers')[0]
    if (!domainControllers) return dcs
    
    const dcData = domainControllers.getElementsByTagName('HealthcheckDomainController')
    for (const dc of dcData) {
      const os = this._getElementText(dc, 'OperatingSystem')
      if (os === 'Windows 2003') {
        const dcName = this._getElementText(dc, 'DCName')
        if (dcName) dcs.push(dcName)
      }
    }
    return dcs
  }

  /**
   * Get DC LDAPS channel binding disabled
   */
  _getDCLdapsChannelBinding(xmlDoc) {
    const dcs = []
    const domainControllers = xmlDoc.getElementsByTagName('DomainControllers')[0]
    if (!domainControllers) return dcs
    
    const dcData = domainControllers.getElementsByTagName('HealthcheckDomainController')
    for (const dc of dcData) {
      const channelBindingDisabled = this._getElementText(dc, 'ChannelBindingDisabled')
      if (channelBindingDisabled === 'true') {
        const dcName = this._getElementText(dc, 'DCName')
        if (dcName) dcs.push(dcName)
      }
    }
    return dcs
  }

  /**
   * Get DES enabled accounts
   */
  _getDesEnabled(xmlDoc) {
    const accounts = []
    const accountDataList = ['UserAccountData', 'ComputerAccountData']
    
    for (const accountData of accountDataList) {
      const data = xmlDoc.getElementsByTagName(accountData)[0]
      if (!data) continue
      
      const desEnabledCount = this._getElementText(data, 'NumberDesEnabled')
      if (desEnabledCount === '1') {
        const listDesEnabled = data.getElementsByTagName('ListDesEnabled')[0]
        if (listDesEnabled) {
          const names = listDesEnabled.getElementsByTagName('Name')
          for (const name of names) {
            if (name.textContent) accounts.push(name.textContent)
          }
        }
      }
    }
    return [...new Set(accounts)].sort()
  }

  /**
   * Get element text content
   */
  _getElementText(parent, tagName) {
    const element = parent.getElementsByTagName(tagName)[0]
    return element ? element.textContent : null
  }

  /**
   * Create findings from extracted vulnerabilities
   */
  async _createFindings() {
    this.findings = []
    
    if (this._merge) {
      // Group vulnerabilities by title for merging
      const vulnGroups = {}
      
      for (const vuln of this.vulns) {
        if (!vulnGroups[vuln.title]) {
          vulnGroups[vuln.title] = []
        }
        vulnGroups[vuln.title].push(vuln)
      }
      
      // Create merged findings
      for (const [title, vulnGroup] of Object.entries(vulnGroups)) {
        const mergedFinding = this._mergeVulnerabilities(vulnGroup)
        this.findings.push(mergedFinding)
      }
    } else {
      // No merging, create individual findings
      for (const vuln of this.vulns) {
        const finding = {
          title: vuln.title,
          vulnType: 'Vulnerability',
          description: vuln.rationale || '',
          observation: this._formatObservation(vuln),
          category: 'Active Directory',
          poc: this._formatPOC(vuln),
          scope: vuln.domainName || 'Unknown Domain',
          originalFinding: vuln
        }
        
        this.findings.push(finding)
      }
    }
  }

  /**
   * Merge multiple vulnerabilities with the same title
   */
  _mergeVulnerabilities(vulnGroup) {
    if (vulnGroup.length === 1) {
      // Single vulnerability, no merging needed
      const vuln = vulnGroup[0]
      return {
        title: vuln.title,
        vulnType: 'Vulnerability',
        description: vuln.rationale || '',
        observation: this._formatObservation(vuln),
        category: 'Active Directory',
        poc: this._formatPOC(vuln),
        scope: vuln.domainName || 'Unknown Domain',
        originalFinding: vuln
      }
    }
    
    // Multiple vulnerabilities, merge them
    const firstVuln = vulnGroup[0]
          const mergedFinding = {
        title: firstVuln.title,
        vulnType: 'Vulnerability',
        description: firstVuln.rationale || '',
        observation: this._formatObservation(firstVuln),
        category: 'Active Directory',
        poc: '',
        scope: '',
        originalFinding: vulnGroup
      }
    
    // Merge scopes
    const scopes = vulnGroup.map(v => v.domainName || 'Unknown Domain')
    mergedFinding.scope = [...new Set(scopes)].join(', ')
    
    // Merge POCs by concatenating them
    const pocs = []
    for (const vuln of vulnGroup) {
      const poc = this._formatPOC(vuln)
      if (poc) {
        pocs.push(poc)
        // add a new line between each poc
        pocs.push('<br/>')
      }
    }
    mergedFinding.poc = pocs.join('\n\n')
    
    return mergedFinding
  }

  /**
   * Format observation text
   */
  _formatObservation(vuln) {
    let observation = vuln.rationale || ''
    
    if (vuln.details && vuln.details.length > 1 && vuln.details[1].length > 0) {
      observation += '\n\nAffected accounts/systems:\n'
      observation += vuln.details[1].join('\n')
    }
    
    return observation
  }

  /**
   * Format POC text
   */
  _formatPOC(vuln) {
    let poc = `<p><b>${vuln.domainName || 'Unknown Domain'}</b></p>`
    poc += `<p>${vuln.rationale || ''}</p>`
    
    if (vuln.details && vuln.details.length > 1 && vuln.details[1].length > 0) {
      poc += '<pre><code>\n'
      poc += vuln.details[1].join('\n')
      poc += '\n</code></pre>'
    }
    
    return poc
  }

  /**
   * Import selected findings to audit
   */
  async importSelectedFindings(findings) {
    if (!this.auditId) {
      throw new Error('No audit ID provided')
    }

    try {
      // Get all vulnerabilities from database
      const VulnerabilityService = (await import('../vulnerability')).default
      const response = await VulnerabilityService.getVulnerabilities()
      const allPwndocDBVulns = response.data.datas || []
      
      const vulnsToAdd = []

      for (const finding of findings) {
        const vulnFromDB = this._getVulnFromPwndocDBByTitle(finding.title, allPwndocDBVulns)
        if (vulnFromDB) {
          const toAdd = this._newFindingFromPwndocDB(vulnFromDB)
          
          // Use database values for CVSS and priority
          // Use parsed finding values for POC, scope, and vulnType
          toAdd.poc = finding.poc
          toAdd.scope = finding.scope
          toAdd.vulnType = finding.vulnType
          
          vulnsToAdd.push(toAdd)
        }
      }

      // Add findings to audit
      const AuditService = (await import('../audit')).default
      for (const toAdd of vulnsToAdd) {
        await AuditService.createFinding(this.auditId, toAdd)
      }

      return {
        success: true,
        count: vulnsToAdd.length
      }
    } catch (error) {
      console.error('Error importing PingCastle findings:', error)
      throw error
    }
  }
}

export default PingCastleParser 