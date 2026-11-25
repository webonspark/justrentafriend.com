const { PublicPlace } = require("../models");

/**
 * A starter list of busy, well-known public places in Bengaluru, so the
 * booking picker is not empty on day one. Positions are approximate (good
 * enough for the map pin) — staff should check each one and add their own
 * from Admin → Places before launch.
 */
const BENGALURU = [
  ["Third Wave Coffee, 12th Main", "cafe", "Indiranagar", "12th Main Rd, HAL 2nd Stage", 12.9719, 77.6412],
  ["Truffles, Koramangala", "restaurant", "Koramangala", "St John's Rd, 5th Block", 12.9333, 77.6143],
  ["Brahmin's Coffee Bar", "cafe", "Basavanagudi", "Ranga Rao Rd, Shankarapuram", 12.9536, 77.569],
  ["Cubbon Park", "park", "Central", "Kasturba Rd", 12.9763, 77.5929],
  ["Lalbagh Botanical Garden", "park", "Lalbagh", "Mavalli", 12.9507, 77.5848],
  ["Sankey Tank", "park", "Malleshwaram", "Sankey Rd, Sadashivanagar", 13.009, 77.573],
  ["UB City", "mall", "Central", "Vittal Mallya Rd", 12.9716, 77.596],
  ["Phoenix Marketcity", "mall", "Whitefield", "Whitefield Main Rd, Mahadevapura", 12.9975, 77.6966],
  ["Nexus Koramangala (Forum)", "mall", "Koramangala", "Hosur Rd", 12.9346, 77.6113],
  ["Orion Mall", "mall", "Rajajinagar", "Brigade Gateway, Dr Rajkumar Rd", 13.011, 77.555],
  ["Mantri Square Mall", "mall", "Malleshwaram", "Sampige Rd", 12.9917, 77.5707],
  ["National Gallery of Modern Art", "museum", "Central", "Palace Rd, Vasanth Nagar", 12.989, 77.588],
  ["Visvesvaraya Museum", "museum", "Central", "Kasturba Rd", 12.9752, 77.5963],
  ["Blossom Book House", "bookstore", "Central", "Church St", 12.975, 77.605],
  ["Bangalore International Centre", "event", "Domlur", "Domlur 2nd Stage", 12.9608, 77.642],
  ["Rangoli Metro Art Center", "event", "Central", "MG Road Boulevard", 12.9755, 77.607],
];

/** Adds the starter list if there are no places at all. Returns how many. */
async function ensureDefaultPlaces(city = "Bengaluru") {
  if (await PublicPlace.count()) return 0;
  if (!/bengaluru|bangalore/i.test(city)) return 0;
  await PublicPlace.bulkCreate(
    BENGALURU.map(([name, type, area, address, latitude, longitude]) => ({ name, type, city: "Bengaluru", area, address, latitude, longitude, isActive: true }))
  );
  return BENGALURU.length;
}

module.exports = { ensureDefaultPlaces };
