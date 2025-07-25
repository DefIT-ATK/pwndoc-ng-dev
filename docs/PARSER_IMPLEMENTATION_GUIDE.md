# Parser Implementation Guide for PwnDoc-ng

This guide provides a comprehensive reference for implementing new vulnerability parsers in the PwnDoc-ng system. Follow these patterns and requirements to ensure consistency and proper integration.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Components](#architecture-components)
3. [File Structure](#file-structure)
4. [Implementation Steps](#implementation-steps)
5. [Parser Class Requirements](#parser-class-requirements)
6. [Composable Implementation](#composable-implementation)
7. [UI Components](#ui-components)
8. [Integration Requirements](#integration-requirements)
9. [Testing and Validation](#testing-and-validation)
10. [Reference Examples](#reference-examples)

## Overview

The PwnDoc-ng parser system follows a modular architecture with the following key principles:

- **BaseParser**: All parsers extend the base parser class
- **Composables**: Vue 3 composables handle parser logic and state management
- **UI Components**: Reusable components for file upload, preview, and integration
- **Database Integration**: Automatic vulnerability database lookup and merging
- **CVSS Support**: Proper CVSS vector parsing and severity calculation (missing/invalid scores default to "None", not "Low")
- **Multi-file Support**: Individual file parsing with cross-file merging capabilities
- **Duplicate Prevention**: Automatic prevention of importing the same file multiple times
- **File Persistence**: Files remain after import to enable re-importing to different audits

## Architecture Components

### Core Components
- **BaseParser** (`/frontend/src/services/base-parser.js`): Base class for all parsers
- **Parser-specific Classes** (`/frontend/src/services/parsers/`): Tool-specific parsing logic
- **Composables** (`/frontend/src/pages/tool-integration/composables/`): Vue 3 reactive state management
- **UI Components** (`/frontend/src/pages/tool-integration/components/`): User interface elements
- **Integration** (`/frontend/src/pages/tool-integration/tool-integration.vue`): Main integration page

## File Structure

For each new parser (using "ExampleTool" as placeholder):

```
frontend/src/
├── services/parsers/
│   └── example-tool-parser.js          # Parser class implementation
├── pages/tool-integration/
│   ├── composables/
│   │   └── useExampleToolParser.js     # Composable for state management
│   └── components/
│       └── example-tool-tab.vue        # Tool-specific tab component
├── i18n/en-US/
│   └── index.js                        # Translations (update existing)
└── pages/tool-integration/
    └── tool-integration.vue            # Main page (update to include new tab)
```

## Implementation Steps

### Step 1: Create Parser Class

Create `/frontend/src/services/parsers/example-tool-parser.js`:

```javascript
import BaseParser from '../base-parser'

export class ExampleToolParser extends BaseParser {
  constructor(auditId, filenames, merge = true, dryRun = false) {
    super(auditId, filenames, merge, dryRun)
    this.name = 'ExampleTool'
    this.supportedExtensions = ['.xml', '.json'] // Define supported file extensions
  }

  // Required: Extract vulnerabilities from files
  async _extractVulns(filenames) {
    // Implementation specific to tool format
  }

  // Required: Create findings from extracted vulnerabilities
  async _createFindings() {
    // Transform vulnerabilities to PwnDoc format
  }

  // Optional: Tool-specific merge logic
  _mergeExampleToolVulnGroup(findings) {
    // Custom merging logic if needed
  }
}

export default ExampleToolParser
```

### Critical Constructor Pattern

**IMPORTANT**: All parsers MUST follow the exact constructor signature:

```javascript
constructor(auditId, filenames, merge = true, dryRun = false) {
  super(auditId, filenames, merge, dryRun)
  // ... rest of constructor
}
```

This ensures compatibility with the base parser's import flow and prevents runtime errors during import operations.

### Step 2: Create Composable

Create `/frontend/src/pages/tool-integration/composables/useExampleToolParser.js`:

```javascript
import { ref, computed } from 'vue'
import { Notify } from 'quasar'
import { $t } from '@/boot/i18n'
import ExampleToolParser from '@/services/parsers/example-tool-parser'
import { useFileHandling } from './useFileHandling'
import { useVulnerabilityImport } from './useVulnerabilityImport'

export function useExampleToolParser() {
  // State management
  const parsedVulnerabilities = ref([])
  const selectedVulnerabilities = ref([])
  const debugInfo = ref([])
  const parsing = ref(false)
  const totalVulnerabilities = ref(0)
  const totalOriginalFindings = ref(0)
  const fileFindingsMap = ref({})
  
  // File handling with supported formats
  const {
    files: exampleToolFiles,
    addFiles,
    removeFile,
    clearFiles
  } = useFileHandling(['.xml', '.json'], parseAllFiles)
  
  // Note: useFileHandling automatically prevents duplicate file imports by filename
  // and shows a user-friendly warning notification for any duplicates
  
  // Import functionality
  const {
    importing,
    selectedAudit,
    confirmImport,
    extractOriginalFindings,
    showImportSuccess,
    showImportError
  } = useVulnerabilityImport()
  
  // Upload area configuration
  const uploadAreaProps = computed(() => ({
    files: exampleToolFiles.value,
    acceptedFormats: ['.xml', '.json'],
    title: $t('toolIntegration.exampleTool.dragDropTitle'),
    subtitle: $t('toolIntegration.exampleTool.dragDropSubtitle'),
    supportedFormats: $t('toolIntegration.exampleTool.supportedFormats')
  }))
  
  // Main parsing function
  async function parseAllFiles() {
    // Follow Nessus/Acunetix pattern exactly
    // See reference implementations for complete logic
  }
  
  // Import function - CRITICAL PATTERN
  async function importSelected() {
    if (!selectedAudit.value) {
      Notify.create({
        type: 'negative',
        message: $t('toolIntegration.messages.selectAudit')
      })
      return
    }

    try {
      importing.value = true
      
      // CRITICAL: Pass audit ID to parser constructor
      const parser = new ExampleToolParser(selectedAudit.value, [], true, false)
      
      // Extract selected findings for import
      const selectedFindings = extractOriginalFindings(selectedVulnerabilities.value)
      
      // Import using base parser method
      const result = await parser.importSelectedFindings(selectedFindings)
      
      if (result.success) {
        // CRITICAL: Use result.findingsCount, NOT result.summary.imported
        showImportSuccess('exampletool', result.findingsCount)
        
        // Clear selections after successful import
        selectedVulnerabilities.value = []
        
        console.log('ExampleTool import completed successfully')
      } else {
        throw new Error(result.error || 'Import failed')
      }
    } catch (error) {
      console.error('ExampleTool import error:', error)
      showImportError(error.message)
    } finally {
      importing.value = false
    }
  }
  
  // File handling
  const handleFileChange = (newFiles) => {
    addFiles(newFiles)
  }
  
  const handleFileRemove = (index) => {
    const result = removeFile(index)
    
    if (fileFindingsMap.value[result.removedFile.name]) {
      delete fileFindingsMap.value[result.removedFile.name]
    }
    
    if (exampleToolFiles.value.length === 0) {
      parsedVulnerabilities.value = []
      selectedVulnerabilities.value = []
      debugInfo.value = []
      totalVulnerabilities.value = 0
      totalOriginalFindings.value = 0
    }
  }
  
  return {
    // State
    parsedVulnerabilities,
    selectedVulnerabilities,
    debugInfo,
    parsing,
    importing,
    totalVulnerabilities,
    totalOriginalFindings,
    fileFindingsMap,
    
    // File handling
    exampleToolFiles,
    addFiles,
    removeFile,
    clearFiles,
    handleFileChange,
    handleFileRemove,
    
    // Upload area
    uploadAreaProps,
    
    // Actions
    parseAllFiles,
    importSelected,
    
    // Audit selection
    selectedAudit,
    confirmImport
  }
}
```

### Step 3: Create UI Component

Create `/frontend/src/pages/tool-integration/components/example-tool-tab.vue`:

```vue
<template>
  <div class="example-tool-tab">
    <div class="text-h6">{{ $t('toolIntegration.exampleTool.title') }}</div>
    <div class="text-body2 q-mb-md">{{ $t('toolIntegration.exampleTool.description') }}</div>
    
    <q-card flat bordered>
      <q-card-section>
        <!-- File upload and debug panel -->
        <div style="display: flex; flex-direction: row; width: 100%;" class="q-mb-md">
          <FileUploadArea
            v-bind="uploadAreaProps"
            @files-changed="handleFileChange"
            @file-removed="handleFileRemove"
          />
          
          <DebugInfoPanel
            :debug-info="debugInfo"
            type="example-tool"
          />
        </div>

        <!-- Audit Selection -->
        <AuditSelection
          v-if="parsedVulnerabilities.length > 0"
          :audits="audits"
          :selected-audit="selectedAudit"
          :loading="loadingAudits"
          @update:selected-audit="selectedAudit = $event"
        />
        
        <!-- Preview Section -->
        <VulnerabilityPreview
          v-if="parsedVulnerabilities.length > 0"
          :vulnerabilities="parsedVulnerabilities"
          :selected="selectedVulnerabilities"
          :audits="audits"
          :selected-audit="selectedAudit"
          :importing="importing"
          :total-vulnerabilities="totalOriginalFindings"
          :import-button-label="$t('toolIntegration.exampleTool.import')"
          @update:selected="selectedVulnerabilities = $event"
          @import="importSelected"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script>
import { useExampleToolParser } from '../composables/useExampleToolParser'
import FileUploadArea from './file-upload-area.vue'
import DebugInfoPanel from './debug-info-panel.vue'
import AuditSelection from './audit-selection.vue'
import VulnerabilityPreview from './vulnerability-preview.vue'

export default {
  name: 'ExampleToolTab',
  components: {
    FileUploadArea,
    DebugInfoPanel,
    AuditSelection,
    VulnerabilityPreview
  },
  props: {
    audits: {
      type: Array,
      required: true
    },
    loadingAudits: {
      type: Boolean,
      default: false
    }
  },
  setup() {
    const {
      // State
      parsedVulnerabilities,
      selectedVulnerabilities,
      debugInfo,
      parsing,
      importing,
      totalVulnerabilities,
      totalOriginalFindings,
      
      // File handling
      addFiles,
      removeFile,
      handleFileChange,
      handleFileRemove,
      
      // Upload area
      uploadAreaProps,
      
      // Actions
      importSelected,
      
      // Audit selection
      selectedAudit
    } = useExampleToolParser()

    return {
      // State
      parsedVulnerabilities,
      selectedVulnerabilities,
      debugInfo,
      parsing,
      importing,
      totalVulnerabilities,
      totalOriginalFindings,
      
      // File handling
      addFiles,
      removeFile,
      handleFileChange,
      handleFileRemove,
      
      // Upload area
      uploadAreaProps,
      
      // Actions
      importSelected,
      
      // Audit selection
      selectedAudit
    }
  }
}
</script>
```

### Step 4: Add Translations

Update `/frontend/src/i18n/en-US/index.js`:

```javascript
toolIntegration: {
  title: 'Tool Integration',
  subtitle: 'Import vulnerabilities from various security tools',
  duplicateFile: 'File(s) already selected: {files}', // Required for duplicate prevention
  parsingSubtitle: 'Please wait while we process your scan results', // Required for parsing progress
  // ... other shared keys
},
exampleTool: {
  title: 'Example Tool',
  description: 'Import vulnerabilities from Example Tool export files',
  dragDropTitle: 'Select Example Tool files',
  dragDropSubtitle: 'Upload .xml or .json files',
  supportedFormats: 'Supported formats: .xml, .json',
  import: 'Import Example Tool Vulnerabilities',
  noFileSelected: 'Please select a file to parse',
  parseSuccess: '{unique} unique vulnerabilities parsed successfully (from {total} total)',
  parseError: 'Error parsing Example Tool file',
  parsingFiles: 'Parsing Example Tool files...', // Required for parsing progress
  noVulnerabilities: 'No vulnerabilities selected for import'
}
```

### Step 5: Integrate into Main Page

Update `/frontend/src/pages/tool-integration/tool-integration.vue`:

```vue
<!-- Add to tab panels -->
<q-tab-panel name="example-tool">
  <ExampleToolTab
    :audits="audits"
    :loading-audits="loadingAudits"
  />
</q-tab-panel>

<!-- Add to tabs -->
<q-tab name="example-tool" :label="$t('toolIntegration.exampleTool.title')" />

<!-- Add to imports -->
import ExampleToolTab from './components/example-tool-tab.vue'

<!-- Add to components -->
components: {
  ExampleToolTab,
  // ... other components
}
```

## Parser Class Requirements

### Essential Methods

1. **`_extractVulns(filenames)`**: Extract raw vulnerability data from files
2. **`_createFindings()`**: Transform vulnerabilities to PwnDoc format
3. **`_mergeToolVulnGroup(findings)`** (optional): Custom merging logic

### Required Finding Format

```javascript
const finding = {
  title: 'Vulnerability Title',
  description: 'HTML description',
  remediation: 'Remediation steps',
  vulnType: 'Tool-specific type',
  scope: 'Affected targets',
  poc: 'Proof of concept',
  references: ['ref1', 'ref2'],
  cvssv3: 'CVSS:3.1/AV:N/AC:L/...',
  cvssScore: 7.5,
  priority: 1,
  remediationComplexity: 2,
  category: 'Tool Name',
  severity: 'High'
}
```

### Tool-Specific Categories and Types

| Tool | Category | VulnType | Description |
|------|----------|----------|-------------|
| Nessus | "Nessus" | "Infrastructure" | Network/system vulnerabilities |
| PingCastle | "Active Directory" | "Vulnerability" | AD security issues |
| Acunetix | "Acunetix" | "Web Application" | Web app vulnerabilities |

## Composable Implementation

### Required State Variables

```javascript
const parsedVulnerabilities = ref([])      // Merged, database-enhanced findings
const selectedVulnerabilities = ref([])    // User selections for import
const debugInfo = ref([])                  // Debug information for UI
const parsing = ref(false)                 // Parsing state
const totalVulnerabilities = ref(0)        // Count after merging
const totalOriginalFindings = ref(0)       // Count before merging
const fileFindingsMap = ref({})            // Findings by filename
```

### Required Functions

1. **`parseAllFiles()`**: Main parsing orchestrator
2. **Database Integration**: Single DB call, lookup, CVSS enhancement
3. **Merging Logic**: Cross-file and intra-file merging
4. **CVSS Handling**: Use CVSS31 library for score calculation
5. **Debug Info**: Generate meaningful debugging information
6. **Auto-Selection**: Automatically select all parsed vulnerabilities for user convenience

### Parsing Workflow Pattern

All parsers should follow this standard workflow in `parseAllFiles()`:

```javascript
// 1. Clear existing data
parsedVulnerabilities.value = []
selectedVulnerabilities.value = []

// 2. Parse files and merge findings
const mergedFindings = await parser.parseAndMerge(files)

// 3. Get database values for preview
const previewFindings = await _getDatabaseValuesForPreview(mergedFindings, allDBVulns)
parsedVulnerabilities.value = previewFindings

// 4. Sort by CVSS score (highest first)
parsedVulnerabilities.value.sort((a, b) => {
  const aScore = a.cvssScore || 0
  const bScore = b.cvssScore || 0
  return bScore - aScore
})

// 5. Auto-select all parsed vulnerabilities
selectedVulnerabilities.value = [...parsedVulnerabilities.value]

// 6. Update totals
totalVulnerabilities.value = parsedVulnerabilities.value.length
```

This ensures consistent user experience across all parsers - vulnerabilities are automatically selected, sorted by severity, and ready for import.

### CVSS Integration Pattern

```javascript
// CVSS conversion (use CVSS31 global library)
function _convertCvssVectorToScore(cvssVector) {
  if (!cvssVector || typeof cvssVector !== 'string') {
    return null
  }
  
  try {
    const num = parseFloat(cvssVector)
    if (!isNaN(num)) {
      return num
    }
    
    if (cvssVector.startsWith('CVSS:3.0/') || cvssVector.startsWith('CVSS:3.1/')) {
      const result = CVSS31.calculateCVSSFromVector(cvssVector)
      
      if (result.success) {
        return parseFloat(result.baseMetricScore)
      } else {
        console.error('CVSS calculation failed:', result)
        return null
      }
    }
    
    return null
  } catch (error) {
    console.error('Error converting CVSS vector:', error)
    return null
  }
}

function _cvssScoreToSeverity(cvssScore) {
  if (cvssScore === null || cvssScore === undefined || isNaN(cvssScore)) {
    return 'None'
  }
  
  // Handle the case where CVSS score is 0 (should be "None")
  if (cvssScore === 0) {
    return 'None'
  }
  
  const severity = CVSS31.severityRating(cvssScore) || 'None'
  return severity
}
```

#### CVSS Severity Standards

**CRITICAL REQUIREMENT**: All parsers must handle missing/invalid CVSS scores consistently by defaulting to "None" severity, NOT "Low".

This follows the CVSS 3.1 specification where:
- Score 0.0 = "None" severity
- Missing/null/undefined scores = "None" severity 
- Invalid/NaN scores = "None" severity

**Rationale**: 
- Defaulting to "Low" severity creates false positives and inflates vulnerability counts
- Vulnerabilities without CVSS scores should not be assumed to have any severity level
- "None" accurately represents the absence of severity information
- Consistent with CVSS 3.1 official specification

**Implementation**: Use the standardized `_cvssScoreToSeverity()` function shown above in ALL parsers.

### Database Lookup Pattern

```javascript
async function _getDatabaseValuesForPreview(findings, allDBVulns) {
  const previewFindings = []
  
  for (const finding of findings) {
    const vulnFromDB = _getVulnFromPwndocDBByTitle(finding.title, allDBVulns)
    
    if (vulnFromDB) {
      // Use database values with CVSS fallback
      let cvssScore = _convertCvssVectorToScore(vulnFromDB.cvssv3)
      if (cvssScore === null && vulnFromDB.cvssScore !== undefined && vulnFromDB.cvssScore !== null) {
        cvssScore = parseFloat(vulnFromDB.cvssScore)
      }
      
      const severity = _cvssScoreToSeverity(cvssScore)
      
      const previewFinding = {
        ...finding,
        cvssv3: cvssScore,
        cvssScore: cvssScore,
        severity: severity,
        category: vulnFromDB.category,
        originalFinding: finding.allOriginalFindings || [finding]
      }
      previewFindings.push(previewFinding)
    } else {
      // Clear values for new vulnerabilities
      const clearedFinding = {
        ...finding,
        cvssv3: null,
        cvssScore: null,
        severity: null,
        category: null,
        originalFinding: finding.allOriginalFindings || [finding]
      }
      previewFindings.push(clearedFinding)
    }
  }
  
  return previewFindings
}
```

## UI Components

### Required Components

1. **FileUploadArea**: File upload with drag-and-drop
2. **DebugInfoPanel**: Debug information display
3. **AuditSelection**: Audit selection dropdown
4. **VulnerabilityPreview**: Preview table with selection
5. **ParsingProgress**: Standardized parsing progress indicator (required pattern)

### Component Props

- **totalOriginalFindings**: Pass to VulnerabilityPreview for correct count display
- **acceptedFormats**: Array of supported file extensions
- **uploadAreaProps**: Computed property for upload area configuration

### Required UI Patterns

#### Parsing Progress Section
All parser tabs must include a standardized parsing progress indicator. You can either use the reusable `ParsingProgress` component or implement the pattern directly:

**Option A: Using ParsingProgress Component (Recommended)**
```vue
<ParsingProgress
  :visible="parsing"
  :tool="'toolName'"
/>
```

**Option B: Direct Implementation**
```vue
<!-- Parsing Progress -->
<div v-if="parsing" class="q-mt-md">
  <q-card>
    <q-card-section class="text-center">
      <q-spinner-hourglass size="40px" color="primary" />
      <div class="text-h6 q-mt-md">{{ $t('toolIntegration.toolName.parsingFiles') }}</div>
      <div class="text-body2 text-grey-6">{{ $t('toolIntegration.parsingSubtitle') }}</div>
    </q-card-section>
  </q-card>
</div>
```

**Required translation keys:**
- `toolIntegration.toolName.parsingFiles`: Tool-specific parsing message
- `toolIntegration.parsingSubtitle`: Shared subtitle for all parsers

#### Import Behavior Standards
All parser import functions must follow these standards:

**✅ DO:**
- Keep uploaded files after successful import (allows re-import to different audits)
- Clear only the selected vulnerabilities list (`selectedVulnerabilities.value = []`)
- Preserve parsed results and debug information for user reference

**❌ DON'T:**
- Clear uploaded files (`clearFiles()`) after import
- Reset all parser state (keeps user workflow intact)
- Force users to re-upload files for multiple audit imports

**Example Implementation:**
```javascript
async function importSelected() {
  try {
    // ... import logic
    
    if (result.success) {
      showImportSuccess('toolName', result.findingsCount)
      
      // ✅ Clear only selections (keep files and parsed data)
      selectedVulnerabilities.value = []
      
      // ❌ DON'T do this:
      // clearFiles()
      // parsedVulnerabilities.value = []
      // debugInfo.value = []
    }
  } catch (error) {
    // ... error handling
  }
}
```

## Integration Requirements

### Main Integration Page Updates

1. Add new tab to `q-tabs`
2. Add new tab panel to `q-tab-panels`
3. Import and register new component
4. Add translations to i18n files

### Translation Structure

```javascript
toolIntegration: {
  toolName: {
    title: 'Tool Name',
    description: 'Tool description',
    dragDropTitle: 'Select files',
    dragDropSubtitle: 'Upload supported files',
    supportedFormats: 'Supported formats: .ext1, .ext2',
    import: 'Import Vulnerabilities',
    noFileSelected: 'Please select a file',
    parseSuccess: '{unique} unique vulnerabilities parsed (from {total} total)',
    parseError: 'Error parsing file',
    noVulnerabilities: 'No vulnerabilities selected'
  }
}
```

## Testing and Validation

### Required Testing

1. **File Format Support**: Test all supported file extensions
2. **Parsing Logic**: Verify vulnerability extraction accuracy
3. **Merging Logic**: Test intra-file and cross-file merging
4. **Database Integration**: Verify CVSS lookup and fallback
5. **Count Accuracy**: Verify before/after merging counts
6. **Import Functionality**: Test end-to-end import process

### Validation Checklist

- [ ] Parser extends BaseParser correctly
- [ ] Composable follows established patterns
- [ ] UI component uses all required components
- [ ] CVSS calculation uses CVSS31 library
- [ ] Database lookup includes fallback logic
- [ ] Merging preserves allOriginalFindings
- [ ] Counts are tracked correctly (before/after merging)
- [ ] Translations are complete
- [ ] Integration page updated
- [ ] Debug information is meaningful

## Reference Examples

### Complete Implementations

1. **Nessus Parser**: Full-featured with XML parsing and CVSS support
   - `/frontend/src/services/parsers/nessus-parser.js`
   - `/frontend/src/pages/tool-integration/composables/useNessusParser.js`
   - `/frontend/src/pages/tool-integration/components/nessus-tab.vue`

2. **Acunetix Parser**: JSON/XML support with sophisticated merging
   - `/frontend/src/services/parsers/acunetix-parser.js`
   - `/frontend/src/pages/tool-integration/composables/useAcunetixParser.js`
   - `/frontend/src/pages/tool-integration/components/acunetix-tab.vue`

3. **PingCastle Parser**: Active Directory focus with custom categories
   - `/frontend/src/services/parsers/pingcastle-parser.js`
   - `/frontend/src/pages/tool-integration/composables/usePingCastleParser.js`
   - `/frontend/src/pages/tool-integration/components/pingcastle-tab.vue`

### Common Patterns

- Always use single database call at start of parsing
- Implement both intra-file and cross-file merging
- Use CVSS31 library for score calculation
- Track original and merged counts separately
- Provide meaningful debug information
- Follow established naming conventions
- Use consistent error handling and user feedback

### Best Practices

1. **Performance**: Single database call, efficient merging
2. **User Experience**: Clear feedback, progress indication
3. **Error Handling**: Graceful failures with informative messages
4. **Consistency**: Follow established patterns exactly
5. **Documentation**: Clear comments and variable names
6. **Testing**: Validate with real tool output files

## Common Implementation Issues and Solutions

### Template Structure Issues
- **Problem**: Vue template compilation errors due to missing closing tags
- **Solution**: Always ensure proper template structure with matching opening/closing tags
- **Best Practice**: Compare with existing tab components (nessus-tab.vue, acunetix-tab.vue) for correct structure

### Props vs Composables
- **Problem**: Import errors when trying to use non-existent composables like `@/composables/useAudits`
- **Solution**: Follow the established pattern where tabs receive `audits` and `loadingAudits` as props from the parent component
- **Implementation**: 
  ```javascript
  props: {
    audits: {
      type: Array,
      required: true
    },
    loadingAudits: {
      type: Boolean,
      default: false
    }
  }
  ```

### Method Name Consistency
- **Problem**: Template calling methods that don't exist in the composable return object
- **Solution**: Ensure template method calls match exactly with what the composable returns
- **Example**: Use `importSelected` not `importVulnerabilities` in template if that's what the composable returns

### CVSS Severity Standardization
- **CRITICAL REQUIREMENT**: All parsers MUST return "None" for missing/invalid CVSS scores, NOT "Low"
- **Implementation**: Use standardized `_cvssScoreToSeverity()` method across all parsers
- **Pattern**: 
  ```javascript
  _cvssScoreToSeverity(score) {
    if (!score || score === 0 || isNaN(score)) return 'None'
    // ... rest of CVSS logic
  }
  ```

### Translation Key Management
- **Requirement**: Add translation keys for all UI text in all supported languages
- **Languages**: English (en-US), French (fr-FR), German (de-DE), Chinese (zh-CN)
- **Pattern**: `toolIntegration.tools.{parser}` and `toolIntegration.{parser}.*`

### Dependency Management
- **Best Practice**: Install required dependencies (e.g., `xlsx` for Excel parsing) before implementation
- **Command**: `npm install --save {dependency}` in the frontend directory
- **Verification**: Ensure dependency appears in `package.json`

### Excel/Complex File Parsing
- **Excel Files**: Use `xlsx` (SheetJS) library for Excel file parsing
- **Table Generation**: When parsing result sheets, convert to HTML tables for PoC sections
- **Sheet Navigation**: Access specific sheets by name, handle missing sheets gracefully
- **Data Extraction**: Filter and transform data before creating findings
- **Example Pattern**:
  ```javascript
  // Parse Excel workbook
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet)
  
  // Convert to HTML table for PoC
  const resultTable = this._parseResultSheetToTable(workbook, row.ShortName)
  poc += resultTable
  ```

### Base Parser Integration
- **Constructor**: Always pass audit ID to parser constructor for proper database integration
- **Import Results**: Base parser returns `{success: boolean, findingsCount: number}`, NOT `{success, summary: {imported}}`
- **originalFinding Storage**: Store the processed finding object as `originalFinding`, not raw parsed data
- **Database Lookup**: Use `_getVulnFromPwndocDBByTitle` pattern for vulnerability matching

### Common Pitfalls and Solutions

#### Constructor Mismatch
**Problem**: Parser constructor doesn't accept audit ID parameter
**Solution**: Ensure constructor signature matches: `constructor(auditId, filenames, merge, dryRun)`

#### Result Object Mismatch  
**Problem**: Composable expects `result.summary.imported` but base parser returns `result.findingsCount`
**Solution**: Use `result.findingsCount` for import success messages

#### Database 422 Errors
**Problem**: `originalFinding` contains raw data instead of processed finding
**Solution**: Store the complete processed finding object as `originalFinding`

#### Sheet Parsing Failures
**Problem**: Excel sheet references fail or produce unusable PoC content
**Solution**: Implement robust sheet parsing with fallback to sheet name references

## Conclusion

This guide provides all necessary patterns and requirements for implementing new parsers in PwnDoc-ng. Always refer to existing implementations (Nessus, Acunetix, PingCastle, PurpleKnight) for concrete examples and follow the established architecture patterns for consistency and maintainability.

**Recent Updates**: This guide has been updated with lessons learned from the PurpleKnight parser implementation, including:
- **Constructor Pattern**: Critical requirement for audit ID parameter in parser constructors
- **Import Result Handling**: Correct usage of `result.findingsCount` vs `result.summary.imported`
- **Excel Parsing**: Complete pattern for Excel file parsing with sheet-to-table conversion
- **Database Integration**: Proper `originalFinding` storage and vulnerability matching patterns
- **Common Pitfalls**: Solutions for constructor mismatches, result object handling, and 422 database errors
- **Sheet Parsing**: Robust Excel sheet parsing with HTML table generation for complex PoC sections

For questions or clarifications, consult the existing codebase or review the implementation patterns documented here.
