import hashlib, subprocess, shutil, zipfile
from pathlib import Path
version='1.0.64';out=Path('/tmp/babol-release-64');out.mkdir(parents=True,exist_ok=True)
def add(z,name,data):
 info=zipfile.ZipInfo(name,(2020,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
 z.writestr(info,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
tracked=subprocess.check_output(['git','ls-files','-z']).decode().split('\0');app=out/f'BabolToyor-App-{version}.zip'
with zipfile.ZipFile(app,'w') as z:
 for name in sorted(x for x in tracked if x and not x.startswith('.github/')):add(z,name,Path(name).read_bytes())
cmd=out/f'BabolToyor-Setup-{version}.cmd';shutil.copyfile('windows-installer/BabolToyor-Setup.cmd',cmd);windows=out/f'BabolToyor-Windows-Setup-{version}.zip'
with zipfile.ZipFile(windows,'w') as z:
 add(z,'app.zip',app.read_bytes());add(z,'BabolToyor-Setup.cmd',cmd.read_bytes())
 for name in ['INSTALL-STEPS-fa.md','INSTALL-STEPS-fa.html','README-fa.md']:add(z,name,Path('windows-installer',name).read_bytes())
for name in ['domain-https-fa.md','reports-backup-update-fa.md']:shutil.copyfile(Path('docs',name),out/name)
files=[app,cmd,windows,out/'domain-https-fa.md',out/'reports-backup-update-fa.md']
(out/f'SHA256SUMS-{version}.txt').write_text(''.join(f'{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.name}\n' for f in files))
for f in [*files,out/f'SHA256SUMS-{version}.txt']:print(hashlib.sha256(f.read_bytes()).hexdigest(),f.name,f.stat().st_size)
