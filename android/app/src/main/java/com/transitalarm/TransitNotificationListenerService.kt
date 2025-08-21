package com.transitalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.core.app.NotificationCompat

class TransitNotificationListenerService : NotificationListenerService() {
    
    companion object {
        const val TAG = "TransitNotificationListener"
        const val CHANNEL_ID = "transit_alarm_channel"
        const val NOTIFICATION_ID = 9999
        private var instance: TransitNotificationListenerService? = null
        
        // List of supported transit app package names
        val SUPPORTED_APPS = listOf(
            "com.google.android.apps.maps",
            "com.thetransitapp.droid",
            "com.citymapper.app.release",
            "com.apple.Maps" // For future compatibility
        )
        
        // Queue to store notifications until React context is ready
        private val pendingNotifications = mutableListOf<NotificationData>()
        
        // Store the last dismissed notification title (normalized)
        @Volatile
        private var lastDismissedNotificationTitle: String = ""
        
        fun getPendingNotifications(): List<NotificationData> {
            val notifications = pendingNotifications.toList()
            pendingNotifications.clear()
            return notifications
        }
        
        fun clearDismissedNotification() {
            Log.d(TAG, "Clearing dismissed notification memory")
            lastDismissedNotificationTitle = ""
        }
        
        fun setLastDismissedTitle(title: String) {
            lastDismissedNotificationTitle = normalizeTitle(title)
            Log.d(TAG, "Saved dismissed notification title: $lastDismissedNotificationTitle")
        }
        
        private fun normalizeTitle(title: String): String {
            return title.lowercase().trim()
        }
        
        // Check if notification contains alarm trigger keywords
        fun shouldTriggerAlarm(title: String?, text: String?, alarmAtStops: Int): Boolean {
            val combinedText = "${title ?: ""} ${text ?: ""}".lowercase()
            
            Log.d(TAG, "Checking alarm trigger - alarmAtStops: $alarmAtStops, text: $combinedText")
            
            return when (alarmAtStops) {
                1 -> {
                    // Looking for "Next stop", "Final stop", "Last stop", "Get off at the next stop"
                    combinedText.contains("next stop") || 
                    combinedText.contains("final stop") || 
                    combinedText.contains("last stop") ||
                    combinedText.contains("get off at the next stop") ||
                    combinedText.contains("arriving at")
                }
                2 -> {
                    // Looking for "1 stop", "one stop"
                    combinedText.contains("1 stop") || 
                    combinedText.contains("one stop") ||
                    combinedText.contains("in 1 stop")
                }
                3 -> {
                    // Looking for "2 stops", "two stops"
                    combinedText.contains("2 stops") || 
                    combinedText.contains("two stops") ||
                    combinedText.contains("in 2 stops")
                }
                4 -> {
                    // Looking for "3 stops", "three stops"
                    combinedText.contains("3 stops") || 
                    combinedText.contains("three stops") ||
                    combinedText.contains("in 3 stops")
                }
                5 -> {
                    // Looking for "4 stops", "four stops"
                    combinedText.contains("4 stops") || 
                    combinedText.contains("four stops") ||
                    combinedText.contains("in 4 stops")
                }
                else -> {
                    // For any other value, look for the pattern "X stops"
                    val stopsPattern = "${alarmAtStops - 1} stop"
                    combinedText.contains(stopsPattern)
                }
            }
        }
    }
    
    data class NotificationData(
        val packageName: String,
        val appName: String,
        val title: String?,
        val text: String?,
        val subText: String?,
        val bigText: String?,
        val timestamp: Long
    )

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        Log.d(TAG, "NotificationListenerService created")
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Transit Alarm"
            val descriptionText = "Notifications for transit alarms"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setSound(null, null) // No sound, we're playing our own
            }
            
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        Log.d(TAG, "NotificationListenerService destroyed")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName
        
        // Only process notifications from supported transit apps
        if (!SUPPORTED_APPS.contains(packageName)) {
            return
        }
        
        // Check if we're actively monitoring
        if (!NotificationListenerModule.isMonitoring) {
            Log.d(TAG, "Transit notification received from $packageName but monitoring is disabled")
            return
        }
        
        // Note: We don't filter by monitored app here anymore, so all transit notifications
        // are processed and sent to UI. Filtering for alarms happens in the alarm logic below.
        
        Log.d(TAG, "Transit notification received from: $packageName")

        val notification = sbn.notification
        val extras = notification.extras
        
        // Extract all notification fields
        val title = extras.getString(Notification.EXTRA_TITLE)
        val text = extras.getString(Notification.EXTRA_TEXT)
        val subText = extras.getString(Notification.EXTRA_SUB_TEXT)
        val bigText = extras.getString(Notification.EXTRA_BIG_TEXT)
        val timestamp = sbn.postTime
        
        // Get app name
        val appName = when(packageName) {
            "com.google.android.apps.maps" -> "Google Maps"
            "com.thetransitapp.droid" -> "Transit"
            "com.citymapper.app.release" -> "Citymapper"
            else -> packageName
        }

        Log.d(TAG, "Transit notification - Title: $title, Text: $text, SubText: $subText, BigText: $bigText")
        
        // Get current alarm settings from the module
        val alarmAtStops = NotificationListenerModule.alarmAtStops
        
        // Check if debug mode is enabled or the notification contains keywords that should trigger alarm
        val debugMode = NotificationListenerModule.debugMode
        val fullText = bigText ?: text
        
        if (debugMode) {
            // Only trigger alarm if this is the monitored app
            val monitoredApp = NotificationListenerModule.monitoredPackage
            if (monitoredApp != null && packageName == monitoredApp) {
                Log.d(TAG, "Debug mode enabled - triggering alarm for monitored app $appName notification")
                
                // Check if this notification was just dismissed
                val normalizedTitle = normalizeTitle(title ?: "")
                if (normalizedTitle == lastDismissedNotificationTitle) {
                    Log.d(TAG, "This notification title was just dismissed, ignoring: $title")
                } else {
                    // Store the notification message for the alarm
                    val alarmMessage = "$appName: ${title ?: "Transit Update"}"

                    // Play alarm immediately from native side
                    playAlarmDirectly(alarmMessage, title)
                }
            } else {
                Log.d(TAG, "Debug mode enabled but notification from $appName ignored (monitoring: $monitoredApp)")
            }
        } else if (shouldTriggerAlarm(title, fullText, alarmAtStops)) {
            // Also check if this is the monitored app for non-debug mode
            val monitoredApp = NotificationListenerModule.monitoredPackage
            if (monitoredApp != null && packageName == monitoredApp) {
                Log.d(TAG, "Alarm trigger keywords found!")
                
                // Check if this notification was just dismissed
                val normalizedTitle = normalizeTitle(title ?: "")
                if (normalizedTitle == lastDismissedNotificationTitle) {
                    Log.d(TAG, "This notification title was just dismissed, ignoring: $title")
                } else {
                    // Store the notification message for the alarm
                    val alarmMessage = "$appName: ${title ?: "Transit Update"}"

                    // Play alarm immediately from native side
                    playAlarmDirectly(alarmMessage, title)
                }
            } else {
                Log.d(TAG, "Alarm keywords found but notification from $appName ignored (monitoring: $monitoredApp)")
            }
        } else {
            Log.d(TAG, "No alarm trigger keywords found for alarmAtStops=$alarmAtStops")
        }

        // Always send to React Native module for UI updates
        sendNotificationToReactNative(packageName, appName, title, text, subText, bigText, timestamp, 0)
    }
    
    private fun playAlarmDirectly(message: String, title: String? = null) {
        try {
            Log.d(TAG, "Playing alarm directly from notification service with message: $message")
            
            // Check if alarm is already playing
            val notificationModule = NotificationListenerModule.getCurrentInstance()
            // Note: We can't access currentRingtone from here, so we'll rely on the module's internal check
            
            // Store the title for later dismissal tracking
            notificationModule?.setAlarmTitle(title ?: "")
            
            // Show notification
            showAlarmNotification(message)
            
            // Trigger alarm
            notificationModule?.playAlarmSound(NotificationListenerModule.currentVolume, NotificationListenerModule.currentAlarmSound)
            notificationModule?.setAlarmMessage(message)
        } catch (e: Exception) {
            Log.e(TAG, "Error playing alarm directly", e)
        }
    }
    
    private fun showAlarmNotification(message: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("ALARM_TRIGGERED", true)
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        // Create stop action
        val stopIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("STOP_ALARM", true)
        }
        
        val stopPendingIntent = PendingIntent.getActivity(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("🚨 Transit Alarm!")
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(false)
            .setOngoing(true)
            .addAction(
                android.R.drawable.ic_media_pause,
                "Stop Alarm",
                stopPendingIntent
            )
            .build()
            
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }
    
    private fun sendNotificationToReactNative(
        packageName: String,
        appName: String,
        title: String?,
        text: String?,
        subText: String?,
        bigText: String?,
        timestamp: Long,
        retryCount: Int
    ) {
        // Try to get the current module instance directly
        val notificationModule = NotificationListenerModule.getCurrentInstance()
        
        if (notificationModule != null) {
            try {
                notificationModule.sendNotificationToJS(packageName, appName, title, text, subText, bigText, timestamp)
                Log.d(TAG, "Notification sent to JS via module instance: $title")
            } catch (e: Exception) {
                Log.e(TAG, "Error sending notification to JS", e)
                // Store for later if there's an error
                pendingNotifications.add(NotificationData(packageName, appName, title, text, subText, bigText, timestamp))
            }
        } else {
            Log.w(TAG, "NotificationListenerModule not initialized, storing notification for later")
            
            // Store the notification for later delivery
            pendingNotifications.add(NotificationData(packageName, appName, title, text, subText, bigText, timestamp))
            
            // Only retry a couple times during app startup
            if (retryCount < 2) {
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    sendNotificationToReactNative(packageName, appName, title, text, subText, bigText, timestamp, retryCount + 1)
                }, 2000) // Retry after 2 seconds
            }
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        // We don't need to handle notification removal for this use case
    }
}