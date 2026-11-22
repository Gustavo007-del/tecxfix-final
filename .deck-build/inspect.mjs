import fs from 'node:fs/promises';
import {FileBlob,PresentationFile} from '@oai/artifact-tool';
const p=await PresentationFile.importPptx(await FileBlob.load('C:/Users/91906/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-market-trends-report/assets/reference.pptx'));
await fs.writeFile('.deck-build/inspect.txt',(await p.inspect({kind:'slide,textbox,shape,image,chart,layout',maxChars:1000000})).ndjson);
for(let i=0;i<p.slides.items.length;i++) {await fs.writeFile(`.deck-build/ref-${i+1}.png`,new Uint8Array(await (await p.export({slide:p.slides.items[i],format:'png',scale:1})).arrayBuffer()));}
console.log('slides',p.slides.items.length);
