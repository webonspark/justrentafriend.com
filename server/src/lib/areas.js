/**
 * Neighbourhoods Companions can list themselves in and Customers can filter
 * by. One shared list, so a profile's area always matches the filter.
 * Add a city's areas here when it launches.
 */
const AREAS = {
  Bengaluru: [
    "Banashankari", "Banaswadi", "Basavanagudi", "Bannerghatta Road", "Bellandur", "Bommanahalli",
    "BTM Layout", "Brookefield", "Chamarajpet", "CV Raman Nagar", "Domlur", "Electronic City",
    "Frazer Town", "Hebbal", "Hennur", "HBR Layout", "Hoodi", "Hosur Road", "HSR Layout",
    "Indiranagar", "JP Nagar", "Jakkur", "Jayanagar", "Jeevan Bima Nagar", "Kalyan Nagar",
    "Kammanahalli", "Kengeri", "Koramangala", "KR Puram", "Kumaraswamy Layout", "Lavelle Road",
    "Mahadevapura", "Malleshwaram", "Marathahalli", "MG Road", "Nagarbhavi", "Old Airport Road",
    "Peenya", "Rajajinagar", "Rajarajeshwari Nagar", "Richmond Town", "RT Nagar", "Sadashivanagar",
    "Sahakar Nagar", "Sarjapur Road", "Shanti Nagar", "Shivajinagar", "Ulsoor", "Vasanth Nagar",
    "Vijayanagar", "Whitefield", "Yelahanka", "Yeshwanthpur",
  ],
};

const areasFor = (city) => AREAS[city] || [];

module.exports = { AREAS, areasFor };
