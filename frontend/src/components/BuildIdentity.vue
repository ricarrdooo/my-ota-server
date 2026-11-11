<script setup>defineProps({item:Object});</script>
<template><strong>{{item.version}}</strong><small :title="item.notes">{{item.notes||'无更新说明'}}</small><small class="artifact-fingerprint" :title="`SHA-256：${item.sha256}；制品：${item.artifact_id||item.id}`">SHA {{item.sha256.slice(0,12)}} · ID {{(item.artifact_id||item.id).slice(0,8)}}</small></template>
