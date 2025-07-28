import { ref, computed } from 'vue'
import { CustomVulnerabilityRegistry } from '../../../services/custom-vulnerability-registry.js'

export function useUniversalFileClassification() {
  const classificationResults = ref({})
  const classifying = ref(false)
  
  // Initialize the registry with sophisticated heuristics
  const customRegistry = new CustomVulnerabilityRegistry()

  // Enhanced parser registry incorporating sophisticated heuristics from custom-vulnerability-registry
  const parserRegistry = {
    nessus: {
      name: 'Nessus',
      priority: 1,
      patterns: {
        extension: ['.nessus', '.xml'],
        filename: ['*nessus*'],
        content: ['NessusClientData_v2', 'nessus', 'plugin_set', 'bw_prevent_plugin_updates', 
                  'scan.enable_utf8_output', 'compliance_generate_description', '<NessusClientData', '<Policy>', '<Report>'],
        xmlRoot: ['NessusClientData'],
        mandatory: ['extension']
      },
      confidence: {
        extension: 80,    // Very high - .nessus is very specific
        content: 20,      // Lower since extension is so specific
        minScore: 50
      }
    },
    pingcastle: {
      name: 'PingCastle',
      priority: 1,
      patterns: {
        extension: ['.xml'],
        filename: ['*pingcastle*', '*ping_castle*'],
        content: ['GlobalScore', 'MaturityLevel', 'DomainFunctionalLevel', 'HealthcheckDomainController', 
                  'DomainFQDN', 'NumberOfDC', '<healthcheck>', '<DomainKey>', 'pingcastle'],
        xmlRoot: ['healthcheck'],
        mandatory: ['extension']
      },
      confidence: {
        extension: 20,    
        content: 70,      
        filename: 10,
        minScore: 40
      }
    },
    purpleknight: {
      name: 'PurpleKnight',
      priority: 1,
      patterns: {
        extension: ['.xlsx', '.xls'],
        filename: ['*purple*', '*knight*', 'Security_Assessment_Report'],
        content: ['Purple Knight', 'purpleknight', 'Forest Name', 'Indicators Found']
      },
      confidence: {
        extension: 20,    // .xlsx is common
        filename: 60,     // Filename is quite specific
        content: 20,      // Additional verification
        minScore: 40
      }
    },
    acunetix: {
      name: 'Acunetix',
      priority: 1,
      patterns: {
        extension: ['.xml', '.json'],
        filename: ['*acunetix*', '*acux*', '*_export.json'],
        content: ['acunetix', 'vt_id', 'vulnerabilities/acx', 'acx', '<ScanGroup>', '"scanning_app":"Acunetix"'],
        xmlRoot: ['ScanGroup']
      },
      confidence: {
        extension: 10,    // Low weight since many JSON files exist
        filename: 20,     // Low weight since _export.json is generic
        content: 70,      // HIGH weight - this is the key differentiator
        minScore: 40      // Require strong condition match
      }
    },
    powerupsql: {
      name: 'PowerUpSQL',
      priority: 1,
      patterns: {
        extension: ['.csv', '.txt'],
        filename: ['*powerupsql*', '*power_up_sql*', 'PowerUpSQL_Audit_Results'],
        content: ['ComputerName,Instance,ServiceAccount', 'PowerUpSQL', 'Get-SQLInstanceDomain'],
        mandatory: ['filename']
      }
    },
    custom: {
      name: 'Custom Parsers',
      priority: 2,
      patterns: {
        extension: ['.csv', '.txt', '.json', '.xml'],
        filename: ['*sam*', '*ntds*', '*domain*admin*', '*crack*', '*hash*', 'DA.txt', 'domain_admins.txt', 'domain_policy.json', 'enabled_users_only_hashcat'],
        content: ['SAM File', 'NTDS', 'Domain Admins', 'password', 'hash', 'Administrator:500:aad3b435b51404eeaad3b435b51404ee', 
                  'Dumping SAM hashes', 'SAM hashes to the database', '(Pwn3d!)', 'all_subscriptions', 'account_id', 'aad', 'storageaccounts'],
        // Enhanced regex patterns for specific file types
        regex: [
          /^[^\\]+\\[^:]+:[a-fA-F0-9]{32}:.+$/m,  // Cracked passwords: domain\username:hash:password
          /^[^\\]+\\[^:]+:[0-9]+:[a-fA-F0-9]{32}:[a-fA-F0-9]{32}:::$/m  // NTDS dump: domain\username:6563:AAD3B435B51404EEAAD3B435B51404EE:E293EA6FD1DA433BAC7A556C1B064B03:::
        ]
      },
      confidence: {
        extension: 10,    // .txt/.csv/.json are very common
        content: 80,      // High weight for specific patterns
        filename: 70,     // High weight for specific filenames
        regex: 90,        // Very high weight for regex matches
        minScore: 40
      }
    }
  }

  /**
   * Main classification function
   */
  const classifyFiles = async (files) => {
    classifying.value = true
    
    try {
      const results = {
        nessus: [],
        pingcastle: [],
        purpleknight: [],
        acunetix: [],
        powerupsql: [],
        custom: [],
        unrecognized: []
      }

      // Process each file
      for (const file of files) {
        const classification = await classifyFile(file)
        results[classification.type].push({
          file,
          confidence: classification.confidence,
          reasons: classification.reasons,
          detectedAs: classification.type
        })
      }

      // Store results
      classificationResults.value = results
      
      console.log('File classification results:', results)
      return results

    } catch (error) {
      console.error('Error classifying files:', error)
      throw error
    } finally {
      classifying.value = false
    }
  }

  /**
   * Classify a single file using sophisticated heuristics
   */
  const classifyFile = async (file) => {
    const results = []
    
    // Test against each parser type
    for (const [parserType, config] of Object.entries(parserRegistry)) {
      const scoreResult = await calculateFileScore(file, config)
      if (scoreResult.score > 0) {
        results.push({
          type: parserType,
          score: scoreResult.score,
          confidence: scoreResult.score / 100, // Normalize to 0-1
          reasons: scoreResult.reasons
        })
      }
    }

    // Sort by score (highest first) and priority
    results.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score
      }
      return parserRegistry[a.type].priority - parserRegistry[b.type].priority
    })

    // Return best match using confidence threshold from config
    if (results.length > 0) {
      const bestResult = results[0]
      const config = parserRegistry[bestResult.type]
      const minScore = config.confidence?.minScore || 30
      
      if (bestResult.score >= minScore) {
        return bestResult
      }
    }

    // No match found
    return {
      type: 'unrecognized',
      confidence: 0,
      reasons: ['No matching patterns found or confidence too low']
    }
  }

  /**
   * Calculate how well a file matches a parser type using sophisticated heuristics
   */
  const calculateFileScore = async (file, config) => {
    let score = 0
    const reasons = []
    const confidence = config.confidence || { extension: 30, filename: 25, content: 35, minScore: 30 }

    // 1. Extension matching
    const extension = '.' + file.name.split('.').pop().toLowerCase()
    if (config.patterns.extension?.some(ext => ext.toLowerCase() === extension)) {
      score += confidence.extension || 30
      reasons.push(`Extension matches: ${extension}`)
    }

    // 2. Filename pattern matching
    if (config.patterns.filename) {
      for (const pattern of config.patterns.filename) {
        if (matchPattern(file.name.toLowerCase(), pattern.toLowerCase())) {
          score += confidence.filename || 25
          reasons.push(`Filename matches pattern: ${pattern}`)
          break
        }
      }
    }

    // 3. Content analysis - read file content for analysis
    let content = ''
    if (config.patterns.content || config.patterns.regex || config.patterns.xmlRoot) {
      try {
        content = await getFilePreview(file, 4096) // Read more content for better analysis
        if (content) {
          // Content pattern matching
          if (config.patterns.content) {
            let contentMatches = 0
            for (const contentPattern of config.patterns.content) {
              if (content.toLowerCase().includes(contentPattern.toLowerCase())) {
                contentMatches++
                reasons.push(`Content contains: ${contentPattern}`)
              }
            }
            if (contentMatches > 0) {
              // Score based on percentage of content patterns matched
              const contentScore = (contentMatches / config.patterns.content.length) * (confidence.content || 35)
              score += contentScore
            }
          }

          // Regex pattern matching (high confidence)
          if (config.patterns.regex) {
            for (const regex of config.patterns.regex) {
              if (regex.test(content)) {
                score += confidence.regex || 90
                reasons.push(`Content matches regex pattern`)
                break
              }
            }
          }

          // XML root element matching (bonus points)
          if (config.patterns.xmlRoot && extension === '.xml') {
            for (const rootElement of config.patterns.xmlRoot) {
              if (content.includes(`<${rootElement}`)) {
                score += 10
                reasons.push(`XML root element: ${rootElement}`)
                break
              }
            }
          }
        }
      } catch (error) {
        console.warn('Could not read file content for classification:', error)
      }
    }

    // 4. Check mandatory requirements
    if (config.patterns.mandatory) {
      const mandatoryResults = config.patterns.mandatory.map(req => {
        switch (req) {
          case 'extension':
            return config.patterns.extension?.some(ext => ext.toLowerCase() === extension)
          case 'filename':
            return config.patterns.filename?.some(pattern => 
              matchPattern(file.name.toLowerCase(), pattern.toLowerCase())
            )
          case 'regex':
            return config.patterns.regex?.some(regex => regex.test(content))
          case 'content':
            return config.patterns.content?.some(pattern => 
              content.toLowerCase().includes(pattern.toLowerCase())
            )
          default:
            return true
        }
      })
      
      const allMandatoryPassed = mandatoryResults.every(result => result)
      if (!allMandatoryPassed) {
        return { score: 0, reasons: ['Failed mandatory requirements'] }
      }
    }

    return {
      score: Math.min(score, 100),
      reasons
    }
  }

  /**
   * Get file content preview for analysis
   */
  const getFilePreview = async (file, maxSize = 1024) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => resolve('')
      
      const slice = file.slice(0, maxSize)
      reader.readAsText(slice)
    })
  }

  /**
   * Match filename patterns (supporting wildcards)
   */
  const matchPattern = (text, pattern) => {
    const regex = new RegExp(
      pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.'),
      'i'
    )
    return regex.test(text)
  }

  /**
   * Manually reclassify a file
   */
  const reclassifyFile = async (file, newParserType) => {
    // Find the file in current results
    let found = false
    
    for (const [currentType, files] of Object.entries(classificationResults.value)) {
      const fileIndex = files.findIndex(item => item.file.name === file.name)
      if (fileIndex !== -1) {
        // Remove from current classification
        const [fileItem] = files.splice(fileIndex, 1)
        
        // Add to new classification
        if (!classificationResults.value[newParserType]) {
          classificationResults.value[newParserType] = []
        }
        
        classificationResults.value[newParserType].push({
          ...fileItem,
          detectedAs: newParserType,
          confidence: 1.0,
          reasons: ['Manually classified'],
          manuallyClassified: true
        })
        
        found = true
        break
      }
    }

    if (!found) {
      console.warn('File not found for reclassification:', file.name)
    }
  }

  /**
   * Get available parser types for manual classification
   */
  const getAvailableParserTypes = () => {
    return Object.keys(parserRegistry).map(key => ({
      value: key,
      label: parserRegistry[key].name
    }))
  }

  /**
   * Debug classification for a single file (detailed analysis)
   */
  const debugFileClassification = async (file) => {
    console.log(`🔍 Debug classification for: ${file.name}`)
    
    const allScores = []
    for (const [parserType, config] of Object.entries(parserRegistry)) {
      const scoreResult = await calculateFileScore(file, config)
      const minScore = config.confidence?.minScore || 30
      
      allScores.push({
        parserType,
        score: scoreResult.score,
        reasons: scoreResult.reasons,
        meets_threshold: scoreResult.score >= minScore,
        threshold: minScore
      })
      
      console.log(`  ${parserType}: ${scoreResult.score >= minScore ? '✅' : '❌'} Score: ${Math.round(scoreResult.score)}/${minScore}`)
      if (scoreResult.reasons.length > 0) {
        scoreResult.reasons.forEach(reason => {
          console.log(`    ✓ ${reason}`)
        })
      }
    }
    
    const matches = allScores.filter(s => s.meets_threshold)
    if (matches.length > 0) {
      const bestMatch = matches.reduce((best, current) => 
        current.score > best.score ? current : best
      )
      console.log(`🏆 Winner: ${bestMatch.parserType} (${Math.round(bestMatch.score)} points)`)
    } else {
      console.log(`❌ No matches found`)
    }
    
    return allScores
  }

  return {
    classificationResults,
    classifying,
    classifyFiles,
    reclassifyFile,
    getAvailableParserTypes,
    debugFileClassification,
    parserRegistry
  }
}
