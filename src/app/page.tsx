'use client';
import {useState} from 'react';
import {FileSpreadsheet,UploadCloud,ShieldCheck,Download,AlertTriangle,CheckCircle2,LoaderCircle} from 'lucide-react';
import {readFiles,saveWorkbook} from '../lib/files';
import {reconcileSbi,reconcileRbi,removeExactDuplicates,validateHeaders,SBI_REQUIRED,RBI_REQUIRED,RETAIL_REQUIRED,SBI_HEADERS,type Result,type RecordRow} from '../lib/reconcile';

type Kind='sbi'|'rbi';
const toArray=(f:FileList|null)=>Array.from(f??[]);
function FilePicker({title,description,files,setFiles}:{title:string;description:string;files:File[];setFiles:(f:File[])=>void}){
 return <div className="upload"><div className="upload-title"><UploadCloud size={21}/><div><strong>{title}</strong><p>{description}</p></div></div><label className="file-button">Choose files<input aria-label={title} type="file" accept=".csv,.xlsx" multiple onChange={e=>setFiles([...files,...toArray(e.target.files)])}/></label>{files.length>0&&<div className="files">{files.map((f,i)=><span key={`${f.name}-${i}`}>{f.name}<button aria-label={`Remove ${f.name}`} onClick={()=>setFiles(files.filter((_,j)=>j!==i))}>×</button></span>)}</div>}</div>;
}
export default function Home(){
 const [tab,setTab]=useState<Kind>('sbi');const [sbi,setSbi]=useState<File[]>([]),[rbi,setRbi]=useState<File[]>([]),[retail,setRetail]=useState<File[]>([]);
 const [from,setFrom]=useState('2026-10-01'),[to,setTo]=useState('2026-10-10');
 const [cancelSbi,setCancelSbi]=useState(false),[dedup,setDedup]=useState(true);
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const [result,setResult]=useState<{kind:Kind;result:Result;duplicates:number}|null>(null);
 async function run(){setError('');setResult(null);setBusy(true);
  try {
   const sourceFiles=tab==='sbi'?sbi:rbi;if(!sourceFiles.length||!retail.length)throw new Error('Upload at least one source file and one Retail Sales file.');
   const source=await readFiles(sourceFiles,setStatus),sales=await readFiles(retail,setStatus);
   const problems=[...validateHeaders(source,tab==='sbi'?SBI_REQUIRED:RBI_REQUIRED,tab.toUpperCase()),...validateHeaders(sales,RETAIL_REQUIRED,'Retail Sales')];if(problems.length)throw new Error(problems.join('; '));
   setStatus('Validating and reconciling records...');
   const a=dedup?removeExactDuplicates(source):{rows:source,removed:0};const b=dedup?removeExactDuplicates(sales):{rows:sales,removed:0};
   const output=tab==='sbi'?reconcileSbi(a.rows,b.rows,{from,to,excludeCancelledSbi:cancelSbi}):reconcileRbi(a.rows,b.rows);
   setResult({kind:tab,result:output,duplicates:a.removed+b.removed});setStatus('Completed. Review results and download.');
  }catch(e){setError(e instanceof Error?e.message:String(e));setStatus('');}finally{setBusy(false);}
 }
 async function download(){if(!result)return;setBusy(true);try{
  const {kind,result:r}=result;
  await saveWorkbook(`${kind.toUpperCase()} Console.xlsx`,[
   {name:kind.toUpperCase()+' Console',rows:r.rows,headers:kind==='sbi'?SBI_HEADERS:undefined},
   {name:'Exceptions',rows:r.issues,headers:['workflow','reason','order_id','detail']},
   {name:'Run Summary',rows:Object.entries({...r.stats,duplicatesRemoved:result.duplicates}).map(([metric,value])=>({metric,value})),headers:['metric','value']}
  ]);
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 return <main><header className="top"><div className="brand"><span className="brand-icon"><FileSpreadsheet size={22}/></span><div><strong>Finance Recon</strong><small>SBI & RBI processing workspace</small></div></div><span className="privacy"><ShieldCheck size={16}/> Browser-side processing</span></header>
 <section className="hero"><div className="eyebrow">RECONCILIATION PROTOTYPE</div><h1>From source files to<br/><em>reconciled outputs.</em></h1><p>Combine multiple reports, validate transactions against Retail Sales, and generate a Finance-ready Excel file. Files stay in your browser.</p></section>
 <div className="layout"><section className="main-panel"><div className="tabs"><button className={tab==='sbi'?'active':''} onClick={()=>{setTab('sbi');setResult(null);setError('')}}>SBI reconciliation</button><button className={tab==='rbi'?'active':''} onClick={()=>{setTab('rbi');setResult(null);setError('')}}>RBI reconciliation</button></div>
 <div className="panel-inner"><div className="section-heading"><span className="step">01</span><div><h2>Upload source files</h2><p>Upload one or more files in each category. CSV and XLSX supported.</p></div></div>
 <FilePicker title={tab==='sbi'?'SBI sales inputs':'RBI database inputs'} description="Select multiple exports to consolidate" files={tab==='sbi'?sbi:rbi} setFiles={tab==='sbi'?setSbi:setRbi}/>
 <FilePicker title="Retail Sales inputs" description="Shared order-validation reference files" files={retail} setFiles={setRetail}/>
 <div className="section-heading settings-heading"><span className="step">02</span><div><h2>Processing options</h2><p>Review assumptions before running.</p></div></div>
 {tab==='sbi'&&<div className="date-fields"><label>From date<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To date<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>}
 <label className="check"><input type="checkbox" checked={dedup} onChange={e=>setDedup(e.target.checked)}/><span>Remove exact duplicate rows across uploaded files <small>Preserves different line items and invoices sharing an order ID</small></span></label>
 {tab==='sbi'&&<label className="check"><input type="checkbox" checked={cancelSbi} onChange={e=>setCancelSbi(e.target.checked)}/><span>Exclude SBI orders with only cancelled Retail Sales matches <small>Not yet confirmed by Finance; disabled by default</small></span></label>}
 <div className="rule-note"><AlertTriangle size={17}/><span>{tab==='sbi'?'Zero-copay exclusion is inferred from the historical sample and needs Finance sign-off.':'Return bill amounts are made negative; this convention needs Finance sign-off.'}</span></div>
 <button className="primary" disabled={busy} onClick={run}>{busy?<LoaderCircle className="spin" size={18}/>:<FileSpreadsheet size={18}/>} {busy?'Processing…':`Run ${tab.toUpperCase()} reconciliation`}</button>
 {status&&<p className="status">{status}</p>}{error&&<p className="error" role="alert">{error}</p>}
 </div></section>
 <aside><div className="side-card"><div className="side-title">Workflow overview</div><div className="flow-step"><span>1</span><div><strong>Consolidate</strong><p>Merge all uploaded files by source category</p></div></div><div className="flow-step"><span>2</span><div><strong>Match orders</strong><p>Check against the combined Retail Sales input</p></div></div><div className="flow-step"><span>3</span><div><strong>{tab==='sbi'?'Aggregate':'Validate'}</strong><p>{tab==='sbi'?'Sum GMV and copay by shipment order':'Keep eligible invoices and handle returns'}</p></div></div><div className="flow-step"><span>4</span><div><strong>Export</strong><p>Excel report with exceptions and run summary</p></div></div></div>
 <div className="side-card subtle"><strong>Data handling</strong><p>No uploads to a server. Source files are processed locally in your browser. For large datasets, use a desktop browser with sufficient memory.</p></div>
 {result&&<div className="side-card results"><div className="result-heading"><CheckCircle2 size={19}/><strong>Reconciliation complete</strong></div><div className="metric"><span>Output records</span><strong>{result.result.rows.length.toLocaleString()}</strong></div><div className="metric"><span>Exceptions</span><strong>{result.result.issues.length.toLocaleString()}</strong></div><div className="metric"><span>Exact duplicates removed</span><strong>{result.duplicates.toLocaleString()}</strong></div><button className="download" onClick={download} disabled={busy}><Download size={18}/> Download {result.kind.toUpperCase()} Console.xlsx</button></div>}
 </aside></div><footer>Prototype · Reconstructed rules require Finance approval before production use.</footer></main>;
}
