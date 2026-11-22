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
content(1,['Project overview','Tex Fix brings everyday field service work into one mobile app.\n\nTechnicians can record attendance and access stock, sales and courier history. Admins can manage the team and oversee daily operations.','About the project']);
content(2,['Key features','One app supports daily field work and gives administrators access to operational records.','Team','Attendance, technician profiles and member locations','Stock','Technician stock registration and spare approvals','Courier','Courier management and delivery history']);
const screens=[
 ['Login and access','Separate entry points for each role','Technician login provides access to daily field tasks.\n\nAdmin login opens the tools used to manage technicians, attendance, stock and courier operations.','WhatsApp Image 2026-10-24 at 2.43.12 PM (2).jpeg'],
 ['Technician workspace','Daily tasks in one place','Check in to start the day and check out when work ends.\n\nAccess personal details, create a sale and view courier history. Navigation also includes stock, complaints and requests.','WhatsApp Image 2026-10-24 at 2.43.12 PM (1).jpeg'],
 ['Admin dashboard','Tools to manage field operations','View technician and daily attendance summaries from the dashboard.\n\nManage technicians, review attendance records, register technician stock, view member locations and approve spare requests.','WhatsApp Image 2026-10-24 at 2.43.12 PM (3).jpeg'],
 ['Android app','Tex Fix on Google Play','The Google Play listing presents Tex Fix as a field service management app by ASA Lab’s.\n\nUsers can open the installed app, check release notes and access app support from the listing.','WhatsApp Image 2026-10-24 at 2.43.12 PM.jpeg']
];
for(let k=0;k<4;k++){
 const i=k+3;const [title,sub,body,file]=screens[k];content(i,[title,sub,body]);
 const old=records.find(r=>r.kind==='image'&&r.slideIndex===i);if(old)p.delete(old.id);
 const b=await fs.readFile('C:/Users/91906/Downloads/'+file);
 p.slides.items[i].images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:'image/jpeg',alt:title+' screenshot supplied by user',fit:'contain',position:{left:658.17,top:41.62,width:581.6,height:588.14}});
 p.slides.items[i].speakerNotes.text='Source: user-supplied screenshot, '+file+'. Screenshot values reflect the captured screen, not current operational totals.';
}
content(7,['Stock and courier management','Support for parts and delivery workflows','Tex Fix connects stock tools with technician and courier workflows.\n\nAdmins can register technician stock and review spare requests. Courier management and history help users keep track of courier records.','Technician stock access','Stock sheet registration','Spare request approvals','Courier management','Courier history']);
content(8,['Project benefits','For technicians\nA single workspace for attendance and common daily tasks. Quick access to stock, sales and courier history.','For operations\nStock and courier tools sit alongside daily team workflows in the same app.','For administrators\nA central dashboard provides access to attendance records, technician management and spare approvals.','Tex Fix brings field tasks and administrative tools together in a mobile application.']);
for(let i=0;i<p.slides.items.length;i++){
 for(const r of rows(i)){
  if(r.placeholder==='footer')put(r,'Tex Fix Project Presentation');
  if(r.placeholder==='slideNumber')put(r,String(i+1));
 }
 if(!p.slides.items[i].speakerNotes.text)p.slides.items[i].speakerNotes.text='Source: user-provided Tex Fix app screenshots. Feature descriptions reflect the visible navigation and tools. Benefits describe the intended project value.';
 await fs.writeFile(`.deck-build/project-${i+1}.png`,new Uint8Array(await (await p.export({slide:p.slides.items[i],format:'png',scale:1})).arrayBuffer()));
}
await (await PresentationFile.exportPptx(p)).save('.deck-build/project-candidate.pptx');
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
console.log(await finalizePresentation({workspaceDir:root,candidatePath:path.join(root,'.deck-build/project-candidate.pptx'),finalPath:path.join(root,'output/Tex-Fix-Project-Presentation.pptx'),pythonExecutable:'C:/Users/91906/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],fontPolicy:{basis:'reference',families:['Lora','Roboto'],referencePath:ref,referenceSha256:createHash('sha256').update(await fs.readFile(ref)).digest('hex')},verifyArtifactToolImport:true,receiptPath:path.join(root,'.deck-build/project-validation.json')}));


