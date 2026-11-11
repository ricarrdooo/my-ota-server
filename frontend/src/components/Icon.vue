<script setup>
import {computed} from 'vue';
const props=defineProps({name:String});
const paths={
 overview:['M3.5 3.5h6v7h-6z','M14.5 3.5h6v4h-6z','M3.5 15.5h6v5h-6z','M14.5 11.5h6v9h-6z'],
 products:['m12 3 9 5-9 5-9-5 9-5Z','m3 12 9 5 9-5','m3 16 9 5 9-5'],
 devices:['M7 3h10v18H7z','M10 6h4','M11 18h2','M3 8v8','M21 8v8'],
 artifacts:['M7 3h7l4 4v14H6V3h1Z','M14 3v5h4','M9 12h6','M9 16h4'],
 releases:['M12 15V3','m7 8 5-5 5 5','M4 14v6h16v-6'],
 attempts:['M4 6h2','M10 6h10','M4 12h2','M10 12h10','M4 18h2','M10 18h10'],
 refresh:['M20 11a8 8 0 0 0-14-5L3 9','M3 3v6h6','M4 13a8 8 0 0 0 14 5l3-3','M15 15h6v6'],
 help:['M9.1 8a3 3 0 0 1 5.8 1c0 2-3 2.4-3 4','M12 17h.01'],
 clock:['M12 8v5l3 2'],
 logout:['M9 4H4v16h5','M10 12h10','m16 8 4 4-4 4'],
 theme:['M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z'],
};
const strokes=computed(()=>paths[props.name]||paths.products);
</script>
<template><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle v-if="name==='help'||name==='clock'" cx="12" cy="12" r="9"/><path v-for="(path,index) in strokes" :key="index" :d="path"/></svg></template>
