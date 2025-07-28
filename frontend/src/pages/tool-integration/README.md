# Tool Integration Module

This module provides a unified interface for integrating various security assessment tools into PwnDoc-ng, with automatic file classification and vulnerability parsing capabilities.

## Architecture

### Core Components
- **Universal File Upload Hub**: Central upload interface with automatic file classification
- **Parser Tabs**: Individual interfaces for each supported tool
- **Standardized Components**: Reusable UI components for consistent user experience

### Key Features
- ✅ **Automatic File Classification**: Registry-driven file type detection
- ✅ **Unified File Routing**: Global file store with intelligent routing
- ✅ **Standardized Parser Interface**: Consistent API across all parsers
- ✅ **Enhanced Error Handling**: Comprehensive error reporting and debugging
- ✅ **Folder Upload Support**: Drag-and-drop entire directories

## Supported Tools

| Tool | File Types | Description |
|------|------------|-------------|
| **Nessus** | `.nessus`, `.xml` | Tenable Nessus vulnerability scanner |
| **Acunetix** | `.xml` | Web application security scanner |
| **PingCastle** | `.html`, `.xml` | Active Directory security assessment |
| **Purple Knight** | `.json`, `.xml`, `.html` | Semperis AD assessment tool |
| **PowerUpSQL** | `.csv`, `.txt` | SQL Server security assessment |
| **Custom** | `*` | Manual file processing and classification |

## Directory Structure

```
tool-integration/
├── components/              # UI Components
│   ├── universal-file-upload-hub.vue    # Central upload interface
│   ├── file-classification-panel.vue    # File classification display
│   ├── file-upload-area.vue             # Drag-drop upload component
│   ├── [parser]-tab.vue                 # Individual parser interfaces
│   ├── audit-selection.vue              # Audit selection component
│   ├── vulnerability-preview.vue        # Vulnerability preview table
│   ├── debug-info-panel.vue             # Debug information display
│   └── selected-files-grid.vue          # File grid component
├── composables/             # Business Logic
│   ├── useStandardParserTab.js          # Standardized parser interface
│   ├── useUniversalFileClassification.js # File classification logic
│   ├── useParserDispatcher.js           # File routing system
│   ├── useGlobalFileStore.js            # Global file storage
│   ├── use[Parser]Parser.js             # Individual parser logic
│   ├── useFileHandling.js               # File upload utilities
│   └── useVulnerabilityImport.js        # Import functionality
├── config/                  # Configuration
│   └── parserRegistry.js                # Central parser registry
├── tool-integration.vue     # Main component
└── index.js                 # Module export
```

## Parser Registry System

The parser registry (`config/parserRegistry.js`) provides a centralized configuration system:

```javascript
export const PARSER_REGISTRY = {
  nessus: {
    name: 'Nessus',
    extensions: ['.nessus', '.xml'],
    component: 'NessusTab',
    composable: 'useNessusParser',
    classification: {
      content: ['NessusClientData_v2', 'tenable'],
      confidence: 0.9
    }
  }
  // ... other parsers
}
```

## Standardization Framework

All parser tabs implement the `useStandardParserTab` interface:

```javascript
const { parserInstance, registerParser, unregisterParser } = useStandardParserTab({
  parserType: 'nessus',
  parserHook: useNessusParser,
  props
})
```

## File Classification

The enhanced classification system uses:
- **Extension matching**: Primary file type identification
- **Content analysis**: Deep file content inspection
- **Confidence scoring**: Probabilistic classification with fallbacks
- **Registry integration**: Centralized classification patterns

## Global File Store

Files are stored globally and persist across tab switches:
- **Automatic routing**: Files routed to appropriate parsers when tabs open
- **State persistence**: File state maintained regardless of UI navigation
- **Universal access**: Any parser can access globally stored files

## Recent Updates (Phase 2 Standardization)

- ✅ Implemented centralized parser registry
- ✅ Standardized all 6 parser tabs with `useStandardParserTab`
- ✅ Enhanced file classification with registry integration
- ✅ Improved error handling with null-safe template checks
- ✅ Cleaned up redundant/unused components and composables
- ✅ Fixed template corruption issues in Universal Hub

## Development Guidelines

1. **Add New Parser**: Use the standardization framework and registry pattern
2. **File Classification**: Add patterns to the parser registry
3. **Error Handling**: Follow null-safe template patterns
4. **Component Reuse**: Leverage existing standardized components
5. **Testing**: Verify integration with Universal Hub and global file store

## Debugging

- Use the "Debug: Show Enhanced Registry" button in Universal Hub
- Check browser console for detailed file processing logs
- Monitor global file store state through debug outputs
- Verify parser registration status in development tools
