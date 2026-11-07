#!/usr/bin/env python3
"""N11-C: bounded static method-call review of two LevelPlay startup delegates.

Audits exact classes from Maven's pinned mediation-sdk:9.5.0 AAR.
Inspects *bytecode references only*, never loads Android/SDK classes into a VM,
uses no advertising IDs, never contacts ad networks, and makes no APK.

Important: direct method references cannot prove the absence of data collection
through reflection, native code, async dispatch, invokedynamic or nested calls.
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

VERSION = "9.5.0"
GROUP = "com.unity3d.ads-mediation"
ARTIFACT = "mediation-sdk"
LIFECYCLE_HELPER = "com.ironsource.lifecycle.b"
ACTIVITY_PROVIDER = "com.ironsource.lifecycle.LevelPlayActivityLifecycleProvider"
METHOD_DECL = re.compile(r"^  (?:public|private|protected|static|final|synchronized|native|abstract)\b.*\);\s*$")
CALL = re.compile(r"//\s+(?:InterfaceMethod|Method)\s+([^\s]+)")
REFLECTIVE = re.compile(
    r"reflect|Class\.forName|Method\.invoke|System\.loadLibrary|"
    r"AdvertisingId|Identifier|SharedPreferences|URL|HttpURLConnection|"
    r"OkHttp|Socket|WebView|Network|send|upload|telemetry|collect|"
    r"registerActivityLifecycleCallbacks|Executor|Thread|Handler|init|adquality",
    re.IGNORECASE,
)


def pinned_aar() -> pathlib.Path:
    location = (
        pathlib.Path.home() / ".gradle/caches/modules-2/files-2.1" /
        GROUP / ARTIFACT / VERSION
    )
    aars = sorted(location.rglob("*.aar")) if location.exists() else []
    if len(aars) != 1 or aars[0].name != "mediation-sdk-9.5.0.aar":
        raise RuntimeError("N11_C_EXPECTED_ONE_PINNED_950_AAR")
    return aars[0]


def class_from_aar(aar: pathlib.Path, name: str) -> bytes:
    entry = name.replace(".", "/") + ".class"
    with zipfile.ZipFile(aar) as bundle:
        with zipfile.ZipFile(io.BytesIO(bundle.read("classes.jar"))) as jar:
            if entry not in jar.namelist():
                raise RuntimeError("N11_C_MISSING_CLASS_" + name)
            return jar.read(entry)


def inspect(name: str, code: bytes, base: pathlib.Path) -> dict[str, list[str]]:
    dest = base / pathlib.Path(*name.split(".")).with_suffix(".class")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(code)
    result = subprocess.run(
        ["javap", "-c", "-p", "-classpath", str(base), name],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        timeout=35, check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("N11_C_JAVAP_FAILED_" + name)
    methods: dict[str, list[str]] = {}
    current: str | None = None
    for line in result.stdout.splitlines():
        if METHOD_DECL.match(line):
            current = line.strip()
            if current in methods:
                raise RuntimeError("N11_C_DUPLICATE_METHOD_HEADER")
            methods[current] = []
        elif line.startswith("  static {};"):
            current = "static {}"
            methods[current] = []
        elif current is not None:
            m = CALL.search(line)
            if m:
                methods[current].append(m.group(1))
    if not methods:
        raise RuntimeError("N11_C_METHODS_NOT_FOUND_" + name)
    return methods


def summarize(name: str, methods: dict[str, list[str]]) -> None:
    print("N11_C_CLASS=" + name)
    print("N11_C_METHOD_COUNT=" + str(len(methods)))
    print("N11_C_DIRECT_INVOCATION_COUNT=" + str(sum(len(x) for x in methods.values())))
    for method, calls in methods.items():
        # No bytecode instruction operands, literals, user data or app keys.
        print("N11_C_METHOD=" + method[:180])
        if len(calls) > 80:
            raise RuntimeError("N11_C_METHOD_CALL_COUNT_REVIEW_REQUIRED")
        for called in calls:
            print("N11_C_CALL=" + called[:200])
            if REFLECTIVE.search(called):
                print("N11_C_FLAG=REVIEW_DELEGATE_OR_REFLECTION")
    if len(methods) > 60:
        raise RuntimeError("N11_C_CLASS_TOO_LARGE_TO_REVIEW_IN_CI")


def main() -> None:
    aar = pinned_aar()
    print("N11_C_PINNED_AAR=mediation-sdk-9.5.0.aar")
    with tempfile.TemporaryDirectory(prefix="n11-c-static-") as tmp:
        dest = pathlib.Path(tmp)
        for cls in (LIFECYCLE_HELPER, ACTIVITY_PROVIDER):
            code = class_from_aar(aar, cls)
            print("N11_C_CLASS_SHA256=" + hashlib.sha256(code).hexdigest().upper())
            all_methods = inspect(cls, code, dest)
            if cls == LIFECYCLE_HELPER:
                # Both b.d() and b.a(Context) were called by
                # IronsourceLifecycleProvider.onCreate() in N11-B.
                has_d = any(re.search(r"\bd\(\);$", header) for header in all_methods)
                has_a = any(re.search(r"\ba\(android\.content\.Context\);$", header)
                            for header in all_methods)
                if not has_d or not has_a:
                    raise RuntimeError("N11_C_HELPER_TARGET_SIGNATURE_CHANGED")
                summarize(cls, all_methods)
            else:
                matches = {
                    h: calls for h, calls in all_methods.items()
                    if re.search(r"\ba\(android\.app\.Application\);$", h)
                }
                if len(matches) != 1:
                    raise RuntimeError("N11_C_ACTIVITY_DELEGATE_SIGNATURE_CHANGED")
                summarize(cls, matches)

    print("N11_C_DELEGATED_BYTECODE_REVIEW=PASS")
    print("N11_C_PRIVACY_SAFETY=STILL_NOT_PROVEN")
    print("N11_C_SDK_INSTALL=HOLD")
    print("N11_C_NO_APK_NO_INSTALL_NO_SDK_EXECUTION_NO_AD_REQUESTS=TRUE")


if __name__ == "__main__":
    try:
        main()
    except (OSError, KeyError, ValueError, RuntimeError, subprocess.TimeoutExpired,
            zipfile.BadZipFile) as exc:
        print("N11_C_FAIL_CLOSED=" + str(exc), file=sys.stderr)
        raise SystemExit(1)
