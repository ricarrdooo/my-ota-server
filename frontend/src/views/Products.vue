<script setup>
import {computed,inject,ref} from 'vue';
import PageHeader from '../components/PageHeader.vue';import Panel from '../components/Panel.vue';import Empty from '../components/Empty.vue';import Action from '../components/Action.vue';import Badge from '../components/Badge.vue';import Table from '../components/Table.vue';import ResourceActions from '../components/ResourceActions.vue';
import {matches,size} from '../format.js';
const {snapshot}=inject('admin'),query=ref('');
const products=computed(()=>snapshot.value.products.filter(item=>matches(item,query.value,['id','name','description'])));
const targets=computed(()=>snapshot.value.targets.filter(item=>matches(item,query.value,['id','name','product_id','mcu','adapter'])));
const keys=computed(()=>snapshot.value.keys.filter(item=>matches(item,query.value,['id','name','product_id'])));
const productName=id=>snapshot.value.products.find(item=>item.id===id)?.name||id;
</script>
<template>
 <PageHeader title="产品与硬件" description="以产品组织设备，以精确板型校验每一份固件。"><Action kind="product" tone="primary">＋ 新建产品</Action><Action kind="key">添加公钥</Action><Action kind="target">新增硬件型号</Action></PageHeader>
 <div class="resource-toolbar"><div class="search-field"><span>⌕</span><input v-model="query" type="search" placeholder="搜索产品、型号、MCU 或标识" aria-label="搜索产品和硬件"/></div><span class="result-count">{{snapshot.products.length}} 个产品 · {{snapshot.targets.length}} 个型号</span></div>
 <div v-if="products.length" class="product-grid"><div v-for="item in products" :key="item.id" class="product-card"><div class="product-mark"><span>▧</span><Badge>{{snapshot.targets.filter(target=>target.product_id===item.id).length}} 个型号</Badge></div><h3>{{item.name}}</h3><small class="mono muted">{{item.id}}</small><p>{{item.description||'尚未填写产品说明'}}</p><div class="actions"><ResourceActions kind="product" :item="item"/></div></div></div>
 <Panel v-else-if="!snapshot.products.length" title="产品"><Empty title="先建立一个产品" description="例如桌面伴侣或温湿度采集器，再添加公钥和硬件型号。"><Action kind="product" tone="secondary">新建产品</Action></Empty></Panel>
 <Panel title="硬件型号"><Table v-if="targets.length" :columns="['型号 / 标识','产品 / MCU','镜像格式','最大镜像','启动能力','操作']"><tr v-for="item in targets" :key="item.id"><td><strong>{{item.name}}</strong><small>{{item.id}}</small></td><td>{{productName(item.product_id)}}<small>{{item.mcu}} · {{item.hw_revision}}</small></td><td><code>{{item.adapter}}</code></td><td>{{size(item.max_size)}}</td><td><Badge :tone="item.capabilities.includes('rollback')?'green':'amber'">{{item.capabilities.includes('rollback')?'可回滚':'无自动回滚'}}</Badge></td><td><div class="actions"><Action kind="profile" :id="item.id" readonly>导出配置</Action><ResourceActions kind="target" :item="item"/></div></td></tr></Table><Empty v-else :title="query?'没有匹配的硬件型号':'还没有硬件型号'" description="兼容参数保持不可变；芯片、布局或公钥变化时新增型号。"/></Panel>
 <Panel title="签名公钥"><Table v-if="keys.length" :columns="['名称','所属产品','指纹','状态','操作']"><tr v-for="item in keys" :key="item.id"><td><strong>{{item.name}}</strong></td><td>{{productName(item.product_id)}}</td><td class="mono" :title="item.id">{{item.id.slice(0,20)}}…</td><td><Badge :tone="item.revoked?'red':'green'">{{item.revoked?'已吊销':'可用'}}</Badge></td><td><div class="actions"><ResourceActions kind="key" :item="item"/><Action v-if="!item.revoked" kind="revoke-key" :id="item.id" tone="danger">吊销</Action></div></td></tr></Table><Empty v-else :title="query?'没有匹配的签名公钥':'只需添加公钥'" description="签名在本机进行，私钥不会上传服务器。"/></Panel>
</template>
