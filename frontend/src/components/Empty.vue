<script setup>defineProps({title:String,description:String});</script>
<template><div class="empty"><div class="empty-symbol">↥</div><h3>{{title}}</h3><p>{{description}}</p><slot/></div></template>
