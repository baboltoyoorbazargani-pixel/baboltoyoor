#!/usr/bin/env python3
import hashlib, shutil, subprocess, sys, zipfile
from pathlib import Path
out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True)
version='1.0.73'
files=sorted(x for x in subprocess.check_output(['git','ls-files','-z']).decode().split('\0') if x and not x.startswith('.github/'))
def add(z,name,data):
    info=zipfile.ZipInfo(name,(2020,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
    z.writestr(info,data,compresslevel=9)
app=out/f'BabolToyor-App-{version}.zip'
with zipfile.ZipFile(app,'w') as z:
    for f in files:add(z,f,Path(f).read_bytes())
cmd=out/f'BabolToyor-Setup-{version}.cmd';shutil.copyfile('windows-installer/BabolToyor-Setup.cmd',cmd)
package=out/f'BabolToyor-Windows-Setup-{version}.zip'
with zipfile.ZipFile(package,'w') as z:
    for src,dst in [(app,'app.zip'),(cmd,'BabolToyor-Setup.cmd'),(Path('windows-installer/README-fa.md'),'README-fa.md'),(Path('windows-installer/INSTALL-STEPS-fa.md'),'INSTALL-STEPS-fa.md'),(Path('windows-installer/INSTALL-STEPS-fa.html'),'INSTALL-STEPS-fa.html')]:add(z,dst,src.read_bytes())
for f in ['domain-https-fa.md','reports-backup-update-fa.md']:shutil.copyfile('docs/'+f,out/f)
assets=[app,cmd,package,out/'domain-https-fa.md',out/'reports-backup-update-fa.md']
(out/f'SHA256SUMS-{version}.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in assets))
for p in [*assets,out/f'SHA256SUMS-{version}.txt']:print(hashlib.sha256(p.read_bytes()).hexdigest(),p.name)
