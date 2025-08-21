import { NotificationData } from '../types';

interface ParserPattern {
  app: string;
  patterns: {
    nextStop: RegExp;
    stopsRemaining: RegExp;
    line: RegExp;
  };
}

const PARSER_PATTERNS: ParserPattern[] = [
  {
    app: 'com.google.android.apps.maps',
    patterns: {
      nextStop: /Next stop[:\s]+([^(]+)/i,
      stopsRemaining: /\((\d+)\s+(?:more\s+)?stops?\)/i,
      line: /(?:Line|Route|Bus|Train)\s+([A-Z0-9]+)/i,
    },
  },
  {
    app: 'com.thetransitapp.droid',
    patterns: {
      nextStop: /Next[:\s]+([^-]+)/i,
      stopsRemaining: /(\d+)\s+stops?\s+remaining/i,
      line: /([A-Z0-9]+)\s+(?:Line|Route)/i,
    },
  },
];

export class NotificationParser {
  static parseTransitNotification(notification: NotificationData): NotificationData {
    const pattern = PARSER_PATTERNS.find(p => notification.appName.includes(p.app));
    
    if (!pattern) {
      return notification;
    }

    const fullText = `${notification.title} ${notification.text}`;
    const parsedData: NotificationData['parsedData'] = {};

    // Parse next stop
    const nextStopMatch = fullText.match(pattern.patterns.nextStop);
    if (nextStopMatch) {
      parsedData.nextStop = nextStopMatch[1].trim();
    }

    // Parse stops remaining
    const stopsMatch = fullText.match(pattern.patterns.stopsRemaining);
    if (stopsMatch) {
      parsedData.stopsRemaining = parseInt(stopsMatch[1], 10);
    }

    // Parse line/route
    const lineMatch = fullText.match(pattern.patterns.line);
    if (lineMatch) {
      parsedData.line = lineMatch[1].trim();
    }

    return {
      ...notification,
      parsedData,
    };
  }

  static isTransitNotification(notification: NotificationData): boolean {
    const transitKeywords = [
      'stop', 'station', 'arriving', 'departure',
      'route', 'line', 'bus', 'train', 'subway',
      'transit', 'destination', 'transfer'
    ];

    const fullText = `${notification.title} ${notification.text}`.toLowerCase();
    return transitKeywords.some(keyword => fullText.includes(keyword));
  }

  static shouldTriggerAlarm(
    notification: NotificationData,
    alarmAtStops: number,
    destination?: string
  ): boolean {
    const stopsRemaining = notification.parsedData?.stopsRemaining;
    const hasStopsRemaining = stopsRemaining !== undefined && stopsRemaining <= alarmAtStops;
    
    // Also check if destination is mentioned in the notification
    if (destination) {
      const fullText = `${notification.title} ${notification.text}`.toLowerCase();
      const destLower = destination.toLowerCase();
      const hasDestination = fullText.includes(destLower) || 
                           (notification.parsedData?.nextStop?.toLowerCase().includes(destLower) ?? false);
      
      return hasStopsRemaining || hasDestination;
    }
    
    return hasStopsRemaining;
  }
  
  static extractDestinationInfo(notification: NotificationData, destination: string): string | null {
    const fullText = `${notification.title} ${notification.text}`;
    const destLower = destination.toLowerCase();
    
    // Check various patterns for destination mentions
    const patterns = [
      new RegExp(`approaching\\s+${destLower}`, 'i'),
      new RegExp(`next\\s+stop[:\\s]+${destLower}`, 'i'),
      new RegExp(`arriving\\s+at\\s+${destLower}`, 'i'),
      new RegExp(`${destLower}\\s+station`, 'i'),
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(fullText)) {
        return `Arriving at ${destination}`;
      }
    }
    
    return null;
  }
}