<script setup>defineProps({title:String,description:String});</script>
<template><div class="page-head"><div><h1>{{title}}</h1><p>{{description}}</p></div><div class="head-buttons"><slot/></div></div></template>
