<script setup>defineProps({columns:Array,kind:{type:String,default:''}});</script>
<template><div class="table-wrap management-table" :class="kind"><table><thead><tr><th v-for="column in columns" :key="column">{{column}}</th></tr></thead><tbody><slot/></tbody></table></div></template>
