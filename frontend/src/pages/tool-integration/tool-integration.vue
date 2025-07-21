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
              <q-tab name="pingcastle" :label="$t('toolIntegration.tools.pingcastle')" />
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
                    <div style="display: flex; flex-direction: row; width: 100%;" class="q-mb-md">
                      <!-- Drop zone and file input (LEFT) -->
                      <div style="flex: 1; min-width: 0;" class="q-mr-md">
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
                          multiple
                          style="display: none"
                          @change="onNessusFileSelected"
                        />
                        
                        <!-- Selected files info -->
                        <div v-if="nessusFiles.length > 0" class="q-mt-md">
                          <div class="text-subtitle2 q-mb-sm">Selected Files:</div>
                          <div v-for="(file, index) in nessusFiles" :key="index" class="q-mb-xs">
                            <q-chip
                              :label="file.name"
                              color="primary"
                              removable
                              @remove="removeFile(index)"
                            >
                              <template v-slot:avatar>
                                <q-icon name="fa fa-file" />
                              </template>
                            </q-chip>
                          </div>
                        </div>
                      </div>
                      <!-- Debug info panel (RIGHT) -->
                      <div style="flex: 1; min-width: 0;">
                        <q-card flat bordered>
                          <q-card-section>
                            <div class="text-h6 q-mb-md">
                              <q-icon name="fa fa-info-circle" class="q-mr-sm" />
                              Debug Info
                            </div>
                            <div v-if="nessusDebugInfo.length === 0" class="text-body2 text-grey-6">
                              No debug information available
                            </div>
                            <div v-else>
                              <div v-if="nessusDebugInfo[0] === 'No new vulnerabilities detected.'" class="q-mb-sm">
                                <q-chip color="green" text-color="white" icon="fa fa-check-circle">
                                  {{ nessusDebugInfo[0] }}
                                </q-chip>
                              </div>
                              <div v-else>
                                <div class="text-subtitle2 q-mb-sm text-orange-8">
                                  <q-icon name="fa fa-plus-circle" class="q-mr-xs" />
                                  {{ nessusDebugInfo[0] }}
                                </div>
                                <div class="debug-list">
                                  <q-chip
                                    v-for="(info, idx) in nessusDebugInfo.slice(1)"
                                    :key="idx"
                                    color="orange"
                                    text-color="white"
                                    dense
                                    class="q-ma-xs"
                                    size="sm"
                                  >
                                    <q-icon name="fa fa-file-medical" size="xs" class="q-mr-xs" />
                                    {{ info }}
                                  </q-chip>
                                </div>
                              </div>
                            </div>
                          </q-card-section>
                        </q-card>
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

              <!-- PingCastle Tab -->
              <q-tab-panel name="pingcastle">
                <div class="text-h6">{{ $t('toolIntegration.pingcastle.title') }}</div>
                <div class="text-body2 q-mb-md">{{ $t('toolIntegration.pingcastle.description') }}</div>
                <q-card flat bordered>
                  <q-card-section>
                    <div style="display: flex; flex-direction: row; width: 100%;" class="q-mb-md">
                      <!-- Drop zone and file input (LEFT) -->
                      <div style="flex: 1; min-width: 0;" class="q-mr-md">
                        <div
                          class="upload-area"
                          :class="{ 'upload-area-dragover': isPingCastleDragOver }"
                          @drop="onPingCastleFileDrop"
                          @dragover.prevent="isPingCastleDragOver = true"
                          @dragenter.prevent="isPingCastleDragOver = true"
                          @dragleave.prevent="isPingCastleDragOver = false"
                          @click="$refs.pingCastleFileInput.click()"
                        >
                          <div class="upload-content">
                            <q-icon name="fa fa-cloud-upload-alt" size="48px" color="primary" />
                            <div class="text-h6 q-mt-md">{{ $t('toolIntegration.pingcastle.dragDropTitle') }}</div>
                            <div class="text-body2 text-grey-6">{{ $t('toolIntegration.pingcastle.dragDropSubtitle') }}</div>
                            <div class="text-caption text-grey-5 q-mt-sm">
                              {{ $t('toolIntegration.pingcastle.supportedFormats') }}
                            </div>
                          </div>
                        </div>
                        
                        <!-- Hidden file input -->
                        <input
                          ref="pingCastleFileInput"
                          type="file"
                          accept=".xml"
                          multiple
                          style="display: none"
                          @change="onPingCastleFileSelected"
                        />
                        
                        <!-- Selected files info -->
                        <div v-if="pingCastleFiles.length > 0" class="q-mt-md">
                          <div class="text-subtitle2 q-mb-sm">Selected Files:</div>
                          <div v-for="(file, index) in pingCastleFiles" :key="index" class="q-mb-xs">
                            <q-chip
                              :label="file.name"
                              color="primary"
                              removable
                              @remove="removePingCastleFile(index)"
                            >
                              <template v-slot:avatar>
                                <q-icon name="fa fa-file" />
                              </template>
                            </q-chip>
                          </div>
                        </div>
                      </div>
                      <!-- Debug info panel (RIGHT) -->
                      <div style="flex: 1; min-width: 0;">
                        <q-card flat bordered>
                          <q-card-section>
                            <div class="text-h6 q-mb-md">
                              <q-icon name="fa fa-info-circle" class="q-mr-sm" />
                              Debug Info
                            </div>
                            <div v-if="pingcastleDebugInfo.length === 0" class="text-body2 text-grey-6">
                              No debug information available
                            </div>
                            <div v-else>
                              <div v-if="pingcastleDebugInfo[0] === 'All risks matched the current map.'" class="q-mb-sm">
                                <q-chip color="green" text-color="white" icon="fa fa-check-circle">
                                  {{ pingcastleDebugInfo[0] }}
                                </q-chip>
                              </div>
                              <div v-else>
                                <div class="text-subtitle2 q-mb-sm text-red-8">
                                  <q-icon name="fa fa-exclamation-triangle" class="q-mr-xs" />
                                  {{ pingcastleDebugInfo[0] }}
                                </div>
                                <div class="debug-list">
                                  <q-chip
                                    v-for="(info, idx) in pingcastleDebugInfo.slice(1)"
                                    :key="idx"
                                    color="red"
                                    text-color="white"
                                    dense
                                    class="q-ma-xs"
                                    size="sm"
                                  >
                                    <q-icon name="fa fa-question-circle" size="xs" class="q-mr-xs" />
                                    {{ info }}
                                  </q-chip>
                                </div>
                              </div>
                            </div>
                          </q-card-section>
                        </q-card>
                      </div>
                    </div>

                    <!-- Audit Selection -->
                    <div v-if="parsedPingCastleVulnerabilities.length > 0" class="q-mt-md">
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
                    <div v-if="parsedPingCastleVulnerabilities.length > 0" class="q-mt-lg">
                      <div class="row items-center q-mb-md">
                        <div class="col">
                          <div class="text-h6">{{ $t('toolIntegration.preview.title') }}</div>
                          <div class="text-body2">
                            {{ $t('toolIntegration.preview.description', { 
                              unique: parsedPingCastleVulnerabilities.length,
                              total: totalPingCastleVulnerabilities 
                            }) }}
                          </div>
                          <div class="text-caption text-grey-6 q-mt-xs">
                            {{ $t('toolIntegration.preview.mergeInfo', { 
                              unique: parsedPingCastleVulnerabilities.length,
                              total: totalPingCastleVulnerabilities 
                            }) }}
                          </div>
                        </div>
                        <div class="col-auto">
                          <q-btn
                            :label="$t('toolIntegration.preview.selectAll')"
                            flat
                            color="primary"
                            size="sm"
                            @click="selectAllPingCastleVulnerabilities"
                          />
                          <q-btn
                            :label="$t('toolIntegration.preview.deselectAll')"
                            flat
                            color="primary"
                            size="sm"
                            @click="deselectAllPingCastleVulnerabilities"
                          />
                        </div>
                      </div>
                      
                      <q-table
                        :rows="parsedPingCastleVulnerabilities"
                        :columns="previewColumns"
                        row-key="title"
                        :pagination="{ rowsPerPage: 100 }"
                        dense
                        selection="multiple"
                        v-model:selected="selectedPingCastleVulnerabilities"
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
                          :label="$t('toolIntegration.pingcastle.import')"
                          color="primary"
                          :loading="importingPingCastle"
                          :disable="selectedPingCastleVulnerabilities.length === 0 || !selectedAudit"
                          size="lg"
                          @click="importPingCastleVulnerabilities"
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
import PingCastleParser from '@/services/parsers/pingcastle-parser'
import AuditService from '@/services/audit'


export default defineComponent({
  name: 'ToolIntegration',

  data() {
    return {
      selectedTool: 'nessus',
      nessusFiles: [], // Change from nessusFile to array
      pingCastleFiles: [], // PingCastle files array
      customFile: null,
      importing: false,
      importingPingCastle: false,
      loadingAudits: false,
      parsing: false,
      parsingPingCastle: false,
      isDragOver: false,
      isPingCastleDragOver: false,
      parsedVulnerabilities: [],
      parsedPingCastleVulnerabilities: [],
      selectedVulnerabilities: [],
      selectedPingCastleVulnerabilities: [],
      selectedAudit: null,
      auditOptions: [],
      totalVulnerabilities: 0,
      totalPingCastleVulnerabilities: 0,
      fileFindingsMap: {}, // Track which findings belong to which files
      pingCastleFileFindingsMap: {}, // Track which findings belong to which PingCastle files
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
          field: 'severity',
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
          field: 'cvssScore',
          align: 'center',
          sortable: true
        }
      ],
      nessusDebugInfo: [],
      pingcastleDebugInfo: [],
    }
  },

  async mounted() {
    // Always reload settings from backend when entering this page
    if (this.$settings && this.$settings.refresh) {
      console.log('Refreshing settings')
      console.log(this.$settings)
      await this.$settings.refresh();
    }
    await this.loadAudits();
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
      const files = Array.from(event.target.files)
      if (files.length > 0) {
        // Add new files to existing array
        this.nessusFiles.push(...files)
        this.parseAllFiles()
      }
    },

    onFileDrop(event) {
      this.isDragOver = false
      event.preventDefault()
      
      const files = Array.from(event.dataTransfer.files)
      if (files.length > 0) {
        // Filter valid files
        const validFiles = files.filter(file => {
          const fileExtension = file.name.split('.').pop().toLowerCase()
          return ['nessus', 'xml', 'csv'].includes(fileExtension)
        })
        
        if (validFiles.length > 0) {
          // Add new files to existing array
          this.nessusFiles.push(...validFiles)
          this.parseAllFiles()
        } else {
          Notify.create({
            message: 'No valid files found. Please use .nessus, .xml, or .csv files.',
            color: 'negative',
            position: 'top-right'
          })
        }
      }
    },


    removeFile(fileIndex) {
      const removedFile = this.nessusFiles[fileIndex]
      this.nessusFiles.splice(fileIndex, 1)
      
      // Remove from fileFindingsMap
      if (this.fileFindingsMap[removedFile.name]) {
        delete this.fileFindingsMap[removedFile.name]
      }
      
      // Re-parse all remaining files to recalculate merging
      if (this.nessusFiles.length > 0) {
        this.parseAllFiles()
      } else {
        // No files left, clear everything immediately
        this.parsedVulnerabilities = []
        this.selectedVulnerabilities = []
        this.totalVulnerabilities = 0
        this.fileFindingsMap = {}
      }
      
      console.log(`Removed file ${removedFile.name}, remaining files: ${this.nessusFiles.length}`)
    },

    /**
     * Parse all Nessus files together and show preview
     */
    async parseAllFiles() {
      if (this.nessusFiles.length === 0) {
        Notify.create({
          message: $t('toolIntegration.nessus.noFileSelected'),
          color: 'warning',
          position: 'top-right'
        })
        return
      }

      this.parsing = true
      
      try {
        // Clear existing data
        this.parsedVulnerabilities = []
        this.selectedVulnerabilities = []
        this.fileFindingsMap = {}
        this.totalVulnerabilities = 0
        
        // Parse all files together with one parser to handle merging properly
        const parser = new NessusParser(null, this.nessusFiles, true, true)
        await parser.parse()
        
        // Store findings by file for tracking (simplified approach)
        for (const file of this.nessusFiles) {
          this.fileFindingsMap[file.name] = parser.findings
        }
        
        // Use the parser's merged findings for preview
        const mergedFindings = parser.findings
        
        // Get database values for preview
        const previewFindings = await this._getDatabaseValuesForPreview(mergedFindings)
        this.parsedVulnerabilities = previewFindings
        
        // Sort by CVSS score in descending order
        this.parsedVulnerabilities.sort((a, b) => {
          const aScore = a.cvssScore || 0
          const bScore = b.cvssScore || 0
          return bScore - aScore
        })
        
        this.totalVulnerabilities = this.parsedVulnerabilities.length
        
        Notify.create({
          message: `Successfully parsed ${this.nessusFiles.length} file(s) with ${this.parsedVulnerabilities.length} unique vulnerabilities`,
          color: 'positive',
          position: 'top-right'
        })
        
        // After parsing and before import
        const VulnerabilityService = (await import('@/services/vulnerability')).default;
        const response = await VulnerabilityService.getVulnerabilities();
        const allDBVulns = response.data.datas || [];

        const newVulns = parser.findings.filter(finding =>
          !allDBVulns.some(vuln => vuln.details.some(detail => detail.title === finding.title))
        ).map(finding => finding.title);

        this.nessusDebugInfo = newVulns.length
          ? ['New vulnerabilities to be added:', ...newVulns]
          : ['No new vulnerabilities detected.'];
        
      } catch (error) {
        console.error('Error parsing files:', error)
        Notify.create({
          message: error.message || 'Error parsing files',
          color: 'negative',
          position: 'top-right'
        })
      } finally {
        this.parsing = false
      }
    },


    /**
     * Get database values for preview
     */
    async _getDatabaseValuesForPreview(findings) {
      try {
        
        // Get all vulnerabilities from database
        const VulnerabilityService = (await import('@/services/vulnerability')).default
        const response = await VulnerabilityService.getVulnerabilities()
        const allPwndocDBVulns = response.data.datas || []
                
        const previewFindings = []
        
        for (const finding of findings) {
          const vulnFromDB = this._getVulnFromPwndocDBByTitle(finding.title, allPwndocDBVulns)
          
          if (vulnFromDB) {
            
            // Convert CVSS vector to numerical score using appropriate calculator
            const cvssScore = this._convertCvssVectorToScore(vulnFromDB.cvssv3)
            
            // Convert CVSS score to severity using appropriate calculator
            const severity = this._cvssScoreToSeverity(cvssScore)
            
            // Use database values for CVSS and severity
            const previewFinding = {
              ...finding,  // This keeps our merged POC and scope
              cvssv3: cvssScore,                // Numerical CVSS score
              cvssScore: cvssScore,             // Add this field for sorting
              severity: severity,               // Severity text (Critical, High, Medium, Low)
              category: vulnFromDB.category,    // Database category
              originalFinding: finding.allOriginalFindings || [finding]  // Keep the merged data
            }
            previewFindings.push(previewFinding)
          } else {
            // If not in database, use parsed values (fallback)
            previewFindings.push({
              ...finding,  // This keeps our merged POC and scope
              cvssScore: null, // Add this field for sorting
              originalFinding: finding.allOriginalFindings || [finding]  // Keep the merged data
            })
          }
        }
                
        // Sort by CVSS score in descending order (highest first)
        previewFindings.sort((a, b) => {
          const aScore = a.cvssScore || 0
          const bScore = b.cvssScore || 0
          return bScore - aScore // descending order
        })
                
        return previewFindings
      } catch (error) {
        console.error('Error getting database values for preview:', error)
        // Fallback to parsed values if database lookup fails
        return findings.map(finding => ({
          ...finding,
          cvssScore: null, // Add this field for sorting
          originalFinding: finding
        }))
      }
    },

    /**
     * Get vulnerability from database by title
     */
    _getVulnFromPwndocDBByTitle(title, allVulns) {
      const found = allVulns.find(vuln => 
        vuln.details.some(detail => detail.title === title)
      )     
      return found
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
          message: 'No vulnerabilities selected for import',
          color: 'warning',
          position: 'top-right'
        })
        return
      }

      if (!this.selectedAudit) {
        Notify.create({
          message: 'Please select an audit first',
          color: 'warning',
          position: 'top-right'
        })
        return
      }

      // Get audit name for confirmation message
      const selectedAuditOption = this.auditOptions.find(audit => audit.value === this.selectedAudit)
      const auditName = selectedAuditOption ? selectedAuditOption.label : 'Unknown Audit'

      try {
        
        // Use the correct Quasar dialog API with Promise
        const confirmed = await new Promise((resolve) => {
          this.$q.dialog({
            title: 'Confirm Import',
            message: `Are you sure you want to import ${this.selectedVulnerabilities.length} vulnerabilities to "${auditName}"?`,
            ok: {
              label: 'Import',
              color: 'primary'
            },
            cancel: {
              label: 'Cancel',
              color: 'grey'
            },
            persistent: true
          }).onOk(() => {
            resolve(true)
          }).onCancel(() => {
            resolve(false)
          }).onDismiss(() => {
            resolve(false)
          })
        })

        // Check if user confirmed
        if (!confirmed) {
          return
        }

        this.importing = true

        // Extract all original findings for the parser to handle merging
        const allOriginalFindings = []
        for (const v of this.selectedVulnerabilities) {
          if (v.originalFinding && Array.isArray(v.originalFinding)) {
            allOriginalFindings.push(...v.originalFinding)
          } else {
            allOriginalFindings.push(v.originalFinding)
          }
        }
                
        // Create a parser with merge = true to handle POC creation properly
        const parser = new NessusParser(this.selectedAudit, [], true, false)
        
        // Import all original findings and let the parser handle merging
        await parser.importSelectedFindings(allOriginalFindings)

        Notify.create({
          message: 'Vulnerabilities imported successfully',
          color: 'positive',
          position: 'top-right'
        })

        // Clear selections after successful import
        this.selectedVulnerabilities = []

      } catch (error) {
        console.error('Error importing vulnerabilities:', error)
        Notify.create({
          message: error.message || 'Error importing vulnerabilities',
          color: 'negative',
          position: 'top-right'
        })
      } finally {
        this.importing = false
      }
    },

    /**
     * Convert CVSS vector string to numerical score using appropriate CVSS calculator
     */
    _convertCvssVectorToScore(cvssVector) {
      if (!cvssVector || typeof cvssVector !== 'string') {
        return null
      }
      
      try {
        // Check if it's already a numerical value
        const num = parseFloat(cvssVector)
        if (!isNaN(num)) {
          return num
        }
        
        // If it's a CVSS vector, use the appropriate calculator
        if (cvssVector.startsWith('CVSS:3.0/')) {
          
          // Use CVSS30.calculateCVSSFromVector for CVSS 3.0 (if available globally)
          // Note: CVSS30 might not be available globally, so we'll use CVSS31 as fallback
          const result = CVSS31.calculateCVSSFromVector(cvssVector)
          
          if (result.success) {
            return parseFloat(result.baseMetricScore)
          } else {
            console.error('CVSS 3.0 calculation failed:', result)
            return null
          }
        } else if (cvssVector.startsWith('CVSS:3.1/')) {         
          // Use CVSS31.calculateCVSSFromVector for CVSS 3.1
          const result = CVSS31.calculateCVSSFromVector(cvssVector)
          
          if (result.success) {
            return parseFloat(result.baseMetricScore)
          } else {
            console.error('CVSS 3.1 calculation failed:', result)
            return null
          }
        }
        
        return null
      } catch (error) {
        console.error('Error converting CVSS vector:', error)
        return null
      }
    },

    /**
     * Convert CVSS score to severity using appropriate CVSS calculator
     */
    _cvssScoreToSeverity(cvssScore) {
      if (cvssScore === null || cvssScore === undefined || isNaN(cvssScore)) {
        return 'Low'
      }
      
      // Both CVSS 3.0 and 3.1 have the same severity rating function
      // We can use either one since they have the same severity bands
      const severity = CVSS31.severityRating(cvssScore) || 'Low'
      return severity
    },

    // PingCastle Methods
    onPingCastleFileSelected(event) {
      const files = Array.from(event.target.files)
      if (files.length > 0) {
        // Add new files to existing array
        this.pingCastleFiles.push(...files)
        this.parseAllPingCastleFiles()
      }
    },

    onPingCastleFileDrop(event) {
      this.isPingCastleDragOver = false
      event.preventDefault()
      
      const files = Array.from(event.dataTransfer.files)
      if (files.length > 0) {
        // Filter valid files
        const validFiles = files.filter(file => {
          const fileExtension = file.name.split('.').pop().toLowerCase()
          return ['xml'].includes(fileExtension)
        })
        
        if (validFiles.length > 0) {
          // Add new files to existing array
          this.pingCastleFiles.push(...validFiles)
          this.parseAllPingCastleFiles()
        } else {
          Notify.create({
            message: 'No valid files found. Please use .xml files.',
            color: 'negative',
            position: 'top-right'
          })
        }
      }
    },

    removePingCastleFile(fileIndex) {
      const removedFile = this.pingCastleFiles[fileIndex]
      this.pingCastleFiles.splice(fileIndex, 1)
      
      // Remove from fileFindingsMap
      if (this.pingCastleFileFindingsMap[removedFile.name]) {
        delete this.pingCastleFileFindingsMap[removedFile.name]
      }
      
      // Re-parse all remaining files to recalculate merging
      if (this.pingCastleFiles.length > 0) {
        this.parseAllPingCastleFiles()
      } else {
        // No files left, clear everything immediately
        this.parsedPingCastleVulnerabilities = []
        this.selectedPingCastleVulnerabilities = []
        this.totalPingCastleVulnerabilities = 0
        this.pingCastleFileFindingsMap = {}
      }
      
      console.log(`Removed PingCastle file ${removedFile.name}, remaining files: ${this.pingCastleFiles.length}`)
    },

    /**
     * Parse all PingCastle files together and show preview
     */
    async parseAllPingCastleFiles() {
      if (this.pingCastleFiles.length === 0) {
        Notify.create({
          message: $t('toolIntegration.pingcastle.noFileSelected'),
          color: 'warning',
          position: 'top-right'
        })
        return
      }

      this.parsingPingCastle = true
      
      try {
        // Clear existing data
        this.parsedPingCastleVulnerabilities = []
        this.selectedPingCastleVulnerabilities = []
        this.pingCastleFileFindingsMap = {}
        this.totalPingCastleVulnerabilities = 0
        
        // Get the map from global settings
        const pingcastleMap = this.$settings.toolIntegrations?.pingcastle?.pingcastleMap;
        console.log('PingCastle map used by parser:', pingcastleMap);

        // Parse all files together with one parser to handle merging properly
        // Use merge = true and dryRun = true for preview
        const parser = new PingCastleParser(
          null, // or auditId if needed
          this.pingCastleFiles,
          true, // merge
          true, // dryRun
          pingcastleMap // <--- pass the map here
        )
        await parser.parse()
        
        // Store findings by file for tracking (simplified approach)
        for (const file of this.pingCastleFiles) {
          this.pingCastleFileFindingsMap[file.name] = parser.findings
        }
        
        // Use the parser's merged findings for preview
        const mergedFindings = parser.findings
        
        // Get database values for preview
        const previewFindings = await this._getDatabaseValuesForPingCastlePreview(mergedFindings)
        this.parsedPingCastleVulnerabilities = previewFindings
        
        // Sort by CVSS score in descending order
        this.parsedPingCastleVulnerabilities.sort((a, b) => {
          const aScore = a.cvssScore || 0
          const bScore = b.cvssScore || 0
          return bScore - aScore
        })
        
        this.totalPingCastleVulnerabilities = this.parsedPingCastleVulnerabilities.length
        
        Notify.create({
          message: `Successfully parsed ${this.pingCastleFiles.length} PingCastle file(s) with ${this.parsedPingCastleVulnerabilities.length} unique vulnerabilities`,
          color: 'positive',
          position: 'top-right'
        })
        
        // After await parser.parse()
        const unmatchedRiskIds = Array.from(parser.unmatchedRiskIds || []);
        this.pingcastleDebugInfo = unmatchedRiskIds.length
          ? ['Unmatched PingCastle risk IDs:', ...unmatchedRiskIds]
          : ['All risks matched the current map.'];
        
      } catch (error) {
        console.error('Error parsing PingCastle files:', error)
        Notify.create({
          message: error.message || 'Error parsing PingCastle files',
          color: 'negative',
          position: 'top-right'
        })
      } finally {
        this.parsingPingCastle = false
      }
    },

    /**
     * Get database values for PingCastle preview
     */
    async _getDatabaseValuesForPingCastlePreview(findings) {
      try {
        
        // Get all vulnerabilities from database
        const VulnerabilityService = (await import('@/services/vulnerability')).default
        const response = await VulnerabilityService.getVulnerabilities()
        const allPwndocDBVulns = response.data.datas || []
                
        const previewFindings = []
        
        for (const finding of findings) {
          const vulnFromDB = this._getVulnFromPwndocDBByTitle(finding.title, allPwndocDBVulns)
          
          if (vulnFromDB) {
            
            // Convert CVSS vector to numerical score using appropriate calculator
            const cvssScore = this._convertCvssVectorToScore(vulnFromDB.cvssv3)
            
            // Convert CVSS score to severity using appropriate calculator
            const severity = this._cvssScoreToSeverity(cvssScore)
            
            // Use database values for CVSS and severity
            const previewFinding = {
              ...finding,  // This keeps our merged POC and scope
              cvssv3: cvssScore,                // Numerical CVSS score
              cvssScore: cvssScore,             // Add this field for sorting
              severity: severity,               // Severity text (Critical, High, Medium, Low)
              category: vulnFromDB.category,    // Database category
              originalFinding: finding.allOriginalFindings || [finding]  // Keep the merged data
            }
            previewFindings.push(previewFinding)
          } else {
            // If not in database, use parsed values (fallback)
            previewFindings.push({
              ...finding,  // This keeps our merged POC and scope
              cvssScore: null, // Add this field for sorting
              originalFinding: finding.allOriginalFindings || [finding]  // Keep the merged data
            })
          }
        }
                
        // Sort by CVSS score in descending order (highest first)
        previewFindings.sort((a, b) => {
          const aScore = a.cvssScore || 0
          const bScore = b.cvssScore || 0
          return bScore - aScore // descending order
        })
                
        return previewFindings
      } catch (error) {
        console.error('Error getting database values for PingCastle preview:', error)
        // Fallback to parsed values if database lookup fails
        return findings.map(finding => ({
          ...finding,
          cvssScore: null, // Add this field for sorting
          originalFinding: finding
        }))
      }
    },

    selectAllPingCastleVulnerabilities() {
      this.selectedPingCastleVulnerabilities = [...this.parsedPingCastleVulnerabilities]
    },

    deselectAllPingCastleVulnerabilities() {
      this.selectedPingCastleVulnerabilities = []
    },

    async importPingCastleVulnerabilities() {
      if (this.selectedPingCastleVulnerabilities.length === 0) {
        Notify.create({
          message: 'No vulnerabilities selected for import',
          color: 'warning',
          position: 'top-right'
        })
        return
      }

      if (!this.selectedAudit) {
        Notify.create({
          message: 'Please select an audit first',
          color: 'warning',
          position: 'top-right'
        })
        return
      }

      // Get audit name for confirmation message
      const selectedAuditOption = this.auditOptions.find(audit => audit.value === this.selectedAudit)
      const auditName = selectedAuditOption ? selectedAuditOption.label : 'Unknown Audit'

      try {
        
        // Use the correct Quasar dialog API with Promise
        const confirmed = await new Promise((resolve) => {
          this.$q.dialog({
            title: 'Confirm Import',
            message: `Are you sure you want to import ${this.selectedPingCastleVulnerabilities.length} vulnerabilities to "${auditName}"?`,
            ok: {
              label: 'Import',
              color: 'primary'
            },
            cancel: {
              label: 'Cancel',
              color: 'grey'
            },
            persistent: true
          }).onOk(() => {
            resolve(true)
          }).onCancel(() => {
            resolve(false)
          }).onDismiss(() => {
            resolve(false)
          })
        })

        // Check if user confirmed
        if (!confirmed) {
          return
        }

        this.importingPingCastle = true

        // Extract all original findings for the parser to handle merging
        const allOriginalFindings = []
        for (const v of this.selectedPingCastleVulnerabilities) {
          if (v.originalFinding && Array.isArray(v.originalFinding)) {
            allOriginalFindings.push(...v.originalFinding)
          } else {
            allOriginalFindings.push(v.originalFinding)
          }
        }
                
        // Create a parser with merge = true to handle POC creation properly
        const pingcastleMap = this.$settings.toolIntegrations?.pingcastle?.pingcastleMap;
        const parser = new PingCastleParser(this.selectedAudit, [], true, false, pingcastleMap);
        
        // Import all original findings and let the parser handle merging
        await parser.importSelectedFindings(allOriginalFindings)

        Notify.create({
          message: 'PingCastle vulnerabilities imported successfully',
          color: 'positive',
          position: 'top-right'
        })

        // Clear selections after successful import
        this.selectedPingCastleVulnerabilities = []

      } catch (error) {
        console.error('Error importing PingCastle vulnerabilities:', error)
        Notify.create({
          message: error.message || 'Error importing PingCastle vulnerabilities',
          color: 'negative',
          position: 'top-right'
        })
      } finally {
        this.importingPingCastle = false
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