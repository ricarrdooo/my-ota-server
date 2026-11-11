<script setup>
import {computed} from 'vue';
import Badge from './Badge.vue';
import {fileStates} from '../format.js';
const props=defineProps({item:Object,release:Boolean});
const state=computed(()=>props.item.firmware_state||(props.item.pruned_at?'deleted':'unknown'));
const label=computed(()=>fileStates[state.value]||fileStates.unknown);
</script>
<template><div class="status-stack"><Badge v-if="release" :tone="item.active?'green':''">{{item.active?'活动发布':'已撤回 / 已替代'}}</Badge><span class="firmware-status" :data-firmware-state="state" :title="item.firmware_message"><Badge :tone="label[1]">{{label[0]}}</Badge></span><small v-if="release">{{item.attempt_count?`含 ${item.attempt_count} 条升级记录`:'暂无升级记录'}}</small><small v-if="item.deletion_pending">文件待释放，可重试删除</small><small v-if="item.key_revoked">签名公钥已吊销</small></div></template>
