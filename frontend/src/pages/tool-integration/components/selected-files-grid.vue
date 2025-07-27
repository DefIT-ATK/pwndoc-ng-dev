<template>
  <div v-if="files.length > 0" class="selected-files-grid">
    <div class="flex items-center justify-between q-mb-sm">
      <div class="text-subtitle1">
        Selected Files ({{ files.length }})
      </div>
      <q-btn
        flat
        dense
        color="negative"
        icon="clear_all"
        label="Clear All"
        @click="$emit('clear-all')"
      />
    </div>
    
    <div class="row q-gutter-sm">
      <div 
        v-for="(file, index) in files" 
        :key="file.name"
        class="col-12 col-sm-6 col-md-4 col-lg-3"
      >
        <q-card bordered class="selected-file-card">
          <q-card-section class="q-pa-xs">
            <div class="flex items-center justify-between">
              <div class="text-caption ellipsis q-mr-xs" :title="file.name">
                {{ file.name }}
              </div>
              <q-btn
                flat
                dense
                round
                icon="close"
                color="negative"
                size="xs"
                @click="$emit('remove-file', file)"
              >
                <q-tooltip>Remove file</q-tooltip>
              </q-btn>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'SelectedFilesGrid',
  
  props: {
    files: {
      type: Array,
      required: true
    }
  },
  
  emits: ['clear-all', 'remove-file']
})
</script>

<style lang="scss" scoped>
.selected-file-card {
  transition: transform 0.2s, box-shadow 0.2s;
  min-height: 36px;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

// Text ellipsis for long filenames
.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
