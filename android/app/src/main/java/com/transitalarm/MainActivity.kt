package com.transitalarm

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "TransitSnoozer"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
      
  override fun onCreate(savedInstanceState: Bundle?) {
      // Pass null to super.onCreate to prevent Fragment restoration issues
      // This is safer than trying to modify savedInstanceState
      super.onCreate(null)
      handleIntent(intent)
  }
  
  override fun onNewIntent(intent: Intent) {
      super.onNewIntent(intent)
      handleIntent(intent)
  }
  
  private fun handleIntent(intent: Intent?) {
      if (intent != null) {
          // Check for alarm-related intents first
          if (intent.getBooleanExtra("STOP_ALARM", false)) {
              // Stop the alarm immediately
              stopAlarmDirectly()
              return
          } else if (intent.getBooleanExtra("ALARM_TRIGGERED", false)) {
              // Send event to React Native to show alarm dialog
              sendAlarmEventToReactNative()
              return
          }
      }
  }
  
  private fun stopAlarmDirectly() {
      try {
          // Get the notification module and stop alarm
          val notificationModule = NotificationListenerModule.getCurrentInstance()
          notificationModule?.stopAlarmSound()
          android.util.Log.d("MainActivity", "Alarm stopped from notification action")
      } catch (e: Exception) {
          android.util.Log.e("MainActivity", "Error stopping alarm", e)
      }
  }
  
  private fun sendAlarmEventToReactNative() {
      try {
          val reactContext = reactInstanceManager.currentReactContext
          if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
              val params: WritableMap = Arguments.createMap()
              params.putBoolean("showAlarmDialog", true)
              
              reactContext
                  .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                  .emit("onAlarmNotificationClick", params)
              
              android.util.Log.d("MainActivity", "Alarm notification click sent to React Native")
          } else {
              // If React context not ready, try again after a delay
              android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                  sendAlarmEventToReactNative()
              }, 500)
          }
      } catch (e: Exception) {
          android.util.Log.e("MainActivity", "Error sending alarm event to React Native", e)
      }
  }
}
