import zipfile,xml.etree.ElementTree as E,copy
src=r'C:\Users\91906\.codex\plugins\cache\openai-curated-remote\openai-templates\0.1.1\skills\artifact-template-market-trends-report\assets\reference.pptx'
p='http://schemas.openxmlformats.org/presentationml/2006/main';r='http://schemas.openxmlformats.org/officeDocument/2006/relationships';pkg='http://schemas.openxmlformats.org/package/2006/relationships'
with zipfile.ZipFile(src) as z: d={n:z.read(n) for n in z.namelist()}
pres=E.fromstring(d['ppt/presentation.xml']);ids=pres.find('{'+p+'}sldIdLst');rels=E.fromstring(d['ppt/_rels/presentation.xml.rels']);ct=E.fromstring(d['[Content_Types].xml'])
for k in range(7,10):
 d[f'ppt/slides/slide{k}.xml']=d['ppt/slides/slide4.xml'];d[f'ppt/slides/_rels/slide{k}.xml.rels']=d['ppt/slides/_rels/slide4.xml.rels']
 rid=f'rIdScreen{k}';E.SubElement(rels,'{'+pkg+'}Relationship',{'Id':rid,'Type':r+'/slide','Target':f'slides/slide{k}.xml'})
 el=E.Element('{'+p+'}sldId',{'id':str(400+k),'{'+r+'}id':rid});ids.insert(k-3,el)
 E.SubElement(ct,'{http://schemas.openxmlformats.org/package/2006/content-types}Override',{'PartName':f'/ppt/slides/slide{k}.xml','ContentType':'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'})
E.register_namespace('p',p);E.register_namespace('r',r)
for n,v,ns in [('ppt/presentation.xml',pres,p),('ppt/_rels/presentation.xml.rels',rels,pkg),('[Content_Types].xml',ct,'http://schemas.openxmlformats.org/package/2006/content-types')]:
 E.register_namespace('',ns);d[n]=E.tostring(v,encoding='utf-8',xml_declaration=True)
with zipfile.ZipFile('.deck-build/expanded.pptx','w',zipfile.ZIP_DEFLATED) as z:
 for n,b in d.items():z.writestr(n,b)

