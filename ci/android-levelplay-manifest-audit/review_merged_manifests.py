#!/usr/bin/env python3
"""N11 non-executing Android merged-manifest diff, zero secrets in output.

Arguments: UMP-only debug merged manifest, UMP+LevelPlay merged manifest.
This runs against an isolated CI proxy using the ACTUAL source manifest +
N7/N8 debug overlay. API 36 proxy is NOT a substitute for the local API 37
Tauri merged APK manifest audit before any physical SDK-enabled install.
"""
from __future__ import annotations

import collections
import pathlib
import sys
import xml.etree.ElementTree as ET

A = "{http://schemas.android.com/apk/res/android}"
TYPES = ("activity", "activity-alias", "provider", "service", "receiver")
# Exact N11 baseline observed with mediation-sdk 9.5.0 + UMP 4.0.0,
# AND a Tauri Android manifest using API-36 proxy. Change requires re-review.
# This is a regression guard, NOT an approval for a physical SDK-enabled APK.
OBSERVED_SDK95_COMPONENT_ADDITIONS = {
    "activity:com.ironsource.mediationsdk.testSuite.TestSuiteActivity",
    "activity:com.ironsource.sdk.controller.ControllerActivity",
    "activity:com.ironsource.sdk.controller.InterstitialActivity",
    "activity:com.ironsource.sdk.controller.OpenUrlActivity",
    "activity:com.unity3d.ironsourceads.internal.services.InlineStoreActivity",
    "provider:com.ironsource.lifecycle.IronsourceLifecycleProvider",
    "provider:com.ironsource.lifecycle.LevelPlayActivityLifecycleProvider",
}
OBSERVED_SDK95_PERMISSION_ADDITIONS = {
    "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
    "android.permission.ACCESS_NETWORK_STATE",
}

DANGEROUS = (
    "READ_CONTACTS", "WRITE_CONTACTS", "READ_SMS", "SEND_SMS",
    "RECEIVE_SMS", "READ_CALL_LOG", "WRITE_CALL_LOG", "READ_PHONE_STATE",
    "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "ACCESS_BACKGROUND_LOCATION",
    "MANAGE_EXTERNAL_STORAGE", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE",
    "QUERY_ALL_PACKAGES", "REQUEST_INSTALL_PACKAGES", "SYSTEM_ALERT_WINDOW",
    "BIND_ACCESSIBILITY_SERVICE", "CAPTURE_AUDIO_OUTPUT", "RECORD_AUDIO",
    "READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO", "READ_MEDIA_AUDIO",
)


def parse(path: pathlib.Path) -> dict:
    root = ET.parse(path).getroot()
    app = root.find("application")
    if app is None:
        raise RuntimeError("N11_MISSING_APPLICATION")
    package = root.get("package", "")
    components = {}
    for kind in TYPES:
        for entry in app.findall(kind):
            name = entry.get(A + "name", "")
            if not name:
                raise RuntimeError("N11_COMPONENT_NAME_MISSING")
            components[kind + ":" + name] = {
                "exported": entry.get(A + "exported", "implicit"),
                "permission": entry.get(A + "permission", ""),
            }
    permissions = set()
    for tag in ("uses-permission", "uses-permission-sdk-23"):
        permissions.update(
            node.get(A + "name", "") for node in root.findall(tag)
        )
    metadata = set(
        node.get(A + "name", "") for node in app.findall("meta-data")
    )
    return {
        "package": package,
        "components": components,
        "permissions": permissions,
        "metadata": metadata,
        "cleartext": app.get(A + "usesCleartextTraffic", ""),
    }


def main() -> None:
    if len(sys.argv) != 3:
        raise RuntimeError("USAGE: python review_merged_manifests.py base.xml sdk.xml")
    baseline = parse(pathlib.Path(sys.argv[1]))
    sdk = parse(pathlib.Path(sys.argv[2]))
    failures: list[str] = []
    checks: list[str] = []

    for label, state in (("BASE_UMP_ONLY", baseline), ("SDK_PLUS_UMP", sdk)):
        if not state["package"].endswith(".levelplaypilot"):
            failures.append(label + ": ISOLATED_DEBUG_PACKAGE_MISSING")
        names = " ".join(state["components"])
        for activity in ("MainActivity", "N7UmpPreviewActivity", "N8UmpPrivacyOptionsActivity"):
            if activity not in names:
                failures.append(label + ": ACTIVITY_MISSING_" + activity)
        if "com.google.android.gms.ads.APPLICATION_ID" not in state["metadata"]:
            failures.append(label + ": UMP_APP_ID_METADATA_MISSING")
        if "android.permission.INTERNET" not in state["permissions"]:
            failures.append(label + ": INTERNET_PERMISSION_MISSING")
        print(
            "N11_" + label +
            " permissions=" + str(len(state["permissions"])) +
            " components=" + str(len(state["components"])) +
            " metadata_keys=" + str(len(state["metadata"])) +
            " cleartext_debug=" + state["cleartext"]
        )

    base_c = baseline["components"]
    sdk_c = sdk["components"]
    additions = sorted(set(sdk_c) - set(base_c))
    removed = sorted(set(base_c) - set(sdk_c))
    added_perms = sorted(sdk["permissions"] - baseline["permissions"])
    added_metadata = sorted(sdk["metadata"] - baseline["metadata"])

    # Any unexpected SDK surface is a hard stop. This snapshot only verifies
    # that the pinned 9.5.0 manifest has not drifted; the two lifecycle
    # ContentProviders still require an explicit pre-install privacy review.
    if set(additions) != OBSERVED_SDK95_COMPONENT_ADDITIONS:
        failures.append("N11_UNEXPECTED_SDK95_COMPONENT_SURFACE_DRIFT")
    if set(added_perms) != OBSERVED_SDK95_PERMISSION_ADDITIONS:
        failures.append("N11_UNEXPECTED_SDK95_PERMISSION_SURFACE_DRIFT")

    print("N11_LEVELPLAY_COMPONENT_ADDITIONS=" + str(len(additions)))
    for comp in additions:
        print("N11_ADDED_COMPONENT " + comp + " exported=" + sdk_c[comp]["exported"])
        if sdk_c[comp]["exported"].lower() == "true":
            failures.append("NEW_EXPORTED_SDK_COMPONENT_REQUIRES_EXPLICIT_REVIEW: " + comp)
    for comp in removed:
        failures.append("PREEXISTING_COMPONENT_REMOVED: " + comp)
    for comp in sorted(set(sdk_c) & set(base_c)):
        if sdk_c[comp]["exported"] != base_c[comp]["exported"]:
            failures.append("EXISTING_COMPONENT_EXPORT_CHANGED: " + comp)

    print("N11_LEVELPLAY_PERMISSION_ADDITIONS=" + str(len(added_perms)))
    for permission in added_perms:
        print("N11_ADDED_PERMISSION " + permission)
        if any(permission.endswith("." + term) for term in DANGEROUS):
            failures.append("SENSITIVE_PERMISSION_NEEDS_REVIEW: " + permission)

    print("N11_LEVELPLAY_METADATA_KEY_ADDITIONS=" + str(len(added_metadata)))
    for meta in added_metadata:
        print("N11_ADDED_METADATA_KEY " + meta)
    # Do not log any metadata values, publisher app IDs, device advertising IDs,
    # process identifiers, user consent strings, private keys or raw manifests.

    if "com.google.android.gms.permission.AD_ID" not in sdk["permissions"]:
        print("N11_AD_ID_PERMISSION=NOT_DECLARED_IN_PROXY_REVIEW_REQUIRED")
        # Not an automatic blocker; the LevelPlay test manifest + Google ID
        # dependencies require a separate owner privacy / Play Data Safety review.
    else:
        print("N11_AD_ID_PERMISSION=PRESENT_REVIEW_DATA_SAFETY")

    print("N11_REAL_TAURI_TARGET37_FINAL_MERGE=NOT_YET_VERIFIED")
    print("N11_NO_APK_NO_SDK_INITIALIZATION_NO_AD_REQUESTS=TRUE")
    if failures:
        for issue in failures:
            print("N11_HOLD " + issue, file=sys.stderr)
        raise SystemExit(1)
    print("N11_PROXY_MANIFEST_REVIEW=PASS_WITH_API37_FOLLOWUP_REQUIRED")


if __name__ == "__main__":
    main()
