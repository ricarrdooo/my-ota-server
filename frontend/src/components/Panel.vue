<script setup>defineProps({title:String});</script>
<template><section class="section"><div class="section-head"><h2>{{title}}</h2><div class="panel-extra"><slot name="extra"/></div></div><slot/></section></template>
