export type RecordRow = Record<string, string | number | null | undefined>;
export type Issue = { workflow: 'SBI' | 'RBI' | 'Input'; reason: string; order_id: string; detail?: string };
export type Options = { from?: string; to?: string; excludeCancelledSbi?: boolean; excludeExactDuplicates?: boolean };
export type Result = { rows: RecordRow[]; issues: Issue[]; stats: Record<string, number> };

export const SBI_HEADERS = ['shipment_order_id','created_date','Sum of gmv','Sum of copay_value'];
export const RBI_REMOVE = new Set(['Name','Code','Type']);
export const RBI_STORES = new Set(['1MG_MTI_01','1MGR_JWN_02']);
export const SBI_REQUIRED = ['shipment_order_id','created_date','order_channel','copay_value','gmv'];
export const RBI_REQUIRED = ['order_id','vendor_code','voucher_type','bill_amount','order_type','order_channel','customer_type','store_subtype','customer_name'];
export const RETAIL_REQUIRED = ['order_id','sales_type'];
export const normalize = (v: unknown) => String(v ?? '').trim();
const lower = (v: unknown) => normalize(v).toLowerCase();
export const numberValue = (v: unknown) => { const n = Number(normalize(v).replace(/,/g,'')); return Number.isFinite(n) ? n : 0; };
export const dateOnly = (v: unknown): string => {
 const s = normalize(v); if (!s) return '';
 const iso = s.match(/^(\d{4})-(\d\d)-(\d\d)/); if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
 const short = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
 if (short) { const m = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(short[2].toLowerCase()); if(m>=0) return `${Number(short[3])<100?'20'+short[3]:short[3]}-${String(m+1).padStart(2,'0')}-${short[1].padStart(2,'0')}`; }
 return '';
};
const outputDate = (date: string) => { const [y,m,d] = date.split('-'); const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m)-1]; return `${d}-${month}-${y.slice(-2)}`; };
export function validateHeaders(rows: RecordRow[], required: string[], label: string): string[] {
 if (!rows.length) return [`${label}: no records loaded`];
 const names = new Set(Object.keys(rows[0]).map(x=>x.trim()));
 return required.filter(h=>!names.has(h)).map(h=>`${label}: missing column ${h}`);
}
export function removeExactDuplicates(rows: RecordRow[]): {rows:RecordRow[],removed:number} {
 const seen=new Set<string>(); const out:RecordRow[]=[];
 for(const r of rows) { const k=JSON.stringify(Object.entries(r).sort(([a],[b])=>a.localeCompare(b))); if(seen.has(k))continue; seen.add(k);out.push(r); }
 return {rows:out,removed:rows.length-out.length};
}
export function buildRetailIndex(rows: RecordRow[]) {
 const idx=new Map<string, RecordRow[]>();
 for(const r of rows) for(const k of new Set([normalize(r.order_id),normalize(r.group_id)].filter(Boolean))) {
  if(!idx.has(k)) idx.set(k,[]); idx.get(k)!.push(r);
 }
 return idx;
}
function retailStatus(index: Map<string,RecordRow[]>, id:string): 'missing'|'cancelled'|'eligible' {
 const matches=index.get(id)??[]; if(!matches.length)return 'missing';
 return matches.some(r=>!['cancelled','canceled'].includes(lower(r.sales_type)))?'eligible':'cancelled';
}
export function reconcileSbi(input:RecordRow[], retail:RecordRow[], opts:Options={}):Result {
 const issues:Issue[]=[];const index=buildRetailIndex(retail);const grouped=new Map<string,{date:string,gmv:number,copay:number}>();
 let filtered=0;
 for(const r of input) {
  const date=dateOnly(r.created_date); const id=normalize(r.shipment_order_id);
  if(lower(r.order_channel)!=='retail_offline'||!id||numberValue(r.copay_value)===0||!date||(opts.from&&date<opts.from)||(opts.to&&date>opts.to))continue;
  filtered++;
  const current=grouped.get(id)??{date,gmv:0,copay:0};
  if(current.date!==date)issues.push({workflow:'SBI',reason:'Conflicting created dates',order_id:id,detail:`${current.date} vs ${date}`});
  current.gmv+=numberValue(r.gmv);current.copay+=numberValue(r.copay_value);grouped.set(id,current);
 }
 const rows:RecordRow[]=[];
 for(const [id,g] of grouped) {
  const status=retailStatus(index,id);
  if(status==='missing'||(opts.excludeCancelledSbi&&status==='cancelled')) {issues.push({workflow:'SBI',reason:status==='missing'?'Not found in Retail Sales':'Cancelled in Retail Sales',order_id:id});continue;}
  if(status==='cancelled')issues.push({workflow:'SBI',reason:'Matched only cancelled retail rows (review)',order_id:id});
  rows.push({shipment_order_id:id,created_date:outputDate(g.date),'Sum of gmv':g.gmv,'Sum of copay_value':g.copay});
 }
 rows.sort((a,b)=>String(a.created_date).localeCompare(String(b.created_date))||String(a.shipment_order_id).localeCompare(String(b.shipment_order_id)));
 return {rows,issues,stats:{inputRows:input.length,filteredRows:filtered,groupedOrders:grouped.size,outputRows:rows.length,excludedOrders:grouped.size-rows.length}};
}
export function reconcileRbi(input:RecordRow[], retail:RecordRow[]):Result {
 const issues:Issue[]=[];const index=buildRetailIndex(retail);const rows:RecordRow[]=[];let candidates=0;
 for(const r of input) {
  if(lower(r.order_type)!=='cot'||lower(r.order_channel)!=='retail_offline'||lower(r.customer_type)!=='b2bclient'||lower(r.store_subtype)!=='retail_store_fc'||!RBI_STORES.has(normalize(r.vendor_code))||!lower(r.customer_name).includes('reserve bank of india'))continue;
  candidates++;
  const id=normalize(r.order_id), status=retailStatus(index,id);
  if(status!=='eligible') {issues.push({workflow:'RBI',reason:status==='missing'?'Not found in Retail Sales':'Cancelled in Retail Sales',order_id:id,detail:normalize(r.invoice_number)});continue;}
  const clean:RecordRow={};for(const [k,v] of Object.entries(r))if(!RBI_REMOVE.has(k))clean[k]=v;
  const bill=numberValue(r.bill_amount);
  clean.bill_amount=lower(r.voucher_type)==='return'?-Math.abs(bill):bill;
  rows.push(clean);
 }
 return {rows,issues,stats:{inputRows:input.length,candidates,outputRows:rows.length,excludedRows:candidates-rows.length}};
}
