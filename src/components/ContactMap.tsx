import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MapPin, Phone, User, MapPin as MapPinIcon, Building2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { pageImage, usePageContent } from '../lib/pageContent';
import { contactPage } from '../content/pages/contact';

// Fix leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icon for active marker
const activeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom Icon for default marker
const defaultIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface Location { id: string; city: string; contactName: string; phone: string; address: string; lat: number; lng: number; image: string }

function MapController({ activeLocation }: { activeLocation: Location | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (activeLocation) {
      map.flyTo([activeLocation.lat, activeLocation.lng], 12, {
        animate: true,
        duration: 1.5
      });
    } else {
      // Zoom out to show all of Western/Central India where the pins are
      map.flyTo([20.0, 74.0], 5, {
        animate: true,
        duration: 1.5
      });
    }
  }, [activeLocation, map]);
  return null;
}

export default function ContactMap() {
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const c = usePageContent(contactPage);
  // Branches without valid coordinates are listed in the admin but not pinned on the map
  const locationsData: Location[] = c.list('map.locations')
    .map((l, i) => ({ id: String(i), city: l.city, contactName: l.contactName, phone: l.phone, address: l.address, lat: parseFloat(l.lat), lng: parseFloat(l.lng), image: l.image ? pageImage(l.image) : '' }))
    .filter(l => Number.isFinite(l.lat) && Number.isFinite(l.lng));

  const activeLocation = locationsData.find(loc => loc.id === activeLocationId);

  const handlePinClick = (id: string) => {
    setActiveLocationId(activeLocationId === id ? null : id);
  };

  return (
    <div className="w-full relative">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-[#0a5c86] dark:text-white mb-4">{c.text('map.heading')}</h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
            {c.text('map.intro')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          {/* Map Section */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative w-full h-[350px] lg:h-[380px] bg-slate-100 dark:bg-[#0a121a] rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden z-0 p-2 lg:max-w-[100%]"
          >
            <MapContainer 
              center={[20.0, 74.0]} 
              zoom={5} 
              minZoom={4}
              maxBounds={[
                [6.0, 68.0],
                [36.0, 98.0]
              ]}
              maxBoundsViscosity={1.0}
              style={{ height: '100%', width: '100%', borderRadius: '1.25rem', zIndex: 1 }}
              className="w-full h-full relative"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MapController activeLocation={activeLocation} />
              {locationsData.map((loc) => (
                <Marker 
                  key={loc.id} 
                  position={[loc.lat, loc.lng]}
                  icon={activeLocationId === loc.id ? activeIcon : defaultIcon}
                  eventHandlers={{
                    click: () => handlePinClick(loc.id),
                  }}
                />
              ))}
            </MapContainer>
            
            {activeLocationId && (
              <button 
                onClick={() => {
                  setActiveLocationId(null);
                }}
                className="absolute shrink-0 z-10 bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-5 py-2.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] font-medium text-sm hover:scale-105 transition-transform flex items-center border border-slate-200 dark:border-slate-700"
              >
                <MapPinIcon size={16} className="mr-2" />
                {c.text('map.zoomOut')}
              </button>
            )}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative w-full h-[350px] lg:h-[380px]"
          >
            <div className="w-full h-full rounded-3xl p-8 flex flex-col justify-center items-center text-center border border-slate-200 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden bg-white dark:bg-[#08121d]">
              {activeLocation && (
                <div 
                  className="absolute inset-0 bg-cover bg-center bg-linear-to-br from-[#0a5c86] to-[#06283d]"
                  style={activeLocation.image ? { backgroundImage: `url('${activeLocation.image}')` } : undefined}
                >
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/60 to-black/30" />
                </div>
              )}
              <div className="relative z-10 w-full h-full flex flex-col justify-center">
                {!activeLocation ? (
                  <>
                    <div className="w-16 h-16 mx-auto bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-6 text-slate-400 dark:text-slate-500">
                      <MapPinIcon size={28} />
                    </div>
                    <h3 className="text-2xl font-serif text-slate-900 dark:text-white mb-3">{c.text('map.selectTitle')}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
                      {c.text('map.selectText')}
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-start w-full space-y-6">
                    <div>
                      <h3 className="text-3xl font-serif text-white mb-2 drop-shadow-md">
                        {activeLocation.city}
                      </h3>
                      <p className="text-cyan-300 font-medium text-sm tracking-wide uppercase drop-shadow">
                        {activeLocation.contactName}
                      </p>
                    </div>
                    
                    <div className="space-y-4 w-full">
                      <div className="flex items-start gap-3">
                        <Phone size={18} className="text-cyan-300 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-white/70 uppercase tracking-wider mb-1">Phone</p>
                          <p className="text-white text-sm">{activeLocation.phone}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <MapPinIcon size={18} className="text-cyan-300 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-white/70 uppercase tracking-wider mb-1">Address</p>
                          <p className="text-white text-sm leading-relaxed">{activeLocation.address}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
