import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {FileBlob,PresentationFile} from '@oai/artifact-tool';
const root=process.cwd();
const skill='C:/Users/91906/.codex/plugins/cache/openai-primary-runtime/presentations/26.1025.11240/skills/presentations';
const ref='C:/Users/91906/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-market-trends-report/assets/reference.pptx';
const p=await PresentationFile.importPptx(await FileBlob.load('.deck-build/expanded.pptx'));
const records=(await p.inspect({kind:'textbox,image',maxChars:1000000})).ndjson.trim().split('\n').map(x=>JSON.parse(x));
function rows(i){return records.filter(x=>x.kind==='textbox'&&x.slideIndex===i)}
function put(r,t){const s=p.resolve(r.id);s.text.replace(r.text,t);}
function content(i,arr){const rs=rows(i).filter(r=>!r.placeholder?.match(/footer|slideNumber/));if(i===7){const tmp=arr[2];arr[2]=arr[3];arr[3]=tmp;}rs.forEach((r,j)=>put(r,arr[j]??''));}
content(0,['Tex Fix\nOperations Report','App experience and courier creation findings','October 2026']);
content(1,['Field operations in one app','Tex Fix presents attendance, stock and courier workflows alongside admin controls.\n\nThe supplied courier logs show a successful creation request, with Sheets synchronization extending the response to 64.5 seconds.','Product and operations']);
content(2,['Courier creation succeeded, with a long wait','28 October 2026 request logs show successful processing. These figures describe one observed request, rather than typical app performance.','64.5s','Total creation request duration','201','Server response: Created','6','Stock updates completed successfully']);
const screens=[
 ['Role-based app access','Technician and admin entry points','The opening screen offers separate technician and admin login options.\n\nTex Fix uses a black and yellow visual identity and credits ASA LABS. This screen establishes the two main user journeys.','WhatsApp Image 2026-10-24 at 2.43.12 PM (2).jpeg'],
 ['Technician daily workflow','Attendance and quick actions','The attendance screen shows check-in as the first daily action. Check-out becomes available after check-in.\n\nQuick actions include profile details, a new sale and courier history. Bottom navigation also exposes stock, complaints and requests.','WhatsApp Image 2026-10-24 at 2.43.12 PM (1).jpeg'],
 ['Admin operations dashboard','Daily oversight and stock tools','The screenshot shows 15 technicians, with zero checked in and zero completed that day. These are values captured in the screenshot.\n\nAdmin tools include attendance records, technician management, stock registration, member locations and spare approvals.','WhatsApp Image 2026-10-24 at 2.43.12 PM (3).jpeg'],
 ['App listing','The listing highlights courier updates','The supplied Google Play screenshot identifies Tex Fix by ASA Lab’s and shows a last-update date of 16 October 2026.\n\nThe release note reads “courier updates.” The visible feedback is private feedback from one user, so it does not establish an overall app rating.','WhatsApp Image 2026-10-24 at 2.43.12 PM.jpeg']
];
for(let k=0;k<4;k++){
 const i=k+3;const [title,sub,body,file]=screens[k];content(i,[title,sub,body]);
 const old=records.find(r=>r.kind==='image'&&r.slideIndex===i);if(old)p.delete(old.id);
 const b=await fs.readFile('C:/Users/91906/Downloads/'+file);
 p.slides.items[i].images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:'image/jpeg',alt:title+' screenshot supplied by user',fit:'contain',position:{left:658.17,top:41.62,width:581.6,height:588.14}});
 p.slides.items[i].speakerNotes.text='Source: user-supplied screenshot, '+file+'. Screenshot values reflect the captured screen, not current operational totals.';
}
content(7,['Courier processing findings','Sheets work dominates the observed delay','Courier COURIER-F087FFF1 completed at 17:10:03 IST with HTTP 201. Sequential stock calls took about 6–7 seconds each.\n\nA second creation POST returned HTTP 200 in 0.91 seconds. The logs do not establish whether it was a retry. No exception or server error appears in the supplied excerpt.','Sheets sync completed','All six stock updates completed','No registered push devices','PDF generation disabled','Courier detail GET returned 200']);
content(8,['Recommended next steps','Background synchronization\nReturn the saved courier promptly, then synchronize Sheets through a durable job queue. Record failures and support retries.','Delivery settings\nConfirm whether courier PDFs and push notifications are required. The observed request skipped both under the logged conditions.','Retry behavior\nVerify that repeated mobile submissions return the same courier and apply each stock deduction only once.','The following proposals address the observed request delay. Client timeout evidence and broader performance measurements are still needed.']);
for(let i=0;i<p.slides.items.length;i++){
 for(const r of rows(i)){
  if(r.placeholder==='footer')put(r,'Tex Fix Operations Report');
  if(r.placeholder==='slideNumber')put(r,String(i+1));
 }
 if(!p.slides.items[i].speakerNotes.text)p.slides.items[i].speakerNotes.text='Sources: user-provided app screenshots dated in filenames 24 October 2026, and pasted server logs for 28 October 2026. Findings concern the supplied evidence only. Recommendations are proposals, not implemented changes.';
 await fs.writeFile(`.deck-build/final-${i+1}.png`,new Uint8Array(await (await p.export({slide:p.slides.items[i],format:'png',scale:1})).arrayBuffer()));
}
await (await PresentationFile.exportPptx(p)).save('.deck-build/candidate.pptx');
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
console.log(await finalizePresentation({workspaceDir:root,candidatePath:path.join(root,'.deck-build/candidate.pptx'),finalPath:path.join(root,'output/Tex-Fix-Operations-Report.pptx'),pythonExecutable:'C:/Users/91906/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],fontPolicy:{basis:'reference',families:['Lora','Roboto'],referencePath:ref,referenceSha256:createHash('sha256').update(await fs.readFile(ref)).digest('hex')},verifyArtifactToolImport:true,receiptPath:path.join(root,'.deck-build/validation.json')}));


