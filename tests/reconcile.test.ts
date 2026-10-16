import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileSbi,reconcileRbi,removeExactDuplicates} from '../src/lib/reconcile';
test('SBI excludes zero copay, matches retail, aggregates line items',()=>{
 const s=[{shipment_order_id:'P1',created_date:'2026-10-01',order_channel:'retail_offline',gmv:'100',copay_value:'40'},{shipment_order_id:'P1',created_date:'2026-10-01',order_channel:'retail_offline',gmv:'50',copay_value:'20'},{shipment_order_id:'P2',created_date:'2026-10-01',order_channel:'retail_offline',gmv:'10',copay_value:'0'}];
 const r=reconcileSbi(s,[{order_id:'P1',sales_type:'Sales Booked'}],{from:'2026-10-01',to:'2026-10-10'});assert.equal(r.rows.length,1);assert.equal(r.rows[0]['Sum of gmv'],150);assert.equal(r.rows[0]['Sum of copay_value'],60);
});
test('RBI removes unmatched and cancelled; preserves returns',()=>{
 const base={vendor_code:'1MG_MTI_01',order_type:'COT',order_channel:'retail_offline',customer_type:'B2bClient',store_subtype:'retail_store_fc',customer_name:'Reserve Bank Of India(Kolkata)',voucher_type:'return',bill_amount:'25'};
 const r=reconcileRbi([{...base,order_id:'A'},{...base,order_id:'B'},{...base,order_id:'C'}],[{order_id:'A',sales_type:'Sales Booked'},{order_id:'B',sales_type:'cancelled'}]);assert.equal(r.rows.length,1);assert.equal(r.rows[0].bill_amount,-25);assert.equal(r.issues.length,2);
});
test('exact dedup preserves distinct line items',()=>{const r=removeExactDuplicates([{id:'1',sku:'a'},{id:'1',sku:'a'},{id:'1',sku:'b'}]);assert.equal(r.rows.length,2);});
