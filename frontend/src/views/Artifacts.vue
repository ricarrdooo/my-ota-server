<script setup>
import {computed,inject,ref} from 'vue';
import PageHeader from '../components/PageHeader.vue';import Panel from '../components/Panel.vue';import Empty from '../components/Empty.vue';import Action from '../components/Action.vue';import Table from '../components/Table.vue';import BuildIdentity from '../components/BuildIdentity.vue';import FileStatus from '../components/FileStatus.vue';import {matches,size} from '../format.js';
const {snapshot}=inject('admin'),query=ref(''),filter=ref('');
const rows=computed(()=>snapshot.value.artifacts.filter(item=>matches(item,query.value,['id','version','notes','sha256','target_name'])&&(!filter.value||item.firmware_state===filter.value)));
</script>
<template>
 <PageHeader title="固件文件" description="本机打包签名，以摘要区分每一份构建。"><Action kind="pack" tone="primary">＋ 打包并上传</Action></PageHeader>
 <div class="management-summary"><span><strong>{{snapshot.artifacts.length}}</strong> 份固件 · {{snapshot.overview.storage_warning?'已知占用':'当前占用'}} <strong>{{size(snapshot.overview.storage_bytes)}}</strong><span v-if="snapshot.overview.storage_warning">（统计不完整，请检查存储权限）</span></span><span>手动管理 · 不自动清理</span></div>
 <Panel title="固件库"><template #extra><span class="panel-note">私钥留在本机，服务器独立复核</span></template><div class="resource-toolbar in-panel"><div class="search-field"><span>⌕</span><input v-model="query" type="search" placeholder="搜索版本、型号、SHA 或说明" aria-label="搜索固件"/></div><select v-model="filter" class="filter-select" aria-label="固件状态"><option value="">全部状态</option><option value="available">文件可用</option><option value="missing">文件缺失</option><option value="corrupt">校验异常</option><option value="storage_error">存储不可读</option></select><span class="result-count">{{rows.length}} 项结果</span></div>
 <Table v-if="rows.length" :columns="['版本 / 构建','硬件型号','文件大小','状态','操作']" kind="artifact-table"><tr v-for="item in rows" :key="item.id" :data-artifact-id="item.id"><td class="release-identity"><BuildIdentity :item="item"/></td><td>{{item.target_name}}</td><td>{{size(item.size)}}</td><td class="release-status"><FileStatus :item="item"/></td><td><div class="actions release-actions"><Action v-if="item.can_publish" kind="publish" :id="item.id">发布此固件</Action><Action kind="delete-artifact" :id="item.id" tone="danger">{{item.deletion_pending?'重试删除文件':'删除此固件'}}</Action></div></td></tr></Table>
 <Empty v-else :title="query||filter?'没有匹配的固件':'固件库还是空的'" description="选择设备和应用 bin，写下更新说明即可打包。"><button v-if="query||filter" @click="query='';filter=''">清空筛选</button><Action v-else kind="pack" tone="secondary">打包并上传</Action></Empty></Panel>
</template>
