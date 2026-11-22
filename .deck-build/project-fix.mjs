import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {FileBlob,PresentationFile} from '@oai/artifact-tool';
process.env.RUNTIME_NODE_MODULES='C:/Users/91906/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const root=process.cwd();
const skill='C:/Users/91906/.codex/plugins/cache/openai-primary-runtime/presentations/26.1025.11240/skills/presentations';
const ref='C:/Users/91906/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-market-trends-report/assets/reference.pptx';
const p=await PresentationFile.importPptx(await FileBlob.load('.deck-build/project-candidate.pptx'));
const rs=(await p.inspect({kind:'textbox',maxChars:1000000})).ndjson.trim().split('\n').map(x=>JSON.parse(x));
const r=rs.find(r=>r.text==='Android app');p.resolve(r.id).text.replace('Android app','Google Play');
await fs.writeFile('.deck-build/project-fixed-7.png',new Uint8Array(await (await p.export({slide:p.slides.items[6],format:'png',scale:1})).arrayBuffer()));
await (await PresentationFile.exportPptx(p)).save('.deck-build/project-fixed.pptx');const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
console.log(await finalizePresentation({workspaceDir:root,candidatePath:path.join(root,'.deck-build/project-fixed.pptx'),finalPath:path.join(root,'output/Tex-Fix-Project.pptx'),pythonExecutable:'C:/Users/91906/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],fontPolicy:{basis:'reference',families:['Lora','Roboto'],referencePath:ref,referenceSha256:createHash('sha256').update(await fs.readFile(ref)).digest('hex')},verifyArtifactToolImport:true,receiptPath:path.join(root,'.deck-build/project-validation.json')}));



