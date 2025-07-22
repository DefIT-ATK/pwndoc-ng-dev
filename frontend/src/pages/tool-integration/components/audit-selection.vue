<template>
  <div v-if="audits.length > 0" class="q-mt-md">
    <div class="text-subtitle1 q-mb-sm">{{ $t('toolIntegration.auditSelection.title') }}</div>
    <div class="row q-gutter-md">
      <div class="col-12 col-md-6">
        <q-select
          :model-value="selectedAudit"
          @update:model-value="$emit('update:selectedAudit', $event)"
          :options="audits"
          :label="$t('toolIntegration.auditSelection.selectAudit')"
          outlined
          emit-value
          map-options
          :loading="loading"
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
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'AuditSelection',
  
  props: {
    audits: {
      type: Array,
      required: true
    },
    selectedAudit: {
      type: String,
      default: null
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  
  emits: ['update:selectedAudit']
})
</script>
