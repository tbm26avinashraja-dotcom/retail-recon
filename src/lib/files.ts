'use client';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import type {RecordRow} from './reconcile';

export async function readFiles(files:File[], progress?:(s:string)=>void):Promise<RecordRow[]> {
 const result:RecordRow[]=[];
 for(let i=0;i<files.length;i++) {
  const file=files[i]; progress?.(`Reading ${i+1}/${files.length}: ${file.name}`);
  const ext=file.name.split('.').pop()?.toLowerCase();
  if(ext==='csv') {
   await new Promise<void>((resolve,reject)=> {
    Papa.parse<Record<string,string>>(file,{header:true,skipEmptyLines:'greedy',worker:true,chunkSize:1024*1024,
     chunk:(part)=>{for(const row of part.data) result.push(row);},complete:()=>resolve(),error:(e)=>reject(e)});
   });
  } else if(ext==='xlsx') {
   const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer() as never);
   const ws=wb.worksheets[0];if(!ws)throw new Error(`${file.name}: no worksheet`);
   const header=(ws.getRow(1).values as unknown[]).slice(1).map(x=>String(x??'').trim());
   ws.eachRow((row,n)=>{if(n===1)return;const record:RecordRow={};let has=false;
    header.forEach((h,j)=>{if(!h)return;const v=row.getCell(j+1).value;let val:unknown=v;
     if(v instanceof Date)val=v.toISOString().slice(0,10);
     else if(v&&typeof v==='object'&&'result' in v)val=(v as {result:unknown}).result;
     else if(v&&typeof v==='object'&&'text' in v)val=(v as {text:unknown}).text;
     record[h]=typeof val==='number'?val:String(val??'');if(val!==null&&val!==undefined&&val!=='')has=true;});
    if(has)result.push(record);
   });
  } else throw new Error(`Unsupported file: ${file.name}. Use CSV or XLSX.`);
 }
 return result;
}
export async function saveWorkbook(filename:string, data:{name:string;rows:RecordRow[];headers?:string[]}[]) {
 const workbook=new ExcelJS.Workbook();workbook.creator='Finance Recon Prototype';
 for(const item of data) {
  const ws=workbook.addWorksheet(item.name.slice(0,31));
  const headers=item.headers??Object.keys(item.rows[0]??{});
  ws.addRow(headers);
  for(const r of item.rows) ws.addRow(headers.map(k=>r[k]??''));
  ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17324D'}};
  ws.views=[{state:'frozen',ySplit:1}];ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,item.rows.length+1),column:Math.max(1,headers.length)}};
  headers.forEach((h,i)=>{ws.getColumn(i+1).width=Math.min(32,Math.max(15,h.length+3));});
 }
 const bytes=await workbook.xlsx.writeBuffer();
 const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);
}
