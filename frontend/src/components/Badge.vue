<script setup>
defineProps({tone:{type:String,default:''}});
</script>
<template><span class="badge" :class="tone"><slot/></span></template>
