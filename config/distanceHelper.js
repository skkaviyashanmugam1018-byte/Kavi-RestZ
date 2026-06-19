// ═══════════════════════════════════════════════════════
// DISTANCE & DELIVERY CHARGE CALCULATOR
// Restaurant: Kavi Chettinadu, Rameswaram
// ═══════════════════════════════════════════════════════

const RESTAURANT_LAT = 9.2876;
const RESTAURANT_LNG = 79.3129;
const RATE_PER_KM    = 30; // Rs.30 per km
const MIN_CHARGE     = 30; // minimum delivery charge

// Haversine formula — straight line distance in km
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Pincode → lat/lng lookup (Tamil Nadu pincodes near Rameswaram)
const PINCODE_COORDS = {
  "623526": { lat: 9.2876,  lng: 79.3129, area: "Rameswaram"        }, // restaurant itself
  "623527": { lat: 9.2900,  lng: 79.3200, area: "Rameswaram East"   },
  "623525": { lat: 9.2800,  lng: 79.3050, area: "Rameswaram West"   },
  "623528": { lat: 9.2750,  lng: 79.3300, area: "Pamban"            },
  "623529": { lat: 9.3100,  lng: 79.3400, area: "Mandapam"          },
  "623530": { lat: 9.3500,  lng: 79.3600, area: "Mandapam Camp"     },
  "623531": { lat: 9.3800,  lng: 79.3800, area: "Uchipuli"          },
  "623532": { lat: 9.4000,  lng: 79.4000, area: "Tondi"             },
  "623401": { lat: 9.5500,  lng: 79.1500, area: "Ramanathapuram"    },
  "623403": { lat: 9.5700,  lng: 79.1700, area: "Ramanathapuram"    },
  "623501": { lat: 9.4500,  lng: 79.2500, area: "Paramakudi"        },
  "623502": { lat: 9.5000,  lng: 79.2000, area: "Paramakudi"        },
  "623701": { lat: 9.1500,  lng: 79.4500, area: "Tiruchendur area"  },
};

// Calculate delivery charge from pincode
function getChargeFromPincode(pincode) {
  const coords = PINCODE_COORDS[pincode?.trim()];
  if (!coords) {
    // Unknown pincode — default to 5km estimate
    return { km: 5, charge: 150, area: "Unknown area", known: false };
  }
  const km = haversineDistance(RESTAURANT_LAT, RESTAURANT_LNG, coords.lat, coords.lng);
  const charge = Math.max(MIN_CHARGE, Math.round(km) * RATE_PER_KM);
  return { km: Math.round(km * 10) / 10, charge, area: coords.area, known: true };
}

// Calculate delivery charge from live location
function getChargeFromLocation(lat, lng) {
  const km = haversineDistance(RESTAURANT_LAT, RESTAURANT_LNG, lat, lng);
  const charge = Math.max(MIN_CHARGE, Math.round(km) * RATE_PER_KM);
  return { km: Math.round(km * 10) / 10, charge };
}

module.exports = { getChargeFromPincode, getChargeFromLocation, RATE_PER_KM };