import { ref, computed } from 'vue'
import { CustomVulnerabilityRegistry } from '../../../services/custom-vulnerability-registry.js'
import { 
  PARSER_REGISTRY, 
  getClassificationPatterns, 
  getAllParserTypes,
  getParsersByExtension 
} from '../config/parserRegistry.js'

export function useUniversalFileClassification() {
  const classificationResults = ref({})
  const classifying = ref(false)
  
  // Initialize the registry with sophisticated heuristics
  const customRegistry = new CustomVulnerabilityRegistry()

  // Get classification patterns from centralized registry
  const classificationPatterns = getClassificationPatterns()
  const allParserTypes = getAllParserTypes()

  console.log('🏗️ Enhanced classification system initialized with registry:', {
    availableParsers: allParserTypes,
    patterns: Object.keys(classificationPatterns)
  })

  /**
   * Enhanced file extension matching using registry
   */
  const getExtension = (filename) => {
    const match = filename.match(/\.([^.]+)$/)
    return match ? `.${match[1].toLowerCase()}` : ''
  }

  /**
   * Calculate file score using centralized registry patterns
   */
  const calculateFileScore = async (file, parserType) => {
    const config = PARSER_REGISTRY[parserType]
    if (!config) return { score: 0, reasons: [] }

    const classification = config.classification
    const reasons = []
    let score = 0

    // Extension matching
    const extension = getExtension(file.name)
    if (classification.mandatory?.includes('extension')) {
      if (!config.extensions.includes(extension) && !config.extensions.includes('*')) {
        return { score: 0, reasons: ['Required extension not matched'] }
      }
    }
    
    if (config.extensions.includes(extension) || config.extensions.includes('*')) {
      score += 60 // High score for extension match
      reasons.push(`Extension ${extension} matches`)
    }

    // Content matching
    if (classification.content?.length > 0) {
      try {
        const fileContent = await readFileContent(file)
        const contentMatches = classification.content.filter(pattern => 
          fileContent.toLowerCase().includes(pattern.toLowerCase())
        )
        
        if (contentMatches.length > 0) {
          score += contentMatches.length * 20 // 20 points per content match
          reasons.push(`Content matches: ${contentMatches.join(', ')}`)
        }
      } catch (error) {
        console.warn(`Could not read content for ${file.name}:`, error)
      }
    }

    // Filename pattern matching
    const filename = file.name.toLowerCase()
    const filenamePatterns = [
      config.name.toLowerCase(),
      ...config.name.toLowerCase().split(' ')
    ]
    
    const filenameMatches = filenamePatterns.filter(pattern => 
      filename.includes(pattern)
    )
    
    if (filenameMatches.length > 0) {
      score += filenameMatches.length * 15 // 15 points per filename match
      reasons.push(`Filename contains: ${filenameMatches.join(', ')}`)
    }

    // Apply confidence weighting
    const finalScore = Math.min(score * classification.confidence, 100)
    
    return {
      score: finalScore,
      reasons,
      confidence: finalScore / 100
    }
  }

  /**
   * Read file content for analysis
   */
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  /**
   * Main classification function
   */
  const classifyFiles = async (files) => {
    classifying.value = true
    
    try {
      // Initialize results with all parser types from registry
      const results = {}
      allParserTypes.forEach(type => {
        results[type] = []
      })
      results.unrecognized = []

      console.log('🔍 Classifying', files.length, 'files using enhanced registry system')

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
      
      console.log('✅ Enhanced file classification results:', results)
      return results

    } catch (error) {
      console.error('❌ Error in enhanced classification:', error)
      throw error
    } finally {
      classifying.value = false
    }
  }

  /**
   * Classify a single file using enhanced registry system
   */
  const classifyFile = async (file) => {
    const results = []
    
    console.log(`🔍 Analyzing file: ${file.name}`)
    
    // Test against each parser type from registry
    for (const parserType of allParserTypes) {
      const scoreResult = await calculateFileScore(file, parserType)
      if (scoreResult.score > 0) {
        results.push({
          type: parserType,
          score: scoreResult.score,
          confidence: scoreResult.confidence,
          reasons: scoreResult.reasons
        })
      }
    }

    // Sort by score (highest first) then by registry confidence
    results.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score
      }
      // Use registry confidence as tiebreaker
      const aConfig = PARSER_REGISTRY[a.type]
      const bConfig = PARSER_REGISTRY[b.type]
      return bConfig.classification.confidence - aConfig.classification.confidence
    })

    // Return best match using confidence threshold
    if (results.length > 0) {
      const bestResult = results[0]
      const minConfidence = 0.3 // 30% minimum confidence
      
      if (bestResult.confidence >= minConfidence) {
        console.log(`✅ Classified ${file.name} as ${bestResult.type} (${(bestResult.confidence * 100).toFixed(1)}%)`)
        return bestResult
      }
    }

    // No match found
    console.log(`❓ Could not classify ${file.name} - sending to custom parser`)
    return {
      type: 'custom', // Send unrecognized files to custom parser instead of unrecognized
      confidence: 0.1,
      reasons: ['No matching patterns found - routing to custom parser for manual processing']
    }
  }

  /**
   * Pattern matching helper
   */
  const matchPattern = (text, pattern) => {
    // Convert wildcard pattern to regex
    const regexPattern = pattern.replace(/\*/g, '.*')
    const regex = new RegExp(`^${regexPattern}$`, 'i')
    return regex.test(text)
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
    return Object.keys(PARSER_REGISTRY).map(key => ({
      value: key,
      label: PARSER_REGISTRY[key].name
    }))
  }

  /**
   * Debug classification for a single file (detailed analysis)
   */
  const debugFileClassification = async (file) => {
    console.log(`🔍 Debug classification for: ${file.name}`)
    
    const allScores = []
    for (const [parserType, config] of Object.entries(PARSER_REGISTRY)) {
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
    // Enhanced registry functions
    allParserTypes,
    classificationPatterns
  }
}
