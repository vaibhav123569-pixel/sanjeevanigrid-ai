import { useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, Tooltip } from 'react-leaflet';
import { divIcon, type LatLngExpression } from 'leaflet';
import { facilities, roads, villages, type VillageId } from '../domain/scenario';
import { recommendRoute } from '../domain/access';

interface MapViewProps {
  stage: number;
  selectedVillage?: VillageId;
  compact?: boolean;
}

type MapsOverlay = { setMap: (map: unknown) => void };
type GoogleMapInstance = object;
interface GoogleMapsNamespace {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
    Marker: new (options: Record<string, unknown>) => MapsOverlay;
    Polyline: new (options: Record<string, unknown>) => MapsOverlay;
    Polygon: new (options: Record<string, unknown>) => MapsOverlay;
  };
}
declare global { interface Window { google?: GoogleMapsNamespace } }

const center: LatLngExpression = [26.225, 92.714];

function markerIcon(kind: 'village' | 'hospital' | 'bridge' | 'ambulance', risk = false) {
  const label = kind === 'village' ? 'V' : kind === 'hospital' ? '+' : kind === 'ambulance' ? 'A' : 'B';
  const color = kind === 'hospital' ? '#2dd4bf' : kind === 'bridge' ? '#f59e0b' : kind === 'ambulance' ? '#bd98f2' : risk ? '#f97373' : '#8fb7d2';
  return divIcon({
    className: 'sg-marker-wrap',
    html: `<span class="sg-marker sg-marker-${kind}" style="--marker-color:${color}">${label}</span>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
  });
}

function LeafletMap({ stage, selectedVillage, compact }: MapViewProps) {
  const activeRouteIds = new Set(recommendRoute(selectedVillage ?? 'riverbend', stage)?.roads.map((road) => road.id) ?? []);
  const roadFeatures = useMemo(() => roads.map((road) => {
    const blocked = road.bridge && stage >= 5;
    const exposed = road.bridge && stage >= 1;
    const altRoute = activeRouteIds.has(road.id) && !blocked;
    const positions = road.path as LatLngExpression[];
    return { road, blocked, exposed, altRoute, positions };
  }), [stage, selectedVillage, activeRouteIds.size]);
  const dangerRing: LatLngExpression[] = [[26.145, 92.713], [26.155, 92.744], [26.179, 92.757], [26.195, 92.733], [26.18, 92.704]];

  return (
    <div className={`map-frame ${compact ? 'map-frame-compact' : ''}`} aria-label="Interactive simulated road network map">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} zoomControl={!compact} className="map-canvas">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {roadFeatures.map(({ road, blocked, exposed, altRoute, positions }) => (
          <Polyline
            key={road.id}
            positions={positions}
            pathOptions={{
              color: blocked ? '#f87171' : exposed ? '#f59e0b' : altRoute ? '#2dd4bf' : '#5d7484',
              weight: altRoute || road.bridge ? 5 : 3,
              opacity: blocked ? 0.95 : altRoute ? 0.95 : 0.7,
              dashArray: blocked ? '8 8' : undefined,
            }}
          ><Popup>{road.bridge ? 'Critical bridge · ' : 'Road segment · '}{road.lengthKm} km · {blocked ? 'Blocked in this simulation stage' : exposed ? 'Rising-water watch' : 'Simulated accessible'}</Popup></Polyline>
        ))}
        {stage >= 1 && <Polygon positions={dangerRing} pathOptions={{ color: '#f97373', weight: 1, fillColor: '#ef4444', fillOpacity: 0.12 }} />}
        {villages.map((village) => (
          <Marker key={village.id} position={[village.lat, village.lng]} icon={markerIcon('village', (stage >= 4 && village.id === 'riverbend') || village.id === selectedVillage)}>
            <Tooltip direction="top">{village.name} · simulated village</Tooltip>
            <Popup><strong>{village.name}</strong><br />Village marker · scenario data only</Popup>
          </Marker>
        ))}
        {facilities.map((facility) => (
          <Marker key={facility.id} position={[facility.lat, facility.lng]} icon={markerIcon('hospital')}>
            <Tooltip direction="top">{facility.name}</Tooltip>
            <Popup><strong>{facility.name}</strong><br />Availability: {facility.availability} · sample data</Popup>
          </Marker>
        ))}
        <Marker position={[26.239, 92.658]} icon={markerIcon('ambulance')}><Tooltip direction="top">Ambulance 01 · simulation only</Tooltip><Popup><strong>Ambulance 01</strong><br />Illustrative responder asset · not a live location</Popup></Marker>
        {roads.filter((road) => road.bridge).map((road) => <Marker key="bridge-marker" position={road.path[1]} icon={markerIcon('bridge', stage >= 1)}><Tooltip>Critical bridge · simulation</Tooltip></Marker>)}
        {stage >= 1 && <Circle center={[26.17, 92.73]} radius={1250} pathOptions={{ color: '#ef6868', fillColor: '#ef6868', fillOpacity: 0.06, weight: 1 }} />}
      </MapContainer>
      <div className="map-legend" aria-label="Map legend">
        <span><i className="legend-dot village-dot" />Village</span>
        <span><i className="legend-dot hospital-dot" />Health facility</span>
        <span><i className="legend-dot ambulance-dot" />Ambulance · sim</span>
        <span><i className="legend-line road-open" />Open road</span>
        <span><i className="legend-line road-risk" />Risk / alternate</span>
      </div>
      <span className="map-sim-note">Illustrative geography · simulated network</span>
    </div>
  );
}

let googleScriptPromise: Promise<GoogleMapsNamespace> | null = null;
function loadGoogleMaps(key: string): Promise<GoogleMapsNamespace> {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => window.google?.maps ? resolve(window.google) : reject(new Error('Maps API did not initialize'));
    script.onerror = () => reject(new Error('Google Maps could not be loaded'));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

function GoogleRoadMap({ stage, selectedVillage, compact, onFallback }: MapViewProps & { onFallback: () => void }) {
  const [mapState, setMapState] = useState<{ maps: GoogleMapsNamespace; map: GoogleMapInstance } | null>(null);
  const [mapElement, setMapElement] = useState<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!key || !mapElement) return;
    let alive = true;
    loadGoogleMaps(key).then((maps) => {
      if (!alive) return;
      const map = new maps.maps.Map(mapElement, {
        center: { lat: 26.225, lng: 92.714 }, zoom: 12, mapTypeControl: false, streetViewControl: false,
        fullscreenControl: false, clickableIcons: false, mapId: import.meta.env.VITE_GOOGLE_MAP_ID,
      });
      setMapState({ maps, map });
    }).catch(() => { if (alive) { setFailed(true); onFallback(); } });
    return () => { alive = false; };
  }, [key, mapElement, onFallback]);

  useEffect(() => {
    if (!mapState) return;
    const { maps, map } = mapState;
    const overlays: MapsOverlay[] = [];
    const add = (overlay: MapsOverlay) => overlays.push(overlay);
    const activeRouteIds = new Set(recommendRoute(selectedVillage ?? 'riverbend', stage)?.roads.map((road) => road.id) ?? []);
    for (const road of roads) {
      const blocked = Boolean(road.bridge && stage >= 5);
      const exposed = Boolean(road.bridge && stage >= 1);
      const altRoute = activeRouteIds.has(road.id) && !blocked;
      add(new maps.maps.Polyline({
        map, path: road.path.map(([lat, lng]) => ({ lat, lng })), geodesic: true,
        strokeColor: blocked ? '#f87171' : exposed ? '#f59e0b' : altRoute ? '#2dd4bf' : '#637987',
        strokeOpacity: 0.88, strokeWeight: altRoute || road.bridge ? 5 : 3,
        icons: blocked ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '12px' }] : undefined,
      }));
    }
    for (const village of villages) add(new maps.maps.Marker({ map, position: { lat: village.lat, lng: village.lng }, title: `${village.name} · simulated village`, label: 'V' }));
    for (const facility of facilities) add(new maps.maps.Marker({ map, position: { lat: facility.lat, lng: facility.lng }, title: facility.name, label: '+' }));
    add(new maps.maps.Marker({ map, position: { lat: 26.239, lng: 92.658 }, title: 'Ambulance 01 · simulation only', label: 'A' }));
    if (stage >= 1) add(new maps.maps.Polygon({ map, paths: [[{ lat: 26.145, lng: 92.713 }, { lat: 26.155, lng: 92.744 }, { lat: 26.179, lng: 92.757 }, { lat: 26.195, lng: 92.733 }, { lat: 26.18, lng: 92.704 }]], strokeColor: '#ef6868', fillColor: '#ef6868', fillOpacity: 0.12, strokeWeight: 1 }));
    return () => overlays.forEach((overlay) => overlay.setMap(null));
  }, [mapState, stage, selectedVillage]);

  if (failed) return null;
  return <div className={`map-frame ${compact ? 'map-frame-compact' : ''}`}><div ref={setMapElement} className="map-canvas" aria-label="Google map showing simulated roads and facilities" />
    <div className="map-legend"><span><i className="legend-dot village-dot" />Village</span><span><i className="legend-dot hospital-dot" />Health facility</span><span><i className="legend-dot ambulance-dot" />Ambulance · sim</span><span><i className="legend-line road-open" />Open road</span><span><i className="legend-line road-risk" />Risk / alternate</span></div>
    <span className="map-sim-note">Illustrative geography · simulated network</span>
  </div>;
}

export default function MapView(props: MapViewProps) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [useLeaflet, setUseLeaflet] = useState(!key);
  const fallback = useCallback(() => setUseLeaflet(true), []);
  if (key && !useLeaflet) return <GoogleRoadMap {...props} onFallback={fallback} />;
  return <LeafletMap {...props} />;
}
