#!/usr/bin/env python3
"""Build versioned Babol Toyor GitHub Release assets from a clean source checkout."""

from __future__ import annotations

import argparse
import hashlib
import shutil
import subprocess
import zipfile
from pathlib import Path


def add_file(archive: zipfile.ZipFile, name: str, data: bytes) -> None:
    info = zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    archive.writestr(info, data, compresslevel=9)


def make_zip(path: Path, entries: list[tuple[str, bytes | Path]]) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        for name, source in entries:
            data = source.read_bytes() if isinstance(source, Path) else source
            add_file(archive, name, data)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="empty directory for the release assets")
    parser.add_argument("source", type=Path, help="clean Git checkout of the exact release commit")
    parser.add_argument("--expected-version", help="fail unless RELEASE_VERSION.txt matches")
    args = parser.parse_args()

    source = args.source.resolve()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise SystemExit(f"Refusing to overwrite a non-empty output directory: {output}")

    version = (source / "RELEASE_VERSION.txt").read_text(encoding="utf-8").strip()
    if args.expected_version and version != args.expected_version:
        raise SystemExit(f"Expected release {args.expected_version}, found {version}")

    tracked = subprocess.check_output(
        ["git", "ls-files", "-z"], cwd=source
    ).decode("utf-8").split("\0")
    files = sorted(
        name
        for name in tracked
        if name
        and not name.startswith(".github/")
        and name != "scripts/arena-release-build.py"
    )
    for name in files:
        if not (source / name).is_file():
            raise SystemExit(f"Tracked release source is missing: {name}")

    app = output / f"BabolToyor-App-{version}.zip"
    make_zip(app, [(name, source / name) for name in files])

    setup_cmd = output / f"BabolToyor-Setup-{version}.cmd"
    shutil.copyfile(source / "windows-installer" / "BabolToyor-Setup.cmd", setup_cmd)

    windows_setup = output / f"BabolToyor-Windows-Setup-{version}.zip"
    make_zip(
        windows_setup,
        [
            ("app.zip", app),
            ("BabolToyor-Setup.cmd", setup_cmd),
            ("README-fa.md", source / "windows-installer" / "README-fa.md"),
            ("INSTALL-STEPS-fa.md", source / "windows-installer" / "INSTALL-STEPS-fa.md"),
            ("INSTALL-STEPS-fa.html", source / "windows-installer" / "INSTALL-STEPS-fa.html"),
        ],
    )

    release_note = output / f"RELEASE-{version}-fa.md"
    shutil.copyfile(source / f"RELEASE-{version}-fa.md", release_note)
    domain_doc = output / "domain-https-fa.md"
    shutil.copyfile(source / "docs" / "domain-https-fa.md", domain_doc)
    backup_doc = output / "reports-backup-update-fa.md"
    shutil.copyfile(source / "docs" / "reports-backup-update-fa.md", backup_doc)

    publish_assets = [app, setup_cmd, windows_setup, domain_doc, release_note, backup_doc]
    checksum_file = output / f"SHA256SUMS-{version}.txt"
    checksum_file.write_text(
        "".join(
            f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n"
            for path in publish_assets
        ),
        encoding="ascii",
        newline="\n",
    )

    for path in [*publish_assets, checksum_file]:
        print(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}  {path.stat().st_size} bytes")
    print(f"Packaged {len(files)} tracked source files from {source}")


if __name__ == "__main__":
    main()
