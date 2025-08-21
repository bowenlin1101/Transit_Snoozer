interface ParsedRoute {
  origin?: string;
  destination?: string;
  mode?: 'driving' | 'transit' | 'walking' | 'bicycling';
  waypoints?: string[];
  placeId?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export class GoogleMapsParser {
  /**
   * Parse a Google Maps URL to extract route information
   * Handles various URL formats:
   * - https://maps.app.goo.gl/XXXXX (shortened)
   * - https://www.google.com/maps/dir/Origin/Destination
   * - https://www.google.com/maps/place/Location
   * - https://goo.gl/maps/XXXXX
   */
  static async parseUrl(url: string): Promise<ParsedRoute> {
    const result: ParsedRoute = {};

    try {
      // Handle shortened URLs by following redirects
      if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
        // In a real implementation, we'd follow the redirect
        // For now, we'll just extract what we can
        console.log('Shortened URL detected:', url);
      }

      // Parse directions URLs
      const directionsMatch = url.match(/\/maps\/dir\/([^/]+)\/([^/?]+)/);
      if (directionsMatch) {
        result.origin = decodeURIComponent(directionsMatch[1]).replace(/\+/g, ' ');
        result.destination = decodeURIComponent(directionsMatch[2]).replace(/\+/g, ' ');
        
        // Extract transportation mode
        const modeMatch = url.match(/data=.*!4m\d+!4m\d+!1m\d+.*!3e(\d)/);
        if (modeMatch) {
          const modeMap: { [key: string]: ParsedRoute['mode'] } = {
            '0': 'driving',
            '1': 'walking',
            '2': 'bicycling',
            '3': 'transit',
          };
          result.mode = modeMap[modeMatch[1]] || 'driving';
        }
      }

      // Parse place URLs
      const placeMatch = url.match(/\/maps\/place\/([^/?]+)/);
      if (placeMatch) {
        result.destination = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
      }

      // Extract coordinates if present
      const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch) {
        result.coordinates = {
          lat: parseFloat(coordMatch[1]),
          lng: parseFloat(coordMatch[2]),
        };
      }

      // Extract place ID
      const placeIdMatch = url.match(/place_id:([^&]+)/);
      if (placeIdMatch) {
        result.placeId = placeIdMatch[1];
      }

      // Clean up destination name (remove extra info)
      if (result.destination) {
        // Remove coordinate info from destination
        result.destination = result.destination.split('@')[0].trim();
        // Remove "Station" suffix if it's redundant
        result.destination = result.destination.replace(/\s+Station$/i, ' Station');
      }

    } catch (error) {
      console.error('Error parsing Google Maps URL:', error);
    }

    return result;
  }

  /**
   * Extract just the destination from a URL for quick alarm setup
   */
  static extractDestination(url: string): string | null {
    const parsed = this.parseUrl(url);
    return parsed.destination || null;
  }

  /**
   * Check if a URL is a valid Google Maps URL
   */
  static isGoogleMapsUrl(url: string): boolean {
    const patterns = [
      /maps\.app\.goo\.gl/,
      /goo\.gl\/maps/,
      /google\.com\/maps/,
      /maps\.google\.com/,
    ];
    
    return patterns.some(pattern => pattern.test(url));
  }
}

export default GoogleMapsParser;