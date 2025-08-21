package com.transitalarm

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.os.Vibrator
import android.os.VibrationEffect
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.ReactApplicationContext

class NotificationListenerModule(private val reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "NotificationListener"
        const val NOTIFICATION_EVENT = "onNotificationReceived"
        
        // Static reference to the current module instance
        @Volatile
        private var currentInstance: NotificationListenerModule? = null
        
        // Static reference to current playing ringtone
        @Volatile
        private var currentRingtone: Ringtone? = null
        
        // Handler for alarm looping
        private val alarmHandler = android.os.Handler(android.os.Looper.getMainLooper())
        private var alarmLoopRunnable: Runnable? = null
        
        // Store original volume to restore later
        private var originalVolume: Int = -1
        private var audioManager: AudioManager? = null
        
        // Vibrator instance
        private var vibrator: Vibrator? = null
        
        // Static reference to current alarm message and title
        @Volatile
        private var currentAlarmMessage: String = ""
        
        @Volatile
        private var currentAlarmTitle: String = ""
        
        // Flag to control whether we're actively monitoring
        @Volatile
        var isMonitoring: Boolean = false
        
        // Current alarm settings
        @Volatile
        var alarmAtStops: Int = 1
        
        @Volatile
        var debugMode: Boolean = false
        
        @Volatile
        var currentAlarmSound: String = "default"
        
        @Volatile
        var currentVolume: Double = 0.8
        
        @Volatile
        var monitoredPackage: String? = null
        
        fun getCurrentInstance(): NotificationListenerModule? = currentInstance
    }
    
    init {
        // Set the current instance
        currentInstance = this
        
        // Delay checking for pending notifications to ensure React is ready
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            reactContext.runOnJSQueueThread {
                android.util.Log.d(MODULE_NAME, "Module initialized, checking for pending notifications after delay")
                sendPendingNotifications()
            }
        }, 3000) // Wait 3 seconds for React to be ready
    }

    override fun getName(): String = MODULE_NAME

    @ReactMethod
    fun isNotificationListenerEnabled(promise: Promise) {
        val context = reactApplicationContext
        val packageName = context.packageName
        val flat = Settings.Secure.getString(
            context.contentResolver,
            "enabled_notification_listeners"
        )

        if (!TextUtils.isEmpty(flat)) {
            val names = flat.split(":")
            for (name in names) {
                val cn = ComponentName.unflattenFromString(name)
                if (cn != null && TextUtils.equals(packageName, cn.packageName)) {
                    promise.resolve(true)
                    return
                }
            }
        }
        promise.resolve(false)
    }

    @ReactMethod
    fun openNotificationListenerSettings() {
        val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        val uri = android.net.Uri.fromParts("package", reactApplicationContext.packageName, null)
        intent.data = uri
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun startListening(packageName: String?) {
        // NotificationListenerService is managed by the system, we can't start it manually
        // Just log that we're ready to receive notifications
        android.util.Log.d(MODULE_NAME, "Start listening called for package: $packageName - service should be active if enabled")
        
        // Set monitoring flag to true and store the monitored package
        isMonitoring = true
        monitoredPackage = packageName
        
        // Send any pending notifications that were received before React was ready
        sendPendingNotifications()
    }
    
    private fun sendPendingNotifications() {
        android.util.Log.d(MODULE_NAME, "Checking for pending notifications")
        
        // Ensure React context is ready
        if (!reactContext.hasActiveCatalystInstance()) {
            android.util.Log.w(MODULE_NAME, "React context not ready for pending notifications, will retry")
            // Retry after a delay
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                sendPendingNotifications()
            }, 500)
            return
        }
        
        try {
            val pendingNotifications = TransitNotificationListenerService.getPendingNotifications()
            android.util.Log.d(MODULE_NAME, "Found ${pendingNotifications.size} pending notifications")
            
            pendingNotifications.forEach { notification ->
                sendNotificationToJS(
                    notification.packageName,
                    notification.appName,
                    notification.title,
                    notification.text,
                    notification.subText,
                    notification.bigText,
                    notification.timestamp
                )
            }
        } catch (e: Exception) {
            android.util.Log.e(MODULE_NAME, "Error sending pending notifications", e)
        }
    }

    @ReactMethod
    fun stopListening() {
        android.util.Log.d(MODULE_NAME, "Stop listening called - will stop processing notifications")
        
        // Set monitoring flag to false and clear monitored package
        isMonitoring = false
        monitoredPackage = null
        
        // Clear dismissed notification memory
        TransitNotificationListenerService.clearDismissedNotification()
        
        // Also stop any active alarm
        stopAlarmSound()
    }

    fun sendNotificationToJS(
        packageName: String,
        appName: String,
        title: String?,
        text: String?,
        subText: String?,
        bigText: String?,
        timestamp: Long
    ) {
        android.util.Log.d(MODULE_NAME, "Sending notification to JS: $appName - $title")
        
        val params = Arguments.createMap().apply {
            putString("packageName", packageName)
            putString("appName", appName)
            putString("title", title ?: "")
            putString("text", text ?: "")
            putString("subText", subText ?: "")
            putString("bigText", bigText ?: "")
            putDouble("timestamp", timestamp.toDouble())
        }

        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(NOTIFICATION_EVENT, params)
            android.util.Log.d(MODULE_NAME, "Notification sent to JS successfully")
        } catch (e: Exception) {
            android.util.Log.e(MODULE_NAME, "Error sending notification to JS", e)
        }
    }
    
    private fun sendEvent(eventName: String, params: WritableMap) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
            android.util.Log.d(MODULE_NAME, "Event $eventName sent to JS successfully")
        } catch (e: Exception) {
            android.util.Log.e(MODULE_NAME, "Error sending event $eventName to JS", e)
        }
    }
    
    @ReactMethod
    fun playAlarmSound(volume: Double = 1.0, ringtoneType: String = "default") {
        try {
            android.util.Log.d(MODULE_NAME, "playAlarmSound called from JS with volume: $volume, ringtoneType: $ringtoneType")
            
            // Check if alarm is already playing
            currentRingtone?.let {
                if (it.isPlaying) {
                    android.util.Log.d(MODULE_NAME, "Alarm is already playing, not triggering again")
                    return
                }
            }
            
            // Store the current values for background use
            currentVolume = volume
            currentAlarmSound = ringtoneType
            
            // Get audio manager
            if (audioManager == null) {
                audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            }
            
            // Store original volume
            audioManager?.let { am ->
                originalVolume = am.getStreamVolume(AudioManager.STREAM_MUSIC)
                
                // Set the music volume based on the parameter (0.0 to 1.5 for 0-150%)
                val currentMediaVolume = am.getStreamVolume(AudioManager.STREAM_MUSIC)
                val maxVolume = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                
                // Calculate target volume as product of app volume and current media volume
                val targetVolume = (maxVolume * volume * currentMediaVolume / maxVolume).toInt().coerceIn(0, maxVolume)
                am.setStreamVolume(AudioManager.STREAM_MUSIC, targetVolume, 0)
                android.util.Log.d(MODULE_NAME, "Set music volume to $targetVolume (max: $maxVolume, current: $currentMediaVolume)")
            }
            
            // Stop any currently playing ringtone
            currentRingtone?.let {
                if (it.isPlaying) {
                    android.util.Log.d(MODULE_NAME, "Stopping previous ringtone")
                    it.stop()
                }
            }
            currentRingtone = null
            
            // Get the appropriate ringtone URI based on type
            val uri = when (ringtoneType) {
                "default" -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                "notification" -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                "phone" -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                else -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            }
            android.util.Log.d(MODULE_NAME, "Selected URI for type $ringtoneType: $uri")
            if (uri == null) {
                android.util.Log.e(MODULE_NAME, "No alarm or notification sound available")
                return
            }
            
            val ringtone = RingtoneManager.getRingtone(reactContext, uri)
            android.util.Log.d(MODULE_NAME, "Ringtone created: ${ringtone != null}")
            
            // Set audio attributes for music stream
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .setLegacyStreamType(AudioManager.STREAM_MUSIC)
                    .build()
                ringtone.audioAttributes = audioAttributes
                android.util.Log.d(MODULE_NAME, "Audio attributes set for music stream")
            }
            
            // Store reference
            currentRingtone = ringtone
            
            // Start looping playback
            startAlarmLoop()
            android.util.Log.d(MODULE_NAME, "Alarm loop started")
            
            // Start vibration
            startVibration()
            
            // Emit event to JS that alarm started
            val params = Arguments.createMap().apply {
                putBoolean("isActive", true)
                putString("message", currentAlarmMessage)
            }
            sendEvent("nativeAlarmStateChanged", params)
        } catch (e: Exception) {
            android.util.Log.e(MODULE_NAME, "Failed to play alarm sound", e)
        }
    }
    
    @ReactMethod
    fun stopAlarmSound() {
        try {
            android.util.Log.d(MODULE_NAME, "stopAlarmSound called from JS")
            
            // Save the dismissed notification title before clearing
            if (currentAlarmTitle.isNotEmpty()) {
                TransitNotificationListenerService.setLastDismissedTitle(currentAlarmTitle)
            }
            
            // Stop the looping
            stopAlarmLoop()
            
            currentRingtone?.let {
                if (it.isPlaying) {
                    it.stop()
                    android.util.Log.d(MODULE_NAME, "Alarm sound stopped")
                }
            }
            currentRingtone = null
            currentAlarmMessage = "" // Clear the message when alarm stops
            currentAlarmTitle = "" // Clear the title when alarm stops
            
            // Restore original volume
            if (originalVolume != -1) {
                audioManager?.setStreamVolume(AudioManager.STREAM_MUSIC, originalVolume, 0)
                android.util.Log.d(MODULE_NAME, "Restored original music volume to $originalVolume")
                originalVolume = -1
            }
            
            // Stop vibration
            stopVibration()
            
            // Also dismiss the alarm notification
            val notificationManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(TransitNotificationListenerService.NOTIFICATION_ID)
            android.util.Log.d(MODULE_NAME, "Alarm notification dismissed")
            
            // Emit event to JS that alarm stopped
            val params = Arguments.createMap().apply {
                putBoolean("isActive", false)
                putString("message", "")
            }
            sendEvent("nativeAlarmStateChanged", params)
        } catch (e: Exception) {
            android.util.Log.e(MODULE_NAME, "Failed to stop alarm sound", e)
        }
    }
    
    @ReactMethod
    fun isAlarmPlaying(promise: Promise) {
        try {
            val isPlaying = currentRingtone?.isPlaying ?: false
            promise.resolve(isPlaying)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check alarm status", e)
        }
    }
    
    fun setAlarmMessage(message: String) {
        currentAlarmMessage = message
        android.util.Log.d(MODULE_NAME, "Alarm message set: $message")
    }
    
    @ReactMethod
    fun getAlarmMessage(promise: Promise) {
        promise.resolve(currentAlarmMessage)
    }
    
    fun setAlarmTitle(title: String) {
        currentAlarmTitle = title
        android.util.Log.d(MODULE_NAME, "Alarm title set: $title")
    }
    
    @ReactMethod
    fun updateAlarmSettings(stopsBeforeAlarm: Int, debugModeEnabled: Boolean, volume: Double = 0.8, alarmSound: String = "default") {
        alarmAtStops = stopsBeforeAlarm
        debugMode = debugModeEnabled
        currentVolume = volume
        currentAlarmSound = alarmSound
        android.util.Log.d(MODULE_NAME, "Alarm settings updated - alarmAtStops: $alarmAtStops, debugMode: $debugMode, volume: $volume, alarmSound: $alarmSound")
    }
    
    private fun startAlarmLoop() {
        // Cancel any existing loop
        stopAlarmLoop()
        
        // Create a runnable that plays the alarm continuously
        alarmLoopRunnable = object : Runnable {
            override fun run() {
                currentRingtone?.let { ringtone ->
                    if (!ringtone.isPlaying) {
                        ringtone.play()
                        android.util.Log.d(MODULE_NAME, "Restarting alarm sound for loop")
                    }
                    // Schedule next check after a short delay
                    alarmHandler.postDelayed(this, 100)
                }
            }
        }
        
        // Start the loop
        alarmLoopRunnable?.let {
            alarmHandler.post(it)
        }
    }
    
    private fun stopAlarmLoop() {
        alarmLoopRunnable?.let {
            alarmHandler.removeCallbacks(it)
            android.util.Log.d(MODULE_NAME, "Alarm loop stopped")
        }
        alarmLoopRunnable = null
    }
    
    private fun startVibration() {
        try {
            if (vibrator == null) {
                vibrator = reactContext.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            
            vibrator?.let { v ->
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    // Create a vibration pattern: vibrate for 1 second, pause for 1 second, repeat
                    val pattern = longArrayOf(0, 1000, 1000)
                    val effect = VibrationEffect.createWaveform(pattern, 0) // 0 means repeat at index 0
                    v.vibrate(effect)
                } else {
                    // For older devices
                    val pattern = longArrayOf(0, 1000, 1000)
                    v.vibrate(pattern, 0) // 0 means repeat at index 0
                }
                android.util.Log.d(MODULE_NAME, "Vibration started")
            }
        } catch (e: Exception) {
            android.util.Log.e(MODULE_NAME, "Failed to start vibration", e)
        }
    }
    
    private fun stopVibration() {
        try {
            vibrator?.cancel()
            android.util.Log.d(MODULE_NAME, "Vibration stopped")
        } catch (e: Exception) {
            android.util.Log.e(MODULE_NAME, "Failed to stop vibration", e)
        }
    }
    
    @ReactMethod
    fun previewRingtone(ringtoneType: String, promise: Promise) {
        try {
            android.util.Log.d(MODULE_NAME, "Preview ringtone called with type: $ringtoneType")
            
            // Stop any currently playing preview
            currentRingtone?.let {
                if (it.isPlaying) {
                    it.stop()
                }
            }
            currentRingtone = null
            
            // Get the appropriate ringtone URI
            val uri = when (ringtoneType) {
                "default" -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                "notification" -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                "phone" -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                else -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            }
            
            if (uri == null) {
                promise.reject("NO_RINGTONE", "No ringtone available for type: $ringtoneType")
                return
            }
            
            val ringtone = RingtoneManager.getRingtone(reactContext, uri)
            
            // Set audio attributes for music stream
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .setLegacyStreamType(AudioManager.STREAM_MUSIC)
                    .build()
                ringtone.audioAttributes = audioAttributes
            }
            
            // Store reference
            currentRingtone = ringtone
            
            // Play the ringtone
            ringtone.play()
            
            // Stop after 5 seconds
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                ringtone.stop()
                currentRingtone = null
                android.util.Log.d(MODULE_NAME, "Preview stopped after 5 seconds")
            }, 5000)
            
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e(MODULE_NAME, "Failed to preview ringtone", e)
            promise.reject("PREVIEW_ERROR", "Failed to preview ringtone: ${e.message}", e)
        }
    }
    
    @ReactMethod
    fun stopRingtonePreview() {
        try {
            currentRingtone?.let {
                if (it.isPlaying) {
                    it.stop()
                }
            }
            currentRingtone = null
            android.util.Log.d(MODULE_NAME, "Ringtone preview stopped")
        } catch (e: Exception) {
            android.util.Log.e(MODULE_NAME, "Failed to stop ringtone preview", e)
        }
    }
}