package org.appsandgames.datelottogenerator

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private var nativeHostProbe: NativeBannerHostProbe? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // Inert unless the isolated debuggable pilot receives an explicit ADB extra.
    // No advertising SDK or ad request is used by this diagnostic.
    nativeHostProbe = NativeBannerHostProbe(this).also { it.scheduleIfRequested() }
  }

  override fun onPause() {
    nativeHostProbe?.pause()
    super.onPause()
  }

  override fun onResume() {
    super.onResume()
    nativeHostProbe?.resume()
  }

  override fun onDestroy() {
    nativeHostProbe?.detach()
    nativeHostProbe = null
    super.onDestroy()
  }
}
