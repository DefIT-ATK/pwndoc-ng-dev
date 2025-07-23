<template>
  <div v-if="visible" class="q-mt-md">
    <q-card>
      <q-card-section class="text-center">
        <q-spinner-hourglass size="40px" color="primary" />
        <div class="text-h6 q-mt-md">{{ title }}</div>
        <div class="text-body2 text-grey-6">{{ subtitle }}</div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import { $t } from '@/boot/i18n'

export default defineComponent({
  name: 'ParsingProgress',

  props: {
    visible: {
      type: Boolean,
      required: true
    },
    tool: {
      type: String,
      required: true,
      validator: (value) => ['nessus', 'pingcastle', 'acunetix'].includes(value)
    }
  },

  computed: {
    title() {
      return $t(`toolIntegration.${this.tool}.parsingFiles`)
    },
    subtitle() {
      return $t('toolIntegration.parsingSubtitle')
    }
  }
})
</script>

<style scoped>
/* Add any parsing progress specific styles here */
</style>
