import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React Leaflet when bundled
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to dynamically update map center when coordinates change
const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

const RestaurantMap = ({ userLocation, restaurants }) => {
  const center = userLocation && userLocation.lat 
    ? [userLocation.lat, userLocation.lon] 
    : [20, 0]; // Default fallback

  return (
    <div className="map-wrapper">
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
      >
        {/* Dark/Light mode tile layer can be configured here. For now using standard OSM */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        {/* User Location Marker (Blue) */}
        {userLocation && (
          <Marker position={center}>
            <Popup>
              <strong>You are here</strong>
            </Popup>
          </Marker>
        )}

        {/* Restaurant Markers (Red) */}
        {restaurants.map((res) => {
          if (!res.lat || !res.lon) return null;
          
          const customIcon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          return (
            <Marker key={res.id} position={[res.lat, res.lon]} icon={customIcon}>
              <Popup>
                <div style={{ textAlign: 'center', minWidth: '150px' }}>
                  <strong style={{ fontSize: '1.1rem', color: '#1a1a1a' }}>{res.title}</strong><br/>
                  <span style={{ color: '#4a4a4a', fontSize: '0.9rem' }}>{res.tags[0]} • {res.rating} ⭐</span><br/>
                  <span style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px', display: 'block' }}>{res.tags[1]}</span>
                </div>
              </Popup>
            </Marker>
          );
        })}
        <MapUpdater center={center} />
      </MapContainer>
    </div>
  );
};

export default RestaurantMap;
