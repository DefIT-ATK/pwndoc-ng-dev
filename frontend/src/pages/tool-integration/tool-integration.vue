<template>
  <q-page class="q-pa-md">
    <div class="row">
      <div class="col-12">
        <q-card>
          <q-card-section>
            <div class="text-h5">{{ $t('toolIntegration.title') }}</div>
            <div class="text-subtitle2 text-grey-7">{{ $t('toolIntegration.subtitle') }}</div>
          </q-card-section>
          
          <q-card-section>
            <q-tabs
              v-model="selectedTool"
              dense
              class="text-grey"
              active-color="primary"
              indicator-color="primary"
              align="justify"
              narrow-indicator
            >
              <q-tab name="nessus" :label="$t('toolIntegration.tools.nessus')" />
              <q-tab name="burp" :label="$t('toolIntegration.tools.burp')" />
              <q-tab name="custom" :label="$t('toolIntegration.tools.custom')" />
            </q-tabs>

            <q-separator />

            <q-tab-panels v-model="selectedTool" animated>
              <!-- Nessus Tab -->
              <q-tab-panel name="nessus">
                <div class="text-h6">{{ $t('toolIntegration.nessus.title') }}</div>
                <div class="text-body2 q-mb-md">{{ $t('toolIntegration.nessus.description') }}</div>
                
                <q-card flat bordered>
                  <q-card-section>
                    <div class="row q-gutter-md">
                      <div class="col-12 col-md-6">
                        <!-- Drag & Drop File Upload -->
                        <div
                          class="upload-area"
                          :class="{ 'upload-area-dragover': isDragOver }"
                          @drop="onFileDrop"
                          @dragover.prevent="isDragOver = true"
                          @dragenter.prevent="isDragOver = true"
                          @dragleave.prevent="isDragOver = false"
                          @click="$refs.nessusFileInput.click()"
                        >
                          <div class="upload-content">
                            <q-icon name="fa fa-cloud-upload-alt" size="48px" color="primary" />
                            <div class="text-h6 q-mt-md">{{ $t('toolIntegration.nessus.dragDropTitle') }}</div>
                            <div class="text-body2 text-grey-6">{{ $t('toolIntegration.nessus.dragDropSubtitle') }}</div>
                            <div class="text-caption text-grey-5 q-mt-sm">
                              {{ $t('toolIntegration.nessus.supportedFormats') }}
                            </div>
                          </div>
                        </div>
                        
                        <!-- Hidden file input -->
                        <input
                          ref="nessusFileInput"
                          type="file"
                          accept=".nessus,.xml,.csv"
                          style="display: none"
                          @change="onNessusFileSelected"
                        />
                        
                        <!-- Selected file info -->
                        <div v-if="nessusFile" class="q-mt-md">
                          <q-chip
                            :label="nessusFile.name"
                            color="primary"
                            removable
                            @remove="nessusFile = null"
                          >
                            <template v-slot:avatar>
                              <q-icon name="fa fa-file" />
                            </template>
                          </q-chip>
                        </div>
                      </div>
                    </div>

                    <!-- Audit Selection -->
                    <div v-if="parsedVulnerabilities.length > 0" class="q-mt-md">
                      <div class="text-subtitle1 q-mb-sm">{{ $t('toolIntegration.auditSelection.title') }}</div>
                      <div class="row q-gutter-md">
                        <div class="col-12 col-md-6">
                          <q-select
                            v-model="selectedAudit"
                            :options="auditOptions"
                            :label="$t('toolIntegration.auditSelection.selectAudit')"
                            outlined
                            emit-value
                            map-options
                            :loading="loadingAudits"
                          >
                            <template v-slot:no-option>
                              <q-item>
                                <q-item-section class="text-grey">
                                  {{ $t('toolIntegration.auditSelection.noAudits') }}
                                </q-item-section>
                              </q-item>
                            </template>
                          </q-select>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Preview Section -->
                    <div v-if="parsedVulnerabilities.length > 0" class="q-mt-lg">
                      <div class="row items-center q-mb-md">
                        <div class="col">
                          <div class="text-h6">{{ $t('toolIntegration.preview.title') }}</div>
                          <div class="text-body2">
                            {{ $t('toolIntegration.preview.description', { 
                              unique: parsedVulnerabilities.length,
                              total: totalVulnerabilities 
                            }) }}
                          </div>
                          <div class="text-caption text-grey-6 q-mt-xs">
                            {{ $t('toolIntegration.preview.mergeInfo', { 
                              unique: parsedVulnerabilities.length,
                              total: totalVulnerabilities 
                            }) }}
                          </div>
                        </div>
                        <div class="col-auto">
                          <q-btn
                            :label="$t('toolIntegration.preview.selectAll')"
                            flat
                            color="primary"
                            size="sm"
                            @click="selectAllVulnerabilities"
                          />
                          <q-btn
                            :label="$t('toolIntegration.preview.deselectAll')"
                            flat
                            color="primary"
                            size="sm"
                            @click="deselectAllVulnerabilities"
                          />
                        </div>
                      </div>
                      
                      <q-table
                        :rows="parsedVulnerabilities"
                        :columns="previewColumns"
                        row-key="title"
                        :pagination="{ rowsPerPage: 100 }"
                        dense
                        selection="multiple"
                        v-model:selected="selectedVulnerabilities"
                        class="vulnerability-table"
                      >
                        <template v-slot:body-cell-severity="props">
                          <div class="text-center severity-cell">
                            <q-badge
                              :color="getSeverityColor(props.value)"
                              :label="props.value"
                              class="severity-badge"
                              text-color="white"
                            />
                          </div>
                        </template>
                      </q-table>

                      <!-- Import Button moved here -->
                      <div class="q-mt-md text-center">
                        <q-btn
                          :label="$t('toolIntegration.nessus.import')"
                          color="primary"
                          :loading="importing"
                          :disable="selectedVulnerabilities.length === 0 || !selectedAudit"
                          size="lg"
                          @click="importNessusVulnerabilities"
                        >
                          <template v-slot:loading>
                            <q-spinner-facebook />
                          </template>
                        </q-btn>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </q-tab-panel>

              <!-- Burp Tab -->
              <q-tab-panel name="burp">
                <div class="text-h6">{{ $t('toolIntegration.burp.title') }}</div>
                <div class="text-body2 q-mb-md">{{ $t('toolIntegration.burp.description') }}</div>
                
                <q-card flat bordered>
                  <q-card-section>
                    <q-file
                      v-model="burpFile"
                      :label="$t('toolIntegration.burp.selectFile')"
                      accept=".xml,.json"
                      outlined
                    >
                      <template v-slot:prepend>
                        <q-icon name="fa fa-file-upload" />
                      </template>
                    </q-file>
                    
                    <q-btn
                      :label="$t('toolIntegration.burp.import')"
                      color="primary"
                      class="q-mt-md"
                      :disable="!burpFile"
                    />
                  </q-card-section>
                </q-card>
              </q-tab-panel>

              <!-- Custom Tab -->
              <q-tab-panel name="custom">
                <div class="text-h6">{{ $t('toolIntegration.custom.title') }}</div>
                <div class="text-body2 q-mb-md">{{ $t('toolIntegration.custom.description') }}</div>
                
                <q-card flat bordered>
                  <q-card-section>
                    <q-file
                      v-model="customFile"
                      :label="$t('toolIntegration.custom.selectFile')"
                      accept=".xml,.json,.csv,.txt"
                      outlined
                    >
                      <template v-slot:prepend>
                        <q-icon name="fa fa-file-upload" />
                      </template>
                    </q-file>
                    
                    <q-btn
                      :label="$t('toolIntegration.custom.import')"
                      color="primary"
                      class="q-mt-md"
                      :disable="!customFile"
                    />
                  </q-card-section>
                </q-card>
              </q-tab-panel>
            </q-tab-panels>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script>
import { defineComponent } from 'vue'
import { Notify } from 'quasar'
import { $t } from '@/boot/i18n'
import NessusParser from '@/services/parsers/nessus-parser'
import AuditService from '@/services/audit'

export default defineComponent({
  name: 'ToolIntegration',

  data() {
    return {
      selectedTool: 'nessus',
      nessusFile: null,
      burpFile: null,
      customFile: null,
      importing: false,
      loadingAudits: false,
      isDragOver: false,
      parsedVulnerabilities: [],
      selectedVulnerabilities: [],
      selectedAudit: null,
      auditOptions: [],
      totalVulnerabilities: 0, // Total before merging
      previewColumns: [
        {
          name: 'title',
          label: $t('toolIntegration.preview.columns.title'),
          field: 'title',
          align: 'left',
          sortable: true
        },
        {
          name: 'severity',
          label: $t('toolIntegration.preview.columns.severity'),
          field: row => this._priorityToSeverity(row.priority),
          align: 'center',
          sortable: true,
          sort: (a, b) => {
            const severityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'Info': 0 }
            return severityOrder[b] - severityOrder[a]
          }
        },
        {
          name: 'cvss',
          label: $t('toolIntegration.preview.columns.cvss'),
          field: 'cvssv3',
          align: 'center',
          sortable: true
        }
      ]
    }
  },

  async mounted() {
    await this.loadAudits()
  },

  methods: {
    async loadAudits() {
      this.loadingAudits = true
      try {
        const response = await AuditService.getAudits()
        this.auditOptions = response.data.datas.map(audit => ({
          label: `${audit.name} (${audit.client?.name || 'Unknown Client'})`,
          value: audit._id
        }))
      } catch (error) {
        console.error('Error loading audits:', error)
        Notify.create({
          message: 'Error loading audits',
          color: 'negative',
          position: 'top-right'
        })
      } finally {
        this.loadingAudits = false
      }
    },

    onNessusFileSelected(event) {
      const file = event.target.files[0]
      if (file) {
        this.nessusFile = file
        this.parseNessusFile()
      }
    },

    onFileDrop(event) {
      this.isDragOver = false
      event.preventDefault()
      
      const files = event.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        // Check if it's a valid Nessus file
        const fileExtension = file.name.split('.').pop().toLowerCase()
        if (['nessus', 'xml', 'csv'].includes(fileExtension)) {
          this.nessusFile = file
          this.parseNessusFile()
        } else {
          Notify.create({
            message: 'Invalid file format. Please use .nessus, .xml, or .csv files.',
            color: 'negative',
            position: 'top-right'
          })
        }
      }
    },

    /**
     * Parse Nessus file and show preview
     */
    async parseNessusFile() {
      if (!this.nessusFile) {
        Notify.create({
          message: $t('toolIntegration.nessus.noFileSelected'),
          color: 'warning',
          position: 'top-right'
        })
        return
      }

      this.parsing = true
      
      try {
        // Create parser and parse file
        const parser = new NessusParser(null, [this.nessusFile], true, true)
        const result = await parser.parse()
        
        if (result.success) {
          // Store the original findings for import
          this.originalFindings = parser.findings
          
          // Merge findings for preview
          this.parsedVulnerabilities = this._mergeFindingsForPreview(parser.findings).map(finding => ({
            ...finding,
            originalFinding: finding // Store reference to original for import
          }))
          
          this.totalVulnerabilities = result.vulnsCount || parser.findings.length
          
          Notify.create({
            message: $t('toolIntegration.nessus.parseSuccess', { 
              unique: this.parsedVulnerabilities.length,
              total: this.totalVulnerabilities 
            }),
            color: 'positive',
            position: 'top-right'
          })
        } else {
          throw new Error(result.error)
        }
      } catch (error) {
        console.error('Error parsing Nessus file:', error)
        Notify.create({
          message: error.message || $t('toolIntegration.nessus.parseError'),
          color: 'negative',
          position: 'top-right'
        })
      } finally {
        this.parsing = false
      }
    },

    /**
     * Merge findings for preview (same logic as base parser)
     */
    _mergeFindingsForPreview(findings) {
      console.log(`Merging ${findings.length} findings for preview`)
      
      // Group findings by title
      const uniqueTitles = {}
      for (const finding of findings) {
        const title = finding.title
        if (!uniqueTitles[title]) {
          uniqueTitles[title] = []
        }
        uniqueTitles[title].push(finding)
      }

      // Process each group of findings
      const result = []
      for (const [title, titleFindings] of Object.entries(uniqueTitles)) {
        const mergedFinding = this._mergeSingleFindingGroup(titleFindings)
        result.push(mergedFinding)
      }

      console.log(`Preview shows ${result.length} unique vulnerabilities`)
      return result
    },

    /**
     * Merge a group of findings with the same title
     */
    _mergeSingleFindingGroup(findings) {
      const initialFinding = { ...findings[0] }
      const mergedFinding = initialFinding
      
      // Collect scopes for merging
      const tempMergedScope = []
      
      for (const finding of findings) {
        tempMergedScope.push(finding.scope)
      }

      // Set scope - combine all unique scopes
      const uniqueScopes = [...new Set(tempMergedScope)]
      mergedFinding.scope = uniqueScopes.length > 10 
        ? 'Multiple Targets' 
        : uniqueScopes.join(', ')

      // Keep the POC from the first finding (it's already properly formatted by the parser)
      // Don't manipulate the POC anymore since the parser handles it correctly
      
      return mergedFinding
    },

    selectAllVulnerabilities() {
      this.selectedVulnerabilities = [...this.parsedVulnerabilities]
    },

    deselectAllVulnerabilities() {
      this.selectedVulnerabilities = []
    },

    _priorityToSeverity(priority) {
      const severityMap = {
        1: 'Critical',
        2: 'High',
        3: 'Medium',
        4: 'Low'
      }
      return severityMap[priority] || 'Low'
    },

    getSeverityColor(severity) {
      const colors = {
        'Critical': 'red',
        'High': 'orange',
        'Medium': 'yellow',
        'Low': 'green',
        'Info': 'blue'
      }
      return colors[severity] || 'grey'
    },

    async importNessusVulnerabilities() {
      if (this.selectedVulnerabilities.length === 0) {
        Notify.create({
          message: $t('toolIntegration.nessus.noVulnerabilities'),
          color: 'warning',
          position: 'top-right'
        })
        return
      }

      if (!this.selectedAudit) {
        Notify.create({
          message: $t('toolIntegration.auditSelection.noAuditSelected'),
          color: 'warning',
          position: 'top-right'
        })
        return
      }

      // Show confirmation dialog
      const auditName = this.auditOptions.find(a => a.value === this.selectedAudit)?.label || 'Unknown Audit'
      
      try {
        await this.$q.dialog({
          title: 'Confirm Import',
          message: `Are you sure you want to import ${this.selectedVulnerabilities.length} vulnerability(ies) to the audit "${auditName}"?`,
          cancel: true,
          persistent: true,
          ok: {
            label: 'Import',
            color: 'primary'
          },
          cancel: {
            label: 'Cancel',
            color: 'grey'
          }
        })
      } catch (error) {
        // User cancelled
        return
      }

      this.importing = true
      
      try {
        console.log('Importing selected vulnerabilities:', this.selectedVulnerabilities.length)
        console.log('Selected vulnerabilities:', this.selectedVulnerabilities.map(v => v.title))
        
        // Extract only the selected findings
        const selectedFindings = this.selectedVulnerabilities.map(v => v.originalFinding)
        
        // Create a parser with the selected audit ID
        const parser = new NessusParser(this.selectedAudit, [], true, false)
        
        // Import only the selected findings
        const result = await parser.importSelectedFindings(selectedFindings)
        
        if (result.success) {
          Notify.create({
            message: $t('toolIntegration.nessus.importSuccess', { 
              count: this.selectedVulnerabilities.length,
              audit: auditName
            }),
            color: 'positive',
            position: 'top-right'
          })
          
          // Clear only the selection and audit, keep the preview
          this.selectedVulnerabilities = []
          this.selectedAudit = null
        } else {
          throw new Error(result.error)
        }
        
      } catch (error) {
        console.error('Error importing vulnerabilities:', error)
        Notify.create({
          message: error.message || $t('toolIntegration.nessus.importError'),
          color: 'negative',
          position: 'top-right'
        })
      } finally {
        this.importing = false
      }
    }
  }
})
</script>

<style scoped>
.q-page {
  background-color: #f5f5f5;
}

.upload-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #fafafa;
}

.upload-area:hover {
  border-color: #1976d2;
  background-color: #f0f8ff;
}

.upload-area-dragover {
  border-color: #1976d2;
  background-color: #e3f2fd;
  transform: scale(1.02);
}

.upload-content {
  pointer-events: none;
}

.severity-badge {
  font-size: 0.75rem;
  padding: 4px 8px;
  min-width: 70px;
  text-align: center;
  font-weight: 500;
}

.severity-cell {
  background-color: #f5f5f5;
  width: 100%;
  padding: 4px;
}

/* Force the severity column to have grey background */
:deep(.vulnerability-table th:nth-child(2)) {
  background-color: #f5f5f5 !important;
}

:deep(.vulnerability-table td:nth-child(2)) {
  background-color: #f5f5f5 !important;
}
</style> 