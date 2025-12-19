# E:\study\techfix\backend\api\geocoding.py
from geopy.geocoders import Nominatim
from django.core.cache import cache
import time
import logging

logger = logging.getLogger(__name__)

# Initialize geocoder with timeout
geolocator = Nominatim(user_agent="techfix_app", timeout=10)

def get_location_name(latitude, longitude):
    """
    Convert latitude and longitude to a detailed location name using Nominatim (OpenStreetMap)
    Returns format: [Area/Village], [City/Town], [Pincode]
    """
    try:
        # Cache key
        cache_key = f"location_{latitude:.4f}_{longitude:.4f}"
        
        # Check if already cached
        cached_location = cache.get(cache_key)
        if cached_location:
            logger.info(f"Cache hit for {cache_key}")
            return cached_location
        
        logger.info(f"Fetching location for {latitude}, {longitude}")
        
        # Get location from coordinates with address details
        location = geolocator.reverse(f"{latitude}, {longitude}", exactly_one=True, language='en')
        
        if not location:
            logger.warning(f"No location found for coordinates: {latitude}, {longitude}")
            return f"Unknown Location ({latitude:.4f}, {longitude:.4f})"
        
        # Get address components
        address = location.raw.get('address', {})
        
        # Extract relevant address parts
        components = []
        
        # Try to get the most specific location first
        for field in ['village', 'suburb', 'neighbourhood', 'road']:
            if field in address:
                components.append(address[field])
                break
        
        # Add town/city
        for field in ['town', 'city', 'county']:
            if field in address and (not components or address[field] != components[-1]):
                components.append(address[field])
                break
        
        # Add pincode if available
        if 'postcode' in address:
            components.append(address['postcode'])
        
        # If we couldn't find specific components, use the full address
        if not components:
            full_address = location.address
            # Take first 3 parts of the address to avoid too long strings
            components = [p.strip() for p in full_address.split(',')[:3]]
        
        # Join components with comma and space, and clean up any extra spaces
        location_name = ', '.join(components).strip()
        
        # Cache for 7 days (604800 seconds)
        cache.set(cache_key, location_name, 604800)
        
        logger.info(f"Cached location: {location_name}")
        return location_name
        
    except Exception as e:
        logger.error(f"Geocoding error: {e}")
        # Return formatted coordinates as fallback
        return f"{latitude:.4f}°N, {longitude:.4f}°E"
