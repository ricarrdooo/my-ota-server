<script setup>
import Table from './Table.vue';
import Badge from './Badge.vue';
import {ref} from 'vue';
import UpgradeTimeline from './UpgradeTimeline.vue';
const selectedTimeline=ref('');
import {taskLabels,taskTone,when} from '../format.js';
defineProps({rows:Array});
</script>
<template><Table :columns="['设备','目标版本','状态 / 进度','更新时间','操作']"><tr v-for="item in rows" :key="item.id"><td><strong>{{item.device_name}}</strong><small>{{item.target_name}}</small></td><td><strong>{{item.version}}</strong><small class="mono">#{{item.id.slice(0,8)}}</small></td><td><Badge :tone="taskTone(item.state)">{{taskLabels[item.state]||item.state}}</Badge><progress max="100" :value="item.progress"/></td><td>{{when(item.updated)}}<small v-if="item.error" :title="item.error">{{item.error}}</small></td><td><button type="button" data-attempt-timeline @click="selectedTimeline=item.id">查看升级时间线</button></td></tr></Table><UpgradeTimeline v-if="selectedTimeline" :key="selectedTimeline" :attempt-id="selectedTimeline" modal @close="selectedTimeline=''"/></template>
