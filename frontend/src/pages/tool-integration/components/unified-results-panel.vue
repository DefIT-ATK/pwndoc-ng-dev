<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-subtitle1 q-mb-md flex items-center">
        <q-icon name="assessment" class="q-mr-sm" />
        Unified Results
        <q-space />
        <q-btn
          v-if="Object.keys(parseResults).length > 0"
          flat
          dense
          icon="refresh"
          label="Refresh"
          @click="refreshResults"
        />
      </div>

      <!-- Results Overview -->
      <div v-if="aggregatedStats.totalVulnerabilities > 0">
        <!-- Summary Stats -->
        <div class="row q-gutter-md q-mb-lg">
          <div class="col-12 col-md-8">
            <q-card bordered class="stats-card">
              <q-card-section class="q-pa-md">
                <div class="text-h6 q-mb-sm">
                  {{ aggregatedStats.totalVulnerabilities }} Vulnerabilities Found
                </div>
                
                <!-- Severity breakdown -->
                <div class="row q-gutter-sm q-mb-md">
                  <q-chip
                    v-for="(count, severity) in aggregatedStats.bySeverity"
                    :key="severity"
                    :color="getSeverityColor(severity)"
                    text-color="white"
                    :label="`${severity}: ${count}`"
                    :class="{ 'text-weight-bold': count > 0 }"
                  />
                </div>

                <!-- Parser breakdown -->
                <div class="text-subtitle2 q-mb-sm">Results by Parser:</div>
                <div class="row q-gutter-xs">
                  <q-chip
                    v-for="(info, parser) in aggregatedStats.byParser"
                    :key="parser"
                    :color="info.status === 'success' ? 'positive' : 'negative'"
                    text-color="white"
                    :icon="info.status === 'success' ? 'check_circle' : 'error'"
                    :label="`${info.name}: ${info.findings}`"
                    size="sm"
                  />
                </div>
              </q-card-section>
            </q-card>
          </div>
          
          <div class="col-12 col-md-4">
            <q-card bordered class="stats-card">
              <q-card-section class="q-pa-md">
                <div class="text-subtitle1 q-mb-sm">Execution Summary</div>
                <div class="stats-grid">
                  <div class="stat-item">
                    <div class="stat-value">{{ aggregatedStats.executionSummary.totalParsers }}</div>
                    <div class="stat-label">Parsers Executed</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-value text-positive">{{ aggregatedStats.executionSummary.successfulParsers }}</div>
                    <div class="stat-label">Successful</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-value text-negative">{{ aggregatedStats.executionSummary.failedParsers }}</div>
                    <div class="stat-label">Failed</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-value">{{ aggregatedStats.executionSummary.totalFilesProcessed }}</div>
                    <div class="stat-label">Files Processed</div>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <!-- Duplicate Detection -->
        <div v-if="duplicates.length > 0" class="q-mb-lg">
          <q-card bordered class="duplicate-card bg-orange-1">
            <q-card-section>
              <div class="text-subtitle1 q-mb-sm flex items-center">
                <q-icon name="content_copy" color="orange" class="q-mr-sm" />
                Potential Duplicates Detected ({{ duplicates.length }})
              </div>
              <div class="text-body2 text-grey-6 q-mb-md">
                These findings may be similar across different parsers. Review before importing.
              </div>
              
              <div class="duplicate-list">
                <div 
                  v-for="(duplicate, index) in duplicates.slice(0, 3)" 
                  :key="index"
                  class="duplicate-item q-pa-sm"
                >
                  <div class="text-weight-medium">{{ duplicate.original.title }}</div>
                  <div class="text-caption text-grey-6">
                    Found in: {{ duplicate.original.sourceParser }} and {{ duplicate.duplicate.sourceParser }}
                    ({{ Math.round(duplicate.similarity * 100) }}% similar)
                  </div>
                </div>
                
                <div v-if="duplicates.length > 3" class="text-caption text-grey-6 q-mt-sm">
                  +{{ duplicates.length - 3 }} more duplicates...
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Import to Audit Section -->
        <div class="import-section">
          <q-card bordered>
            <q-card-section>
              <div class="text-subtitle1 q-mb-md">Import to Audit</div>
              
              <!-- Audit Selection -->
              <div class="row q-gutter-md q-mb-md">
                <div class="col-12 col-md-6">
                  <q-select
                    v-model="selectedAudit"
                    :options="audits"
                    option-label="name"
                    option-value="id"
                    outlined
                    label="Select Target Audit"
                    :loading="loadingAudits"
                    emit-value
                    map-options
                  >
                    <template v-slot:no-option>
                      <q-item>
                        <q-item-section class="text-grey">
                          {{ loadingAudits ? 'Loading audits...' : 'No audits available' }}
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-select>
                </div>
                
                <div class="col-12 col-md-6">
                  <div class="row q-gutter-sm">
                    <q-btn
                      color="primary"
                      icon="upload"
                      :label="`Import ${selectedFindings.length} Selected`"
                      :loading="importing"
                      :disable="!selectedAudit || selectedFindings.length === 0"
                      @click="handleImport"
                    />
                    <q-btn
                      flat
                      icon="select_all"
                      label="Select All"
                      @click="selectAllFindings"
                    />
                    <q-btn
                      flat
                      icon="deselect"
                      label="Clear"
                      @click="clearSelection"
                    />
                  </div>
                </div>
              </div>

              <!-- Findings Selection List -->
              <div class="findings-list">
                <div class="text-body2 q-mb-sm">
                  Select findings to import ({{ selectedFindings.length }} of {{ aggregatedStats.totalVulnerabilities }} selected):
                </div>
                
                <q-list bordered class="findings-scroll">
                  <q-item
                    v-for="(finding, index) in allFindings.slice(0, 50)"
                    :key="index"
                    class="finding-item"
                  >
                    <q-item-section avatar>
                      <q-checkbox
                        v-model="selectedFindings"
                        :val="finding"
                        dense
                      />
                    </q-item-section>
                    
                    <q-item-section>
                      <q-item-label class="text-weight-medium">
                        {{ finding.title || finding.name }}
                      </q-item-label>
                      <q-item-label caption>
                        <div class="row items-center q-gutter-xs">
                          <q-chip
                            :color="getSeverityColor(finding.severity || finding.risk)"
                            text-color="white"
                            :label="finding.severity || finding.risk || 'Medium'"
                            size="xs"
                          />
                          <q-chip
                            color="grey"
                            text-color="white"
                            :label="finding.sourceParser"
                            size="xs"
                          />
                          <span class="text-grey-6">
                            {{ finding.scope || finding.host || finding.target || 'No scope' }}
                          </span>
                        </div>
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                  
                  <q-item v-if="allFindings.length > 50">
                    <q-item-section>
                      <q-item-label class="text-center text-grey-6">
                        ... and {{ allFindings.length - 50 }} more findings
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- No Results -->
      <div v-else class="text-center q-py-lg text-grey-6">
        <q-icon name="analytics" size="48px" />
        <div class="text-body2 q-mt-md">No parsing results yet. Execute parsers to see findings here.</div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { Notify } from 'quasar'
import { useUnifiedResults } from '../composables/useUnifiedResults'

export default {
  name: 'UnifiedResultsPanel',
  
  props: {
    parseResults: {
      type: Object,
      default: () => ({})
    },
    audits: {
      type: Array,
      default: () => []
    },
    loadingAudits: {
      type: Boolean,
      default: false
    }
  },

  emits: ['import-to-audit'],

  setup(props, { emit }) {
    const { aggregateResults, importing, detectDuplicates } = useUnifiedResults()
    
    // State
    const selectedAudit = ref(null)
    const selectedFindings = ref([])
    const aggregatedStats = ref({})
    const duplicates = ref([])

    // Computed
    const allFindings = computed(() => aggregatedStats.value.allFindings || [])

    // Methods
    const refreshResults = () => {
      if (Object.keys(props.parseResults).length > 0) {
        aggregatedStats.value = aggregateResults()
        duplicates.value = detectDuplicates(allFindings.value)
      }
    }

    const selectAllFindings = () => {
      selectedFindings.value = [...allFindings.value]
    }

    const clearSelection = () => {
      selectedFindings.value = []
    }

    const getSeverityColor = (severity) => {
      const colors = {
        critical: 'red-10',
        high: 'red-6',
        medium: 'orange-6',
        low: 'yellow-6',
        info: 'blue-6',
        none: 'grey-6'
      }
      return colors[(severity || 'medium').toLowerCase()] || 'grey-6'
    }

    const handleImport = async () => {
      if (!selectedAudit.value || selectedFindings.value.length === 0) {
        Notify.create({
          message: 'Please select an audit and at least one finding',
          color: 'warning',
          position: 'top-right'
        })
        return
      }

      const targetAudit = props.audits.find(audit => audit.id === selectedAudit.value)
      if (!targetAudit) {
        Notify.create({
          message: 'Selected audit not found',
          color: 'negative',
          position: 'top-right'
        })
        return
      }

      emit('import-to-audit', selectedFindings.value, targetAudit)
    }

    // Watch for parseResults changes
    watch(() => props.parseResults, refreshResults, { deep: true, immediate: true })

    return {
      // State
      selectedAudit,
      selectedFindings,
      aggregatedStats,
      duplicates,
      importing,
      
      // Computed
      allFindings,
      
      // Methods
      refreshResults,
      selectAllFindings,
      clearSelection,
      getSeverityColor,
      handleImport
    }
  }
}
</script>

<style lang="scss" scoped>
.stats-card {
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.stat-item {
  text-align: center;
  
  .stat-value {
    font-size: 24px;
    font-weight: 600;
    line-height: 1;
  }
  
  .stat-label {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
  }
}

.duplicate-card {
  border-left: 4px solid #ff9800;
}

.duplicate-item {
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
}

.findings-scroll {
  max-height: 400px;
  overflow-y: auto;
}

.finding-item {
  border-bottom: 1px solid #eee;
  
  &:last-child {
    border-bottom: none;
  }
}

.import-section {
  .findings-list {
    max-height: none;
  }
}
</style>
