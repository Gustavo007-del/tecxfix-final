import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {FileBlob,PresentationFile} from '@oai/artifact-tool';
process.env.RUNTIME_NODE_MODULES='C:/Users/91906/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const root=process.cwd();
const skill='C:/Users/91906/.codex/plugins/cache/openai-primary-runtime/presentations/26.1025.11240/skills/presentations';
const ref='C:/Users/91906/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-market-trends-report/assets/reference.pptx';
const p=await PresentationFile.importPptx(await FileBlob.load('output/Tex-Fix-Project-Features.pptx'));
const rs=(await p.inspect({kind:'textbox',maxChars:1000000})).ndjson.trim().split('\n').map(x=>JSON.parse(x));
function replace(old,t){const r=rs.find(x=>x.text===old);if(!r)throw Error('Missing '+old);p.resolve(r.id).text.replace(old,t);}
replace('Technician login for daily field tasks.\n\nAdmin login for team management.\n\nSeparate workspaces for each role.','Technician login.\n\nAdmin login.\n\nSeparate workspaces for each role.');
replace('Add and manage technicians.\nReview attendance records.\nTrack technician locations.\nRegister technician stock.\nApprove spare requests.\nManage couriers and sales.','View the team dashboard.\nAdd, edit or remove technicians.\nRegister technician stock.\nReview spare requests.');
replace('Admins can review recorded technician locations.\n\nSelect a technician and date to view movement history.\n\nTracking covers active work sessions when the location service is enabled.','Review movement during active work sessions.\n\nLocation history is available when tracking is enabled.');
replace('Review movement history','Review check-in and check-out');
replace('Check work session details','Check session status');
replace('Record sharing\nShare or save generated files.\nKeep records for review.','File sharing\nSave files to the device.\nShare files for review.');
const slideRecords=(await p.inspect({kind:'slide',maxChars:100000})).ndjson.trim().split('\n').map(x=>JSON.parse(x));
const order=[0,3,4,5,7,8,6].map(i=>slideRecords.find(r=>r.slideIndex===i).id);
p.slides.keep([0,3,4,5,6,7,8]);p.slides.reorder(order);
const after=(await p.inspect({kind:'textbox',maxChars:1000000})).ndjson.trim().split('\n').map(x=>JSON.parse(x));
for(let i=0;i<p.slides.items.length;i++){
 for(const r of after.filter(x=>x.slideIndex===i&&x.placeholder==='slideNumber'))p.resolve(r.id).text.replace(r.text,String(i+1));
 await fs.writeFile(`.deck-build/concise-${i+1}.png`,new Uint8Array(await (await p.export({slide:p.slides.items[i],format:'png',scale:1})).arrayBuffer()));
}
await (await PresentationFile.exportPptx(p)).save('.deck-build/concise-candidate.pptx');
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
console.log(await finalizePresentation({workspaceDir:root,candidatePath:path.join(root,'.deck-build/concise-candidate.pptx'),finalPath:path.join(root,'output/Tex-Fix-Project-Final.pptx'),pythonExecutable:'C:/Users/91906/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],fontPolicy:{basis:'reference',families:['Lora','Roboto'],referencePath:ref,referenceSha256:createHash('sha256').update(await fs.readFile(ref)).digest('hex')},verifyArtifactToolImport:true,receiptPath:path.join(root,'.deck-build/concise-validation.json')}));

