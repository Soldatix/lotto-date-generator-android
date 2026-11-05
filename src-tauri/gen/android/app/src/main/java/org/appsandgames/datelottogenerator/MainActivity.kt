package org.appsandgames.datelottogenerator

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private var nativeHostProbe: LevelPlayHostProbe? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // Inert unless the isolated debuggable pilot receives an explicit ADB extra.
    // No LevelPlay SDK or advertisement is loaded by the host probe.
    nativeHostProbe = LevelPlayHostProbe(this).also { it.scheduleIfRequested() }
  }

  override fun onDestroy() {
    nativeHostProbe?.detach()
    nativeHostProbe = null
    super.onDestroy()
  }
}
