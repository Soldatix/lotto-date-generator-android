#!/usr/bin/env python3
"""N11-B: offline static onCreate() inspection of pinned LevelPlay AAR providers.

Runs on CI after manifest merging resolved official SDK artifacts.
NEVER launches Android, initializes an SDK, makes ad requests, reads GAID,
unpacks the user's local APK, logs publisher data or executes SDK classes.

This is an inventory and risk flag, not a conclusion that pre-consent startup
is safe. Provider bytecode can delegate to other methods/libraries.
"""
from __future__ import annotations

import hashlib
import io
import pathlib
import re
import subprocess
import sys
import tempfile
import zipfile

TARGETS = (
    "com.ironsource.lifecycle.IronsourceLifecycleProvider",
    "com.ironsource.lifecycle.LevelPlayActivityLifecycleProvider",
)
SDK_PREFIX = "com.unity3d.ads-mediation"
PINNED_VERSION = "9.5.0"
METHOD_REF = re.compile(r"//\s+(?:InterfaceMethod|Method)\s+([^\s]+)")
METHOD_HEADER = re.compile(r"^\s{2}(?:public|protected|private|static)\s+.*(?:\(|\);)")
HAZARD = re.compile(
    r"init|register|track|network|advert|analytics|request|http|consent|"
    r"identif|device|session|life.?cycle|start|collect",
    re.IGNORECASE,
)


def class_from_aar(path: pathlib.Path, class_entry: str) -> bytes | None:
    try:
        with zipfile.ZipFile(path) as aar:
            jars = sorted(name for name in aar.namelist()
                          if name == "classes.jar" or
                          (name.startswith("libs/") and name.endswith(".jar")))
            for name in jars:
                with zipfile.ZipFile(io.BytesIO(aar.read(name))) as jar:
                    if class_entry in jar.namelist():
                        return jar.read(class_entry)
    except (OSError, ValueError, zipfile.BadZipFile) as exc:
        raise RuntimeError("N11_B_INVALID_AAR_ARCHIVE " + path.name) from exc
    return None


def javap_oncreate(class_name: str, class_bytes: bytes, target_dir: pathlib.Path) -> list[str]:
    classfile = target_dir / pathlib.Path(*class_name.split(".")).with_suffix(".class")
    classfile.parent.mkdir(parents=True, exist_ok=True)
    classfile.write_bytes(class_bytes)
    result = subprocess.run(
        ["javap", "-c", "-p", "-classpath", str(target_dir), class_name],
        text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError("N11_B_JAVAP_FAILED_" + class_name)
    source = result.stdout.splitlines()
    start = -1
    for idx, line in enumerate(source):
        if " onCreate();" in line and "boolean" in line:
            start = idx
            break
    if start == -1:
        raise RuntimeError("N11_B_PROVIDER_ONCREATE_NOT_FOUND_" + class_name)
    called: list[str] = []
    for line in source[start + 1:]:
        if METHOD_HEADER.match(line) or line.strip() == "}":
            break
        match = METHOD_REF.search(line)
        if match:
            # Names/signatures ONLY; never method arguments or string constants.
            called.append(match.group(1))
    return called


def main() -> None:
    cache = pathlib.Path.home() / ".gradle/caches/modules-2/files-2.1"
    if not cache.exists():
        raise RuntimeError("N11_B_GRADLE_CACHE_NOT_FOUND")
    all_aars = sorted(cache.rglob("*.aar"))
    if not all_aars:
        raise RuntimeError("N11_B_AAR_CACHE_EMPTY")
    # A pinned Maven dependency must be in the actual resolved cache;
    # do NOT silently accept a different LevelPlay SDK revision.
    sdk_root = cache / SDK_PREFIX / "mediation-sdk" / PINNED_VERSION
    if not sdk_root.exists() or not any(sdk_root.rglob("*.aar")):
        raise RuntimeError("N11_B_PINNED_LEVELPLAY_950_AAR_NOT_FOUND")

    for target in TARGETS:
        member = target.replace(".", "/") + ".class"
        matches = []
        for aar in all_aars:
            code = class_from_aar(aar, member)
            if code is not None:
                matches.append((aar, code))
        if not matches:
            raise RuntimeError("N11_B_PROVIDER_BYTECODE_MISSING_" + target)
        # Duplicate definitions would make startup attribution ambiguous.
        if len(matches) != 1:
            raise RuntimeError("N11_B_DUPLICATE_PROVIDER_BYTECODE_" + target)
        archive, code = matches[0]
        digest = hashlib.sha256(code).hexdigest().upper()
        print("N11_B_PROVIDER=" + target)
        print("N11_B_PROVIDER_CLASS_SHA256=" + digest)
        print("N11_B_PROVIDER_AAR_NAME=" + archive.name)
        with tempfile.TemporaryDirectory(prefix="n11-provider-") as tmp:
            calls = javap_oncreate(target, code, pathlib.Path(tmp))
        print("N11_B_ONCREATE_DIRECT_CALL_COUNT=" + str(len(calls)))
        for called in calls:
            # Audit function references without disclosing any private IDs.
            print("N11_B_ONCREATE_DIRECT_CALL=" + called[:180])
        print("N11_B_RISK_NAME_MATCHES=" + str(sum(bool(HAZARD.search(x)) for x in calls)))

    print("N11_B_STATIC_PROVIDER_BYTECODE_INVENTORY=PASS")
    print("N11_B_PRECONSENT_PROVIDER_SAFETY=REQUIRES_REVIEW")
    print("N11_B_NO_APK_NO_INSTALL_NO_SDK_EXECUTION_NO_AD_REQUESTS=TRUE")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as exc:
        print("N11_B_STATIC_ANALYSIS_HOLD " + str(exc), file=sys.stderr)
        raise SystemExit(1)
