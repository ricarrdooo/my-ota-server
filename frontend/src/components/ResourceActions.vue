<script setup>
import Action from './Action.vue';
defineProps({kind:String,item:Object});
</script>
<template><Action :kind="'edit-'+kind" :id="item.id">编辑</Action><Action :kind="'delete-'+kind" :id="item.id" tone="danger">删除</Action></template>
