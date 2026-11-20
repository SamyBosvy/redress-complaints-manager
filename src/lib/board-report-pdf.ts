import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { embedPdfFont,PDF_FONT,type PdfFonts } from './pdf-font';
import type { BoardSnapshot,BoardCell } from './board-report';
const cell=(v:BoardCell)=>v===null?'n/a':typeof v==='number'?String(Math.round(v*10)/10):v;
export function boardReportPdf(s:BoardSnapshot,version:number,hash:string,fonts:PdfFonts){
 const doc=new jsPDF({unit:'mm',format:'a4'});embedPdfFont(doc,fonts);
 const heading=(text:string)=>{doc.setFont(PDF_FONT,'bold');doc.setFontSize(17);doc.text(doc.splitTextToSize(text,180),14,22);doc.setFont(PDF_FONT,'normal');};
 const table=(headers:string[],rows:BoardCell[][],y=35)=>autoTable(doc,{head:[headers],body:rows.map(r=>r.map(cell)),startY:y,margin:{top:16,bottom:27,left:14,right:14},styles:{font:PDF_FONT,fontSize:8,cellPadding:3,overflow:'linebreak'},headStyles:{fontStyle:'bold',fillColor:[15,118,110]},rowPageBreak:'avoid'});
 heading('Board management-information pack');doc.setFontSize(22);doc.text(doc.splitTextToSize(s.firm,175),14,55);doc.setFontSize(12);doc.text(doc.splitTextToSize(s.title,175),14,90);doc.text(`${s.range.from} to ${s.range.to} · Version ${version}`,14,115);doc.text('Confidential — prepared for the Board',14,135);
 if(s.logo){try{doc.addImage(s.logo,145,150,40,25,undefined,'FAST');}catch{throw new Error('Could not render the firm logo.');}}
 doc.addPage();heading('Contents');const contentsPage=doc.getNumberOfPages();
 const contents:{title:string;page:number}[]=[];
 doc.addPage();contents.push({title:'Headline figures',page:doc.getNumberOfPages()});heading('Headline figures');table(['Metric','Current','Previous','Change','Year ago','Year change'],s.headlines.map(m=>[`${m.label}${m.unit?` (${m.unit})`:''}`,m.value,m.previous,`${cell(m.change)} (${cell(m.changePct)}%)`,m.yearAgo,`${cell(m.yearChange)} (${cell(m.yearChangePct)}%)`]));
 for(const t of s.tables){doc.addPage();contents.push({title:t.title,page:doc.getNumberOfPages()});heading(t.title);
  let y=35;
  if(t.title.startsWith('Trend')){
   const chart=(column:number,title:string,top:number,percent=false)=>{doc.setFontSize(9);doc.text(title,14,top);const max=percent?100:Math.max(1,...t.rows.map(r=>typeof r[column]==='number'?r[column]:0));doc.setDrawColor(180);doc.line(18,top+40,194,top+40);doc.setFillColor(15,118,110);t.rows.forEach((r,i)=>{const value=r[column];if(typeof value==='number'){const h=value/max*30;doc.rect(22+i*21,top+40-h,10,h,'F');}doc.setFontSize(7);doc.text(String(r[0]),22+i*21,top+45);});};
   chart(1,'Received',35);chart(2,'Resolved',90);chart(3,'Within deadline %',145,true);chart(4,'Uphold rate %',200,true);
   doc.addPage();heading('Trend figures');y=35;
  }
  table(t.headers,t.rows,y);
 }
 doc.addPage();contents.push({title:'Management commentary',page:doc.getNumberOfPages()});heading('Management commentary');table(['Theme','Commentary'],[['Key themes',s.commentary.keyThemes],['Actions taken',s.commentary.actionsTaken],['Actions planned',s.commentary.actionsPlanned]]);
 doc.addPage();contents.push({title:'Methodology',page:doc.getNumberOfPages()});heading('Methodology');table(['Definitions and limitations'],s.methodology.map(v=>[v]));
 doc.setPage(contentsPage);table(['Section','Page'],contents.map(c=>[c.title,c.page]));
 const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont(PDF_FONT,'normal');doc.setFontSize(7);doc.text('Confidential — prepared for the Board',14,278);doc.text(`Page ${i} of ${pages}`,196,278,{align:'right'});doc.setFontSize(6);doc.text(`SHA-256: ${hash}`,14,286);}
 return doc;
}