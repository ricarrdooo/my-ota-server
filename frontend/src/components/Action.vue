<script setup>
import {inject} from 'vue';
defineProps({kind:String,id:{type:String,default:''},tone:{type:String,default:''},disabled:Boolean,readonly:Boolean});
const {ready}=inject('admin');
</script>
<template><button type="button" :data-action="kind" :data-id="id" :class="tone" :disabled="disabled||(!ready&&!readonly)"><slot/></button></template>
