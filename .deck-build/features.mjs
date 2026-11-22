import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {FileBlob,PresentationFile} from '@oai/artifact-tool';
process.env.RUNTIME_NODE_MODULES='C:/Users/91906/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const root=process.cwd();
const skill='C:/Users/91906/.codex/plugins/cache/openai-primary-runtime/presentations/26.1025.11240/skills/presentations';
const ref='C:/Users/91906/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-market-trends-report/assets/reference.pptx';
const p=await PresentationFile.importPptx(await FileBlob.load('.deck-build/expanded.pptx'));
const records=(await p.inspect({kind:'textbox,image',maxChars:1000000})).ndjson.trim().split('\n').map(x=>JSON.parse(x));
function rows(i){return records.filter(x=>x.kind==='textbox'&&x.slideIndex===i)}
function put(r,t){const s=p.resolve(r.id);s.text.replace(r.text,t);}
function content(i,arr){const rs=rows(i).filter(r=>!r.placeholder?.match(/footer|slideNumber/));if(i===7){const tmp=arr[2];arr[2]=arr[3];arr[3]=tmp;}rs.forEach((r,j)=>put(r,arr[j]??''));}
content(0,['Tex Fix','Field Service Management App','Developed by ASA LABS']);
content(1,['Project overview','One mobile app for field service work.\n\nTechnicians manage daily tasks.\nAdmins monitor the team and operations.','About the project']);
content(2,['Key features','Attendance, technician tracking, stock management, sales and courier records.','Team','Attendance and location tracking','Stock','Stock access and spare approvals','Reports','PDF reports and CSV sheet downloads']);
const screens=[
 ['Login and access','Technician and admin login','Technician login for daily field tasks.\n\nAdmin login for team management.\n\nSeparate workspaces for each role.','WhatsApp Image 2026-10-24 at 2.43.12 PM (2).jpeg'],
 ['Technician workspace','Simple tools for daily work','Check in and check out.\nView profile and stock.\nCreate sales requests.\nView courier history.\nAccess complaints and requests.','WhatsApp Image 2026-10-24 at 2.43.12 PM (1).jpeg'],
 ['Admin dashboard','Manage technicians and operations','Add and manage technicians.\nReview attendance records.\nTrack technician locations.\nRegister technician stock.\nApprove spare requests.\nManage couriers and sales.','WhatsApp Image 2026-10-24 at 2.43.12 PM (3).jpeg'],
 ['Google Play','Tex Fix Android app','Available through Google Play.\n\nView app updates and release notes.\n\nAccess app support.','WhatsApp Image 2026-10-24 at 2.43.12 PM.jpeg']
];
for(let k=0;k<4;k++){
 const i=k+3;const [title,sub,body,file]=screens[k];content(i,[title,sub,body]);
 const old=records.find(r=>r.kind==='image'&&r.slideIndex===i);if(old)p.delete(old.id);
 const b=await fs.readFile('C:/Users/91906/Downloads/'+file);
 p.slides.items[i].images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:'image/jpeg',alt:title+' screenshot supplied by user',fit:'contain',position:{left:658.17,top:41.62,width:581.6,height:588.14}});
 p.slides.items[i].speakerNotes.text='Source: user-supplied screenshot, '+file+'. Screenshot values reflect the captured screen, not current operational totals.';
}
content(7,['Technician location tracking','Admin access to location history','Admins can review recorded technician locations.\n\nSelect a technician and date to view movement history.\n\nTracking covers active work sessions when the location service is enabled.','Select a technician','Choose a date','View recorded locations','Review movement history','Check work session details']);
content(8,['Reports and downloads','PDF reports\nDownload sales reports.\nGenerate courier PDFs.\nDownload approved sales request PDFs.','Record sharing\nShare or save generated files.\nKeep records for review.','Sheet downloads\nExport sales reports as CSV.\nOpen files in Excel or Google Sheets.\nReview data in a spreadsheet.','Download records for reporting and follow-up.']);
for(let i=0;i<p.slides.items.length;i++){
 for(const r of rows(i)){
  if(r.placeholder==='footer')put(r,'Tex Fix Project Presentation');
  if(r.placeholder==='slideNumber')put(r,String(i+1));
 }
 if(!p.slides.items[i].speakerNotes.text)p.slides.items[i].speakerNotes.text='Sources: user-supplied screenshots and local project code. Location tracking: backend/technician_tracking/views.py, admin_member_locations. Exports: techfix-app/src/screens/AdminSalesRequestScreen.js and src/utils/SalesReportExcelGenerator.js, SalesReportPDFGenerator.js, AdminCourierPDFGenerator.js, SalesRequestPDFGenerator.js. Spreadsheet export uses CSV. Location service availability depends on configuration.';
 await fs.writeFile(`.deck-build/features-${i+1}.png`,new Uint8Array(await (await p.export({slide:p.slides.items[i],format:'png',scale:1})).arrayBuffer()));
}
await (await PresentationFile.exportPptx(p)).save('.deck-build/features-candidate.pptx');
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
console.log(await finalizePresentation({workspaceDir:root,candidatePath:path.join(root,'.deck-build/features-candidate.pptx'),finalPath:path.join(root,'output/Tex-Fix-Project-Features.pptx'),pythonExecutable:'C:/Users/91906/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],fontPolicy:{basis:'reference',families:['Lora','Roboto'],referencePath:ref,referenceSha256:createHash('sha256').update(await fs.readFile(ref)).digest('hex')},verifyArtifactToolImport:true,receiptPath:path.join(root,'.deck-build/features-validation.json')}));


