// Kavi Chettinadu Restaurant — Distance & Delivery Charge
// Based on flow diagram: 0-1km=Rs.20, 1-3km=Rs.40, 3-5km=Rs.60, 5+km=Rs.80

const RESTAURANT_LAT = 9.2876;
const RESTAURANT_LNG = 79.3129;

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getDeliveryCharge(km) {
  if (km <= 1) return 20;
  if (km <= 3) return 40;
  if (km <= 5) return 60;
  return 80;
}

const PINCODE_COORDS = {
  "623526": { lat:9.2876,  lng:79.3129, area:"Rameswaram"       },
  "623527": { lat:9.2900,  lng:79.3200, area:"Rameswaram East"  },
  "623525": { lat:9.2800,  lng:79.3050, area:"Rameswaram West"  },
  "623528": { lat:9.2750,  lng:79.3300, area:"Pamban"           },
  "623529": { lat:9.3100,  lng:79.3400, area:"Mandapam"         },
  "623530": { lat:9.3500,  lng:79.3600, area:"Mandapam Camp"    },
  "623531": { lat:9.3800,  lng:79.3800, area:"Uchipuli"         },
  "623532": { lat:9.4000,  lng:79.4000, area:"Tondi"            },
  "623401": { lat:9.5500,  lng:79.1500, area:"Ramanathapuram"   },
  "623501": { lat:9.4500,  lng:79.2500, area:"Paramakudi"       },
};

function getChargeFromPincode(pincode) {
  const coords = PINCODE_COORDS[pincode?.trim()];
  if (!coords) return { km: 5, charge: 60, area: "Unknown", known: false };
  const km = haversineDistance(RESTAURANT_LAT, RESTAURANT_LNG, coords.lat, coords.lng);
  const kmRounded = Math.round(km * 10) / 10;
  return { km: kmRounded, charge: getDeliveryCharge(kmRounded), area: coords.area, known: true };
}

function getChargeFromLocation(lat, lng) {
  const km = haversineDistance(RESTAURANT_LAT, RESTAURANT_LNG, lat, lng);
  const kmRounded = Math.round(km * 10) / 10;
  return { km: kmRounded, charge: getDeliveryCharge(kmRounded) };
}

module.exports = { getChargeFromPincode, getChargeFromLocation };
