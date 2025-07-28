<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-subtitle1 q-mb-md flex items-center">
        <q-icon name="play_arrow" class="q-mr-sm" />
        Parser Execution
        <q-space />
        <q-chip 
          v-if="totalAvailableParsers > 0"
          :label="`${totalAvailableParsers} parsers available`"
          color="primary"
          text-color="white"
          icon="extension"
        />
      </div>

      <!-- No parsers available -->
      <div v-if="totalAvailableParsers === 0" class="text-center q-py-lg text-grey-6">
        <q-icon name="extension" size="48px" />
        <div class="text-body2 q-mt-md">No parsers available. Upload and classify files first.</div>
      </div>

      <!-- Available parsers -->
      <div v-else>
        <!-- Execution controls -->
        <div class="row q-gutter-md q-mb-md">
          <div class="col-auto">
            <q-btn
              color="primary"
              icon="play_arrow"
              :label="`Execute All (${selectedParsers.length})`"
              :loading="executing"
              :disable="selectedParsers.length === 0"
              @click="executeSelectedParsers"
            />
          </div>
          <div class="col-auto">
            <q-btn
              flat
              icon="select_all"
              label="Select All"
              @click="selectAllParsers"
              :disable="executing"
            />
          </div>
          <div class="col-auto">
            <q-btn
              flat
              icon="deselect"
              label="Clear Selection"
              @click="clearSelection"
              :disable="executing"
            />
          </div>
        </div>

        <!-- Parser list -->
        <div class="row q-col-gutter-md">
          <div 
            v-for="(parser, parserType) in availableParsers" 
            :key="parserType"
            class="col-12 col-md-6 col-lg-4"
          >
            <q-card 
              bordered 
              class="parser-card"
              :class="{
                'parser-selected': selectedParsers.includes(parserType),
                'parser-executing': executionProgress[parserType]?.status === 'running',
                'parser-completed': executionProgress[parserType]?.status === 'completed',
                'parser-error': executionProgress[parserType]?.status === 'error'
              }"
            >
              <q-card-section class="q-pa-md">
                <!-- Parser header -->
                <div class="flex items-center justify-between q-mb-sm">
                  <div class="flex items-center">
                    <q-checkbox
                      v-model="selectedParsers"
                      :val="parserType"
                      :disable="executing"
                      class="q-mr-sm"
                    />
                    <q-icon 
                      :name="getParserIcon(parserType)" 
                      :color="getParserColor(parserType)"
                      size="24px" 
                      class="q-mr-sm"
                    />
                    <div>
                      <div class="text-weight-medium">{{ getParserName(parserType) }}</div>
                      <div class="text-caption text-grey-6">
                        {{ parser.fileCount }} file{{ parser.fileCount > 1 ? 's' : '' }} ready
                      </div>
                    </div>
                  </div>
                  
                  <!-- Individual execute button -->
                  <q-btn
                    flat
                    dense
                    round
                    icon="play_arrow"
                    color="primary"
                    size="sm"
                    :loading="executionProgress[parserType]?.status === 'running'"
                    :disable="executing && executionProgress[parserType]?.status !== 'running'"
                    @click="executeSingleParser(parserType)"
                  >
                    <q-tooltip>Execute this parser</q-tooltip>
                  </q-btn>
                </div>

                <!-- Execution progress -->
                <div v-if="executionProgress[parserType]" class="q-mt-sm">
                  <!-- Progress bar -->
                  <q-linear-progress 
                    :value="executionProgress[parserType].progress / 100"
                    :color="getProgressColor(executionProgress[parserType].status)"
                    size="6px"
                    class="q-mb-xs"
                  />
                  
                  <!-- Status message -->
                  <div class="text-caption flex items-center">
                    <q-icon 
                      :name="getStatusIcon(executionProgress[parserType].status)"
                      :color="getProgressColor(executionProgress[parserType].status)"
                      size="14px"
                      class="q-mr-xs"
                    />
                    {{ executionProgress[parserType].message }}
                  </div>
                </div>

                <!-- File list preview -->
                <div v-if="!executionProgress[parserType] || executionProgress[parserType].status === 'pending'" class="q-mt-sm">
                  <div class="text-caption text-grey-6 q-mb-xs">Files to process:</div>
                  <div class="file-list">
                    <div 
                      v-for="(file, index) in parser.files.slice(0, 2)" 
                      :key="index"
                      class="text-caption ellipsis"
                      :title="file.file ? file.file.name : file.name"
                    >
                      <q-icon name="description" size="12px" class="q-mr-xs" />
                      {{ file.file ? file.file.name : file.name }}
                    </div>
                    <div v-if="parser.files.length > 2" class="text-caption text-grey-5">
                      +{{ parser.files.length - 2 }} more...
                    </div>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <!-- Overall execution progress -->
        <div v-if="executing && Object.keys(executionProgress).length > 0" class="q-mt-lg">
          <q-card flat bordered class="bg-blue-1">
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm flex items-center">
                <q-spinner size="20px" color="primary" class="q-mr-sm" />
                Execution Progress
              </div>
              
              <div class="row q-gutter-sm">
                <q-chip
                  v-for="(progress, parserType) in executionProgress"
                  :key="parserType"
                  :color="getProgressColor(progress.status)"
                  text-color="white"
                  :icon="getStatusIcon(progress.status)"
                  :label="`${getParserName(parserType)}: ${progress.status}`"
                  size="sm"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  name: 'ParserExecutionPanel',
  
  props: {
    availableParsers: {
      type: Object,
      default: () => ({})
    },
    executing: {
      type: Boolean,
      default: false
    },
    executionProgress: {
      type: Object,
      default: () => ({})
    }
  },

  emits: ['execute-parsers', 'execute-single-parser'],

  setup(props, { emit }) {
    const selectedParsers = ref([])

    // Computed properties
    const totalAvailableParsers = computed(() => Object.keys(props.availableParsers).length)

    // Helper functions
    const getParserName = (type) => {
      const names = {
        nessus: 'Nessus',
        pingcastle: 'PingCastle',
        purpleknight: 'PurpleKnight',
        acunetix: 'Acunetix',
        powerupsql: 'PowerUpSQL',
        custom: 'Custom Parsers'
      }
      return names[type] || type
    }

    const getParserIcon = (type) => {
      const icons = {
        nessus: 'security',
        pingcastle: 'domain',
        purpleknight: 'shield',
        acunetix: 'web',
        powerupsql: 'storage',
        custom: 'extension'
      }
      return icons[type] || 'description'
    }

    const getParserColor = (type) => {
      const colors = {
        nessus: 'deep-orange',
        pingcastle: 'blue',
        purpleknight: 'purple',
        acunetix: 'indigo',
        powerupsql: 'pink',
        custom: 'teal'
      }
      return colors[type] || 'grey'
    }

    const getProgressColor = (status) => {
      const colors = {
        pending: 'grey',
        running: 'primary',
        completed: 'positive',
        error: 'negative'
      }
      return colors[status] || 'grey'
    }

    const getStatusIcon = (status) => {
      const icons = {
        pending: 'schedule',
        running: 'play_arrow',
        completed: 'check_circle',
        error: 'error'
      }
      return icons[status] || 'help'
    }

    // Selection methods
    const selectAllParsers = () => {
      selectedParsers.value = Object.keys(props.availableParsers)
    }

    const clearSelection = () => {
      selectedParsers.value = []
    }

    // Execution methods
    const executeSelectedParsers = () => {
      if (selectedParsers.value.length > 0) {
        emit('execute-parsers', [...selectedParsers.value])
      }
    }

    const executeSingleParser = (parserType) => {
      emit('execute-single-parser', parserType)
    }

    // Auto-select all parsers when they become available
    const autoSelectParsers = () => {
      if (totalAvailableParsers.value > 0 && selectedParsers.value.length === 0) {
        selectAllParsers()
      }
    }

    // Watch for available parsers changes
    const { watch } = require('vue')
    watch(() => props.availableParsers, autoSelectParsers, { immediate: true })

    return {
      // State
      selectedParsers,
      
      // Computed
      totalAvailableParsers,
      
      // Methods
      getParserName,
      getParserIcon,
      getParserColor,
      getProgressColor,
      getStatusIcon,
      selectAllParsers,
      clearSelection,
      executeSelectedParsers,
      executeSingleParser
    }
  }
}
</script>

<style lang="scss" scoped>
.parser-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  &.parser-selected {
    border-color: var(--q-primary);
    background: rgba(25, 118, 210, 0.05);
  }
  
  &.parser-executing {
    border-color: var(--q-primary);
    background: rgba(25, 118, 210, 0.1);
  }
  
  &.parser-completed {
    border-color: var(--q-positive);
    background: rgba(76, 175, 80, 0.05);
  }
  
  &.parser-error {
    border-color: var(--q-negative);
    background: rgba(244, 67, 54, 0.05);
  }
}

.file-list {
  max-height: 60px;
  overflow-y: auto;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
